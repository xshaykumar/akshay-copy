import { and, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  coachProfiles,
  coachSelectionRequests,
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

const responseSchema = z.object({
  decision: z.enum(["accept", "reject"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireRole("coach");
    const { requestId: selectionRequestId } = await context.params;
    const id = z.uuid().parse(selectionRequestId);
    const input = responseSchema.parse(await request.json());
    const key = requireIdempotencyKey(request);

    const [requestRecord] = await getDb()
      .select({ assignmentId: coachSelectionRequests.assignmentId })
      .from(coachSelectionRequests)
      .where(
        and(
          eq(coachSelectionRequests.id, id),
          eq(coachSelectionRequests.coachUserId, coach.id),
        ),
      )
      .limit(1);
    if (!requestRecord) {
      throw new HttpError(
        404,
        "selection_request_not_found",
        "The coach request was not found.",
      );
    }
    await reconcileAssignmentLifecycle(requestRecord.assignmentId);

    const result = await runIdempotent({
      scope: `coach-selection-response:${id}:${coach.id}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT id FROM app.coach_assignments WHERE id = ${requestRecord.assignmentId} FOR UPDATE`,
          );
          const [selectionRequest] = await transaction
            .select()
            .from(coachSelectionRequests)
            .where(
              and(
                eq(coachSelectionRequests.id, id),
                eq(coachSelectionRequests.coachUserId, coach.id),
              ),
            )
            .limit(1);
          if (
            selectionRequest &&
            ((input.decision === "accept" &&
              selectionRequest.status === "accepted") ||
              (input.decision === "reject" &&
                selectionRequest.status === "rejected"))
          ) {
            return { id, status: selectionRequest.status };
          }

          const [assignment] = await transaction
            .select({
              id: coachAssignments.id,
              clientUserId: coachAssignments.clientUserId,
              purchaseId: coachAssignments.purchaseId,
              selectionRound: coachAssignments.cycleNumber,
              selectionWindowEndsAt: coachAssignments.selectionWindowEndsAt,
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
                eq(coachAssignments.id, requestRecord.assignmentId),
                eq(coachAssignments.status, "selection"),
                eq(planPurchases.status, "paid"),
              ),
            )
            .limit(1);
          const now = new Date();
          if (
            !selectionRequest ||
            selectionRequest.status !== "pending" ||
            selectionRequest.expiresAt <= now ||
            !assignment ||
            assignment.selectionWindowEndsAt <= now ||
            selectionRequest.selectionRound !== assignment.selectionRound
          ) {
            throw new HttpError(
              409,
              "selection_request_unavailable",
              "This client request is no longer awaiting a response.",
            );
          }

          if (input.decision === "reject") {
            const [updated] = await transaction
              .update(coachSelectionRequests)
              .set({
                status: "rejected",
                respondedAt: now,
                updatedAt: now,
              })
              .where(
                and(
                  eq(coachSelectionRequests.id, id),
                  eq(coachSelectionRequests.status, "pending"),
                ),
              )
              .returning({
                id: coachSelectionRequests.id,
                status: coachSelectionRequests.status,
              });
            if (!updated) {
              throw new HttpError(
                409,
                "selection_response_race",
                "The request was already answered or expired.",
              );
            }
            await transaction.insert(notifications).values({
              userId: assignment.clientUserId,
              type: "assignment.request_rejected",
              title: "Coach request declined",
              body: "A requested coach declined. You can send another request while your 24-hour window remains open.",
              actionUrl: "/client/coaches",
              metadata: {
                assignmentId: assignment.id,
                selectionRequestId: id,
              },
            });
            await transaction.insert(auditLogs).values({
              actorUserId: coach.id,
              action: "assignment.coach_request_rejected",
              targetType: "coach_selection_request",
              targetId: id,
              requestId,
            });
            return updated;
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
              409,
              "coach_unavailable",
              "Your profile must be active and accepting clients to accept.",
            );
          }
          if (!coachCanServePlan(profile, { code: assignment.planCode, name: assignment.planName })) {
            throw new HttpError(
              409,
              "coach_plan_ineligible",
              "Your approved qualifications are not eligible for the Athlete / Executive Performance plan.",
            );
          }
          const otherPending = await transaction
            .select({
              id: coachSelectionRequests.id,
              coachUserId: coachSelectionRequests.coachUserId,
            })
            .from(coachSelectionRequests)
            .where(
              and(
                eq(coachSelectionRequests.assignmentId, assignment.id),
                eq(
                  coachSelectionRequests.selectionRound,
                  assignment.selectionRound,
                ),
                eq(coachSelectionRequests.status, "pending"),
                ne(coachSelectionRequests.id, id),
              ),
            );
          const [assigned] = await transaction
            .update(coachAssignments)
            .set({
              coachUserId: coach.id,
              status: "assigned",
              assignedAt: now,
              applicationWindowEndsAt: null,
              updatedAt: now,
            })
            .where(
              and(
                eq(coachAssignments.id, assignment.id),
                eq(coachAssignments.status, "selection"),
              ),
            )
            .returning({ id: coachAssignments.id });
          if (!assigned) {
            throw new HttpError(
              409,
              "assignment_race",
              "Another coach was already assigned.",
            );
          }
          await transaction
            .update(coachSelectionRequests)
            .set({ status: "accepted", respondedAt: now, updatedAt: now })
            .where(eq(coachSelectionRequests.id, id));
          await transaction
            .update(coachSelectionRequests)
            .set({ status: "cancelled", respondedAt: now, updatedAt: now })
            .where(
              and(
                eq(coachSelectionRequests.assignmentId, assignment.id),
                eq(
                  coachSelectionRequests.selectionRound,
                  assignment.selectionRound,
                ),
                eq(coachSelectionRequests.status, "pending"),
              ),
            );
          await activateAssignedPurchase(transaction, {
            assignmentId: assignment.id,
            purchaseId: assignment.purchaseId,
            clientUserId: assignment.clientUserId,
            coachUserId: coach.id,
            activatedAt: now,
          });

          await transaction.insert(notifications).values([
            {
              userId: assignment.clientUserId,
              type: "assignment.confirmed",
              title: "Your coach is assigned",
              body: "Congratulations! A coach accepted your request and your first 30-day service cycle has started.",
              actionUrl: "/client",
              metadata: { assignmentId: assignment.id, coachUserId: coach.id },
            },
            {
              userId: coach.id,
              type: "assignment.confirmed",
              title: "New coaching assignment",
              body: "You accepted first. The client is now assigned to you and their first 30-day service cycle has started.",
              actionUrl: "/coach/clients",
              metadata: {
                assignmentId: assignment.id,
                clientUserId: assignment.clientUserId,
              },
            },
            ...otherPending.map((pending) => ({
              userId: pending.coachUserId,
              type: "assignment.request_closed",
              title: "Request closed",
              body: "Another requested coach accepted first, so this request is no longer available.",
              actionUrl: "/coach/opportunities",
              metadata: {
                assignmentId: assignment.id,
                selectionRequestId: pending.id,
              },
            })),
          ]);
          await transaction.insert(auditLogs).values({
            actorUserId: coach.id,
            action: "assignment.coach_request_accepted",
            targetType: "coach_assignment",
            targetId: assignment.id,
            requestId,
            safeMetadata: { selectionRequestId: id },
          });
          return { id, status: "accepted" };
        });
        return { reference: id, value };
      },
    });

    return NextResponse.json({
      selectionRequest: result.value,
      reference: result.reference,
      replayed: result.replayed,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
