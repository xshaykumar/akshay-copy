import { and, eq, sql } from "drizzle-orm";
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
} from "@/db/schema";
import { activateAssignedPurchase } from "@/lib/assignments/activate";
import { reconcileAssignmentLifecycle } from "@/lib/assignments/lifecycle";
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

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireRole("coach");
    const { assignmentId } = await context.params;
    const id = z.uuid().parse(assignmentId);
    const key = requireIdempotencyKey(request);
    await reconcileAssignmentLifecycle(id);

    const result = await runIdempotent({
      scope: `claim-assignment:${id}:${coach.id}`,
      key,
      requestHash: hashRequest({ id }),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT id FROM app.coach_assignments WHERE id = ${id} FOR UPDATE`,
          );
          const [assignment] = await transaction
            .select({
              id: coachAssignments.id,
              purchaseId: coachAssignments.purchaseId,
              clientUserId: coachAssignments.clientUserId,
              status: coachAssignments.status,
              coachUserId: coachAssignments.coachUserId,
              applicationWindowEndsAt:
                coachAssignments.applicationWindowEndsAt,
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
                eq(coachAssignments.id, id),
                eq(planPurchases.status, "paid"),
              ),
            )
            .limit(1);
          if (
            assignment?.status === "assigned" &&
            assignment.coachUserId === coach.id
          ) {
            return { assignmentId: id, status: "assigned" as const };
          }
          if (
            !assignment ||
            assignment.status !== "open_pool" ||
            !assignment.applicationWindowEndsAt ||
            assignment.applicationWindowEndsAt <= new Date()
          ) {
            throw new HttpError(
              409,
              "assignment_unavailable",
              "This client is no longer available in the pool.",
            );
          }

          await transaction.execute(
            sql`SELECT user_id FROM app.coach_profiles WHERE user_id = ${coach.id} FOR UPDATE`,
          );
          const [profile] = await transaction
            .select()
            .from(coachProfiles)
            .where(
              and(
                eq(coachProfiles.userId, coach.id),
                activeCoachConditions(),
                eq(coachProfiles.acceptingClients, true),
              ),
            )
            .limit(1);
          if (!profile) {
            throw new HttpError(
              403,
              "coach_unavailable",
              "An active coach profile accepting clients is required.",
            );
          }
          if (!coachCanServePlan(profile, { code: assignment.planCode, name: assignment.planName })) {
            throw new HttpError(
              403,
              "coach_plan_ineligible",
              "Your approved qualifications are not eligible for the Athlete / Executive Performance plan.",
            );
          }
          const assignedAt = new Date();
          const [updated] = await transaction
            .update(coachAssignments)
            .set({
              coachUserId: coach.id,
              status: "assigned",
              assignedAt,
              applicationWindowEndsAt: null,
              updatedAt: assignedAt,
            })
            .where(
              and(
                eq(coachAssignments.id, id),
                eq(coachAssignments.status, "open_pool"),
              ),
            )
            .returning({ id: coachAssignments.id });
          if (!updated) {
            throw new HttpError(
              409,
              "assignment_race",
              "Another coach applied first.",
            );
          }

          await activateAssignedPurchase(transaction, {
            assignmentId: assignment.id,
            purchaseId: assignment.purchaseId,
            clientUserId: assignment.clientUserId,
            coachUserId: coach.id,
            activatedAt: assignedAt,
          });
          await transaction.insert(notifications).values([
            {
              userId: assignment.clientUserId,
              type: "assignment.pool_claimed",
              title: "A coach has joined your plan",
              body: "Congratulations! A coach applied through the Open Coach Pool and your first 30-day service cycle has started.",
              actionUrl: "/client",
              metadata: { assignmentId: assignment.id, coachUserId: coach.id },
            },
            {
              userId: coach.id,
              type: "assignment.pool_claimed",
              title: "New coaching assignment",
              body: "You were the first coach to apply. The client is now assigned to you.",
              actionUrl: "/coach/clients",
              metadata: {
                assignmentId: assignment.id,
                clientUserId: assignment.clientUserId,
              },
            },
          ]);
          await transaction.insert(auditLogs).values({
            actorUserId: coach.id,
            action: "assignment.claimed",
            targetType: "coach_assignment",
            targetId: id,
            requestId,
          });
          return { assignmentId: id, status: "assigned" as const };
        });
        return { reference: id, value };
      },
    });
    return NextResponse.json({
      assignment: result.value,
      reference: result.reference,
      replayed: result.replayed,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
