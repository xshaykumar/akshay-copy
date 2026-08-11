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
  replacementRequests,
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
  expireSwitchRequest,
  reconcileDueServiceCycles,
} from "@/lib/service-cycles/lifecycle";

const responseSchema = z.object({
  decision: z.enum(["accept", "reject"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ replacementId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireRole("coach");
    const { replacementId } = await context.params;
    const id = z.uuid().parse(replacementId);
    const input = responseSchema.parse(await request.json());
    const key = requireIdempotencyKey(request);
    await reconcileDueServiceCycles();
    await expireSwitchRequest(id);

    const result = await runIdempotent({
      scope: `replacement-response:${id}:${coach.id}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT id FROM app.replacement_requests WHERE id = ${id} FOR UPDATE`,
          );
          const [replacement] = await transaction
            .select()
            .from(replacementRequests)
            .where(
              and(
                eq(replacementRequests.id, id),
                eq(replacementRequests.desiredCoachUserId, coach.id),
              ),
            )
            .limit(1);
          if (
            replacement &&
            ((input.decision === "accept" &&
              replacement.status === "approved") ||
              (input.decision === "reject" &&
                replacement.status === "declined"))
          ) {
            return { id, status: replacement.status };
          }
          if (
            !replacement ||
            replacement.status !== "requested" ||
            !replacement.responseDeadlineAt ||
            replacement.responseDeadlineAt <= new Date() ||
            !replacement.cycleNumber
          ) {
            throw new HttpError(
              409,
              "switch_request_unavailable",
              "This switch request is no longer awaiting a response.",
            );
          }
          const [activeCycle] = await transaction
            .select({ id: serviceCycles.id })
            .from(serviceCycles)
            .where(
              and(
                eq(serviceCycles.assignmentId, replacement.assignmentId),
                eq(serviceCycles.cycleNumber, replacement.cycleNumber),
                eq(serviceCycles.status, "active"),
              ),
            )
            .limit(1);
          if (!activeCycle) {
            throw new HttpError(
              409,
              "service_cycle_ended",
              "The service cycle has ended, so this request has expired.",
            );
          }

          if (input.decision === "accept") {
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
            const [plan] = await transaction
              .select({ code: plans.code, name: plans.name })
              .from(coachAssignments)
              .innerJoin(
                planPurchases,
                eq(planPurchases.id, coachAssignments.purchaseId),
              )
              .innerJoin(plans, eq(plans.id, planPurchases.planId))
              .where(eq(coachAssignments.id, replacement.assignmentId))
              .limit(1);
            if (!plan || !coachCanServePlan(profile, plan)) {
              throw new HttpError(
                409,
                "coach_plan_ineligible",
                "Your approved qualifications are not eligible for the Athlete / Executive Performance plan.",
              );
            }
          }

          const respondedAt = new Date();
          const [updated] = await transaction
            .update(replacementRequests)
            .set({
              status:
                input.decision === "accept" ? "approved" : "declined",
              respondedAt,
              updatedAt: respondedAt,
            })
            .where(
              and(
                eq(replacementRequests.id, id),
                eq(replacementRequests.status, "requested"),
              ),
            )
            .returning({
              id: replacementRequests.id,
              status: replacementRequests.status,
            });
          if (!updated) {
            throw new HttpError(
              409,
              "switch_response_race",
              "The request was already answered or expired.",
            );
          }
          await transaction.insert(auditLogs).values({
            actorUserId: coach.id,
            action:
              input.decision === "accept"
                ? "replacement.accepted"
                : "replacement.rejected",
            targetType: "replacement_request",
            targetId: id,
            requestId,
            safeMetadata: { cycleNumber: replacement.cycleNumber },
          });
          await transaction.insert(notifications).values({
            userId: replacement.requestedByUserId,
            type:
              input.decision === "accept"
                ? "switch.request_accepted"
                : "switch.request_rejected",
            title:
              input.decision === "accept"
                ? "Coach switch accepted"
                : "Coach switch declined",
            body:
              input.decision === "accept"
                ? "Your selected coach accepted. The switch will take effect when your current 30-day cycle ends."
                : "Your selected coach declined. You may submit another request during the current cycle.",
            actionUrl: "/client/replacement",
            metadata: {
              replacementId: id,
              cycleNumber: replacement.cycleNumber,
            },
          });
          if (input.decision === "accept") {
            const [currentAssignment] = await transaction
              .select({ coachUserId: coachAssignments.coachUserId })
              .from(coachAssignments)
              .where(eq(coachAssignments.id, replacement.assignmentId))
              .limit(1);
            if (
              currentAssignment?.coachUserId &&
              currentAssignment.coachUserId !== coach.id
            ) {
              await transaction.insert(notifications).values({
                userId: currentAssignment.coachUserId,
                type: "switch.client_leaving",
                title: "Coach switch scheduled",
                body: "An accepted coach switch is scheduled. You remain assigned through the end of the current 30-day cycle.",
                actionUrl: "/coach/clients",
                metadata: {
                  replacementId: id,
                  cycleNumber: replacement.cycleNumber,
                },
              });
            }
          }
          return updated;
        });
        return { reference: id, value };
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
