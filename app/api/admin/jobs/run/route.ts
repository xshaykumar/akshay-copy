import { and, asc, eq, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditLogs, scheduledJobs } from "@/db/schema";
import { reconcileAssignmentLifecycle } from "@/lib/assignments/lifecycle";
import {
  expireSwitchRequest,
  reconcileServiceCycle,
} from "@/lib/service-cycles/lifecycle";
import { requireRole } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env/server";
import { reconcilePlanUpgrade } from "@/lib/plans/upgrade";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";

async function runDueJobs({
  actorUserId,
  requestId,
}: {
  actorUserId?: string;
  requestId: string;
}) {
  const db = getDb();
  const due = await db
    .select()
    .from(scheduledJobs)
    .where(
      and(
        eq(scheduledJobs.status, "pending"),
        lte(scheduledJobs.runAt, new Date()),
      ),
    )
    .orderBy(asc(scheduledJobs.runAt))
    .limit(100);
  let completed = 0;

  for (const job of due) {
    const [claimed] = await db
      .update(scheduledJobs)
      .set({
        status: "running",
        attempts: job.attempts + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledJobs.id, job.id),
          eq(scheduledJobs.status, "pending"),
        ),
      )
      .returning({ id: scheduledJobs.id });
    if (!claimed) continue;

    try {
      if (
        ["expire_coach_selection", "expire_coach_application"].includes(
          job.jobType,
        ) &&
        typeof job.payload.assignmentId === "string"
      ) {
        await reconcileAssignmentLifecycle(job.payload.assignmentId);
      }
      if (
        job.jobType === "complete_service_cycle" &&
        typeof job.payload.serviceCycleId === "string"
      ) {
        await reconcileServiceCycle(job.payload.serviceCycleId);
      }
      if (
        job.jobType === "expire_replacement_request" &&
        typeof job.payload.replacementId === "string"
      ) {
        await expireSwitchRequest(job.payload.replacementId);
      }
      if (
        job.jobType === "apply_plan_upgrade" &&
        typeof job.payload.upgradeId === "string"
      ) {
        await reconcilePlanUpgrade(job.payload.upgradeId);
      }
      await db
        .update(scheduledJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(scheduledJobs.id, job.id));
      completed += 1;
    } catch {
      const retry = job.attempts + 1 < 3;
      await db
        .update(scheduledJobs)
        .set({
          status: retry ? "pending" : "failed",
          runAt: retry
            ? new Date(Date.now() + (job.attempts + 1) * 60_000)
            : job.runAt,
          lastErrorCode: "job_execution_failed",
          updatedAt: new Date(),
        })
        .where(eq(scheduledJobs.id, job.id));
    }
  }

  await db.insert(auditLogs).values({
    actorUserId,
    action: "scheduled_jobs.run",
    targetType: "scheduled_job",
    requestId,
    safeMetadata: { attempted: due.length, completed },
  });
  return { attempted: due.length, completed };
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const secret = getServerEnv().CRON_SECRET;
    if (
      !secret ||
      request.headers.get("authorization") !== `Bearer ${secret}`
    ) {
      throw new HttpError(401, "cron_unauthorized", "Unauthorized.");
    }
    return NextResponse.json(await runDueJobs({ requestId }));
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const admin = await requireRole("admin");
    return NextResponse.json(
      await runDueJobs({ actorUserId: admin.id, requestId }),
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
