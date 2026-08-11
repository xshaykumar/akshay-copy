import { and, count, eq, sql } from "drizzle-orm";
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
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { reconcileAssignmentLifecycle } from "@/lib/assignments/lifecycle";
import { activeCoachConditions } from "@/lib/coaches/activation";
import { coachCanServePlan } from "@/lib/plans/coach-eligibility";
import {
  clientCoachSelectionAvailabilitySchema,
  coachMatchesClientAvailability,
} from "@/lib/assignments/client-availability";
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

const selectionSchema = z.object({
  coachUserId: z.uuid(),
}).and(clientCoachSelectionAvailabilitySchema);

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const client = await requireRole("client");
    const { assignmentId } = await context.params;
    const id = z.uuid().parse(assignmentId);
    const input = selectionSchema.parse(await request.json());
    const key = requireIdempotencyKey(request);
    await reconcileAssignmentLifecycle(id);

    const result = await runIdempotent({
      scope: `select-coach:${id}:${client.id}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT id FROM app.coach_assignments WHERE id = ${id} FOR UPDATE`,
          );
          const [assignment] = await transaction
            .select({
              id: coachAssignments.id,
              purchaseId: coachAssignments.purchaseId,
              selectionRound: coachAssignments.cycleNumber,
              selectionWindowEndsAt: coachAssignments.selectionWindowEndsAt,
              clientAvailableDays: coachAssignments.clientAvailableDays,
              clientPreferredTime: coachAssignments.clientPreferredTime,
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
                eq(coachAssignments.clientUserId, client.id),
                eq(coachAssignments.status, "selection"),
                eq(planPurchases.status, "paid"),
              ),
            )
            .limit(1);
          const now = new Date();
          if (!assignment || assignment.selectionWindowEndsAt <= now) {
            throw new HttpError(
              409,
              "selection_window_unavailable",
              "The 24-hour coach-selection window is unavailable.",
            );
          }
          const savedDays = [...assignment.clientAvailableDays].sort();
          const requestedDays = [...input.selectedDays].sort();
          if (
            (savedDays.length > 0 || assignment.clientPreferredTime) &&
            (assignment.clientPreferredTime !== input.selectedTime ||
              savedDays.join("|") !== requestedDays.join("|"))
          ) {
            throw new HttpError(
              409,
              "selection_availability_locked",
              "Use the same selected days and time slot for every coach request in this matching round.",
            );
          }

          const [existing] = await transaction
            .select({
              id: coachSelectionRequests.id,
              status: coachSelectionRequests.status,
            })
            .from(coachSelectionRequests)
            .where(
              and(
                eq(coachSelectionRequests.assignmentId, assignment.id),
                eq(coachSelectionRequests.coachUserId, input.coachUserId),
                eq(
                  coachSelectionRequests.selectionRound,
                  assignment.selectionRound,
                ),
              ),
            )
            .limit(1);
          if (existing?.status === "pending") {
            return existing;
          }
          if (existing) {
            throw new HttpError(
              409,
              "coach_already_requested",
              "This coach has already responded during the current selection window.",
            );
          }

          const [pendingCount] = await transaction
            .select({ value: count() })
            .from(coachSelectionRequests)
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
          if (pendingCount.value >= 3) {
            throw new HttpError(
              409,
              "coach_request_limit",
              "You already have three pending coach requests.",
            );
          }

          const [coach] = await transaction
            .select({
              userId: coachProfiles.userId,
              displayName: users.displayName,
              athleteExecutiveEligible:
                coachProfiles.athleteExecutiveEligible,
              availableDays: coachProfiles.availableDays,
              availableTimeSlots: coachProfiles.availableTimeSlots,
            })
            .from(coachProfiles)
            .innerJoin(users, eq(users.id, coachProfiles.userId))
            .where(
              and(
                eq(coachProfiles.userId, input.coachUserId),
                activeCoachConditions(),
                eq(coachProfiles.acceptingClients, true),
                eq(users.status, "active"),
              ),
            )
            .limit(1);
          if (!coach) {
            throw new HttpError(
              409,
              "coach_unavailable",
              "The selected coach is not currently available.",
            );
          }
          if (!coachCanServePlan(coach, { code: assignment.planCode, name: assignment.planName })) {
            throw new HttpError(
              409,
              "coach_plan_ineligible",
              "This coach is not eligible for the Athlete / Executive Performance plan.",
            );
          }
          if (
            !coachMatchesClientAvailability(
              coach,
              input.selectedDays,
              input.selectedTime,
            )
          ) {
            throw new HttpError(
              409,
              "coach_availability_mismatch",
              "This coach is not available on any selected day at the selected time.",
            );
          }

          await transaction
            .update(coachAssignments)
            .set({
              clientAvailableDays: input.selectedDays,
              clientPreferredTime: input.selectedTime,
              updatedAt: now,
            })
            .where(eq(coachAssignments.id, assignment.id));

          const [selectionRequest] = await transaction
            .insert(coachSelectionRequests)
            .values({
              assignmentId: assignment.id,
              clientUserId: client.id,
              coachUserId: coach.userId,
              selectionRound: assignment.selectionRound,
              expiresAt: assignment.selectionWindowEndsAt,
            })
            .returning({
              id: coachSelectionRequests.id,
              status: coachSelectionRequests.status,
            });
          await transaction.insert(notifications).values([
            {
              userId: client.id,
              type: "assignment.request_sent",
              title: "Coach request sent",
              body: `Your request was sent to ${coach.displayName}. The first requested coach to accept will be assigned.`,
              actionUrl: "/client/coaches",
              metadata: {
                assignmentId: assignment.id,
                selectionRequestId: selectionRequest.id,
              },
            },
            {
              userId: coach.userId,
              type: "assignment.request_received",
              title: "New coaching request",
              body: `A client has requested you as their coach. Accept before ${assignment.selectionWindowEndsAt.toLocaleString("en-IN")}.`,
              actionUrl: "/coach/opportunities",
              metadata: {
                assignmentId: assignment.id,
                selectionRequestId: selectionRequest.id,
              },
            },
          ]);
          await transaction.insert(auditLogs).values({
            actorUserId: client.id,
            action: "assignment.coach_requested",
            targetType: "coach_selection_request",
            targetId: selectionRequest.id,
            requestId,
            safeMetadata: { selectionRound: assignment.selectionRound },
          });
          return selectionRequest;
        });

        return {
          reference: value.id,
          value,
        };
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
