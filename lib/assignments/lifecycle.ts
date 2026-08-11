import "server-only";

import { and, eq, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  coachProfiles,
  coachSelectionRequests,
  notifications,
  planPurchases,
  plans,
  scheduledJobs,
  users,
} from "@/db/schema";
import { activeCoachConditions } from "@/lib/coaches/activation";
import { coachCanServePlan } from "@/lib/plans/coach-eligibility";
import {
  nextAssignmentPhase,
  type AssignmentPhase,
} from "./lifecycle-state";

export { CLIENT_SELECTION_WINDOW_MS } from "./lifecycle-state";

function transitionJob(next: AssignmentPhase, assignmentId: string) {
  const selection = next.status === "selection";
  return {
    jobType: selection
      ? "expire_coach_selection"
      : "expire_coach_application",
    deduplicationKey: `${
      selection ? "expire_coach_selection" : "expire_coach_application"
    }:${assignmentId}:cycle:${next.cycleNumber}`,
    payload: { assignmentId },
    runAt: selection
      ? next.selectionWindowEndsAt
      : (next.applicationWindowEndsAt as Date),
  };
}

export async function reconcileAssignmentLifecycle(
  assignmentId: string,
  now = new Date(),
) {
  return getDb().transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT id FROM app.coach_assignments WHERE id = ${assignmentId} FOR UPDATE`,
    );
    const [record] = await transaction
      .select()
      .from(coachAssignments)
      .where(eq(coachAssignments.id, assignmentId))
      .limit(1);
    if (!record) return null;

    let current: AssignmentPhase = {
      status:
        record.status === "open_pool" ? "open_pool" : "selection",
      selectionWindowEndsAt: record.selectionWindowEndsAt,
      applicationWindowEndsAt: record.applicationWindowEndsAt,
      cycleNumber: record.cycleNumber,
      refundEligibleAt: record.refundEligibleAt,
    };

    if (!["selection", "open_pool"].includes(record.status)) return record;

    for (let transitionCount = 0; transitionCount < 100; transitionCount += 1) {
      const next = nextAssignmentPhase(current, now);
      if (!next) break;

      if (next.status === "open_pool") {
        const pendingRequests = await transaction
          .select({
            id: coachSelectionRequests.id,
            coachUserId: coachSelectionRequests.coachUserId,
          })
          .from(coachSelectionRequests)
          .where(
            and(
              eq(coachSelectionRequests.assignmentId, assignmentId),
              eq(coachSelectionRequests.selectionRound, current.cycleNumber),
              eq(coachSelectionRequests.status, "pending"),
            ),
          );
        await transaction
          .update(coachSelectionRequests)
          .set({ status: "expired", respondedAt: now, updatedAt: now })
          .where(
            and(
              eq(coachSelectionRequests.assignmentId, assignmentId),
              eq(coachSelectionRequests.selectionRound, current.cycleNumber),
              eq(coachSelectionRequests.status, "pending"),
            ),
          );
        const [plan] = await transaction
          .select({ code: plans.code, name: plans.name })
          .from(planPurchases)
          .innerJoin(plans, eq(plans.id, planPurchases.planId))
          .where(eq(planPurchases.id, record.purchaseId))
          .limit(1);
        const candidateCoaches =
          next.applicationWindowEndsAt &&
          next.applicationWindowEndsAt > now
            ? await transaction
                .select({
                  userId: coachProfiles.userId,
                  athleteExecutiveEligible:
                    coachProfiles.athleteExecutiveEligible,
                })
                .from(coachProfiles)
                .innerJoin(users, eq(users.id, coachProfiles.userId))
                .where(
                  and(
                    activeCoachConditions(),
                    eq(coachProfiles.acceptingClients, true),
                    eq(users.status, "active"),
                  ),
                )
            : [];
        const eligibleCoaches = plan
          ? candidateCoaches.filter((coach) => coachCanServePlan(coach, plan))
          : candidateCoaches;
        await transaction.insert(notifications).values([
          {
            userId: record.clientUserId,
            type: "assignment.pool_opened",
            title: "Open Coach Pool started",
            body: "No requested coach accepted within 24 hours. Active coaches can now apply for the next six days.",
            actionUrl: "/client",
            metadata: {
              assignmentId,
              selectionRound: current.cycleNumber,
            },
          },
          ...pendingRequests.map((pending) => ({
            userId: pending.coachUserId,
            type: "assignment.request_expired",
            title: "Coaching request expired",
            body: "The 24-hour response window ended before this request was accepted.",
            actionUrl: "/coach/opportunities",
            metadata: {
              assignmentId,
              selectionRequestId: pending.id,
            },
          })),
          ...eligibleCoaches.map((coach) => ({
            userId: coach.userId,
            type: "assignment.pool_opportunity",
            title: "New coaching opportunity",
            body: "A client has entered the six-day coaching pool. The first eligible coach to apply will be assigned.",
            actionUrl: "/coach/opportunities",
            metadata: { assignmentId },
          })),
        ]);
      } else {
        await transaction.insert(notifications).values({
          userId: record.clientUserId,
          type: "assignment.selection_reopened",
          title: "Choose coaches again",
          body: "No coach applied during the six-day pool. A new 24-hour selection window is open, and you may now request a refund instead.",
          actionUrl: "/client/coaches",
          metadata: {
            assignmentId,
            selectionRound: next.cycleNumber,
            refundEligible: true,
          },
        });
      }

      await transaction
        .update(coachAssignments)
        .set({
          status: next.status,
          selectionWindowEndsAt: next.selectionWindowEndsAt,
          applicationWindowEndsAt: next.applicationWindowEndsAt,
          cycleNumber: next.cycleNumber,
          refundEligibleAt: next.refundEligibleAt,
          updatedAt: now,
        })
        .where(eq(coachAssignments.id, assignmentId));
      await transaction
        .insert(scheduledJobs)
        .values(transitionJob(next, assignmentId))
        .onConflictDoNothing();
      await transaction.insert(auditLogs).values({
        action:
          next.status === "open_pool"
            ? "assignment.application_window_opened"
            : "assignment.selection_window_reopened",
        targetType: "coach_assignment",
        targetId: assignmentId,
        safeMetadata: { cycleNumber: next.cycleNumber },
      });
      current = next;
    }

    const [updated] = await transaction
      .select()
      .from(coachAssignments)
      .where(eq(coachAssignments.id, assignmentId))
      .limit(1);
    return updated ?? null;
  });
}

export async function reconcileDueAssignmentLifecycles(
  limit = 100,
  now = new Date(),
) {
  const due = await getDb()
    .select({ id: coachAssignments.id })
    .from(coachAssignments)
    .where(
      or(
        and(
          eq(coachAssignments.status, "selection"),
          lte(coachAssignments.selectionWindowEndsAt, now),
        ),
        and(
          eq(coachAssignments.status, "open_pool"),
          lte(coachAssignments.applicationWindowEndsAt, now),
        ),
      ),
    )
    .limit(limit);

  for (const assignment of due) {
    await reconcileAssignmentLifecycle(assignment.id, now);
  }

  return due.length;
}
