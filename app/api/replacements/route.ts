import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  coachProfiles,
  notifications,
  planPurchases,
  plans,
  replacementRequests,
  scheduledJobs,
  serviceCycles,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { activeCoachConditions } from "@/lib/coaches/activation";
import { coachCanServePlan } from "@/lib/plans/coach-eligibility";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import {
  hashRequest,
  requireIdempotencyKey,
  runIdempotent,
} from "@/lib/idempotency";
import {
  reconcileDueServiceCycles,
  SWITCH_RESPONSE_WINDOW_MS,
} from "@/lib/service-cycles/lifecycle";

const inputSchema = z.object({
  assignmentId: z.uuid(),
  desiredCoachUserId: z.uuid(),
  reasonCode: z.enum([
    "availability",
    "coaching_fit",
    "communication",
    "other",
  ]),
  reason: z.string().trim().min(10).max(2000),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const client = await requireRole("client");
    await reconcileDueServiceCycles();
    const rows = await getDb()
      .select()
      .from(replacementRequests)
      .where(eq(replacementRequests.requestedByUserId, client.id))
      .orderBy(desc(replacementRequests.createdAt));
    return NextResponse.json({ replacements: rows });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const client = await requireRole("client");
    const input = inputSchema.parse(await request.json());
    const key = requireIdempotencyKey(request);
    await reconcileDueServiceCycles();
    const result = await runIdempotent({
      scope: `replacement-request:${input.assignmentId}:${client.id}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT id FROM app.coach_assignments WHERE id = ${input.assignmentId} FOR UPDATE`,
          );
          const [assignment] = await transaction
            .select({
              id: coachAssignments.id,
              coachUserId: coachAssignments.coachUserId,
              purchaseId: coachAssignments.purchaseId,
              planCode: plans.code,
              planName: plans.name,
            })
            .from(coachAssignments)
            .innerJoin(
              planPurchases,
              eq(planPurchases.id, coachAssignments.purchaseId),
            )
            .innerJoin(plans, eq(plans.id, planPurchases.planId))
            .where(
              and(
                eq(coachAssignments.id, input.assignmentId),
                eq(coachAssignments.clientUserId, client.id),
                eq(coachAssignments.status, "assigned"),
                eq(planPurchases.status, "active"),
              ),
            )
            .limit(1);
          if (!assignment?.coachUserId) {
            throw new HttpError(
              404,
              "assignment_not_replaceable",
              "An active coach assignment was not found.",
            );
          }
          if (assignment.coachUserId === input.desiredCoachUserId) {
            throw new HttpError(
              400,
              "coach_unchanged",
              "Select a different coach for the next service cycle.",
            );
          }

          const [currentCycle] = await transaction
            .select()
            .from(serviceCycles)
            .where(
              and(
                eq(serviceCycles.assignmentId, assignment.id),
                eq(serviceCycles.status, "active"),
              ),
            )
            .limit(1);
          if (!currentCycle) {
            throw new HttpError(
              409,
              "service_cycle_unavailable",
              "No active 30-day service cycle is available.",
            );
          }
          const [nextCycle] = await transaction
            .select({ id: serviceCycles.id })
            .from(serviceCycles)
            .where(
              and(
                eq(serviceCycles.purchaseId, assignment.purchaseId),
                eq(serviceCycles.cycleNumber, currentCycle.cycleNumber + 1),
                eq(serviceCycles.status, "scheduled"),
              ),
            )
            .limit(1);
          if (!nextCycle) {
            throw new HttpError(
              409,
              "final_cycle",
              "Coach switching is unavailable because this is the plan's final service cycle.",
            );
          }
          const [existing] = await transaction
            .select({ id: replacementRequests.id })
            .from(replacementRequests)
            .where(
              and(
                eq(replacementRequests.assignmentId, assignment.id),
                eq(replacementRequests.cycleNumber, currentCycle.cycleNumber),
                inArray(replacementRequests.status, ["requested", "approved"]),
              ),
            )
            .limit(1);
          if (existing) {
            throw new HttpError(
              409,
              "switch_request_exists",
              "A pending or accepted switch request already exists for this service cycle.",
            );
          }
          const [otherPending] = await transaction
            .select({ id: replacementRequests.id })
            .from(replacementRequests)
            .where(
              and(
                eq(replacementRequests.requestedByUserId, client.id),
                eq(replacementRequests.status, "requested"),
              ),
            )
            .limit(1);
          if (otherPending) {
            throw new HttpError(
              409,
              "pending_switch_request_exists",
              "Only one pending coach switch request may exist at a time.",
            );
          }

          await transaction.execute(
            sql`SELECT user_id FROM app.coach_profiles WHERE user_id = ${input.desiredCoachUserId} FOR UPDATE`,
          );
          const [desiredCoach] = await transaction
            .select()
            .from(coachProfiles)
            .where(
              and(
                eq(coachProfiles.userId, input.desiredCoachUserId),
                activeCoachConditions(),
                eq(coachProfiles.acceptingClients, true),
              ),
            )
            .limit(1);
          if (!desiredCoach) {
            throw new HttpError(
              409,
              "coach_unavailable",
              "The selected coach is not currently available.",
            );
          }
          if (!coachCanServePlan(desiredCoach, { code: assignment.planCode, name: assignment.planName })) {
            throw new HttpError(
              409,
              "coach_plan_ineligible",
              "This coach is not eligible for the Athlete / Executive Performance plan.",
            );
          }
          const createdAt = new Date();
          const responseDeadlineAt = new Date(
            createdAt.getTime() + SWITCH_RESPONSE_WINDOW_MS,
          );
          const [replacement] = await transaction
            .insert(replacementRequests)
            .values({
              assignmentId: assignment.id,
              requestedByUserId: client.id,
              desiredCoachUserId: input.desiredCoachUserId,
              cycleNumber: currentCycle.cycleNumber,
              reasonCode: input.reasonCode,
              privateDetails: input.reason,
              responseDeadlineAt,
              status: "requested",
            })
            .returning({
              id: replacementRequests.id,
              status: replacementRequests.status,
            });
          await transaction.insert(scheduledJobs).values({
            jobType: "expire_replacement_request",
            deduplicationKey: `expire_replacement_request:${replacement.id}`,
            payload: { replacementId: replacement.id },
            runAt:
              responseDeadlineAt < currentCycle.endsAt
                ? responseDeadlineAt
                : currentCycle.endsAt,
          });
          await transaction.insert(notifications).values({
            userId: input.desiredCoachUserId,
            type: "switch.request_received",
            title: "Coach switch request",
            body: `A client requested you for their next 30-day service cycle. Respond by ${responseDeadlineAt.toLocaleString("en-IN")}.`,
            actionUrl: "/coach/switch-requests",
            metadata: {
              replacementId: replacement.id,
              assignmentId: assignment.id,
            },
          });
          await transaction.insert(auditLogs).values({
            actorUserId: client.id,
            action: "replacement.requested",
            targetType: "replacement_request",
            targetId: replacement.id,
            requestId,
            safeMetadata: { cycleNumber: currentCycle.cycleNumber },
          });
          return replacement;
        });
        return { reference: value.id, value };
      },
    });
    return NextResponse.json({
      replacement: result.value,
      reference: result.reference,
      replayed: result.replayed,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
