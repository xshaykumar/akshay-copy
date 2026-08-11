import "server-only";

import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  coachingSessions,
  notifications,
  planPurchases,
  replacementRequests,
  scheduledJobs,
  serviceCycles,
} from "@/db/schema";
import { reconcileDuePlanUpgrades } from "@/lib/plans/upgrade";

export const SWITCH_RESPONSE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export async function expireSwitchRequest(
  replacementId: string,
  now = new Date(),
) {
  const [expired] = await getDb()
    .update(replacementRequests)
    .set({ status: "completed", respondedAt: now, updatedAt: now })
    .where(
      and(
        eq(replacementRequests.id, replacementId),
        eq(replacementRequests.status, "requested"),
        lte(replacementRequests.responseDeadlineAt, now),
      ),
    )
    .returning({
      id: replacementRequests.id,
      clientUserId: replacementRequests.requestedByUserId,
    });
  if (expired) {
    await getDb().insert(notifications).values({
      userId: expired.clientUserId,
      type: "switch.request_expired",
      title: "Coach switch request expired",
      body: "The selected coach did not respond within two days. You may submit another request during this cycle.",
      actionUrl: "/client/replacement",
      metadata: { replacementId: expired.id },
    });
  }
  return Boolean(expired);
}

export async function expireDueSwitchRequests(now = new Date()) {
  const expired = await getDb()
    .update(replacementRequests)
    .set({ status: "completed", respondedAt: now, updatedAt: now })
    .where(
      and(
        eq(replacementRequests.status, "requested"),
        lte(replacementRequests.responseDeadlineAt, now),
      ),
    )
    .returning({
      id: replacementRequests.id,
      clientUserId: replacementRequests.requestedByUserId,
    });
  if (expired.length > 0) {
    await getDb().insert(notifications).values(
      expired.map((request) => ({
        userId: request.clientUserId,
        type: "switch.request_expired",
        title: "Coach switch request expired",
        body: "The selected coach did not respond within two days. You may submit another request during this cycle.",
        actionUrl: "/client/replacement",
        metadata: { replacementId: request.id },
      })),
    );
  }
  return expired.length;
}

async function completeOneServiceCycle(serviceCycleId: string, now: Date) {
  return getDb().transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT id FROM app.service_cycles WHERE id = ${serviceCycleId} FOR UPDATE`,
    );
    const [cycle] = await transaction
      .select()
      .from(serviceCycles)
      .where(eq(serviceCycles.id, serviceCycleId))
      .limit(1);
    if (!cycle || cycle.status !== "active" || cycle.endsAt > now) {
      return null;
    }
    if (!cycle.coachUserId) {
      throw new Error("An active service cycle must have an assigned coach.");
    }

    await transaction
      .update(serviceCycles)
      .set({
        status: "completed",
        completedAt: cycle.endsAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(serviceCycles.id, cycle.id),
          eq(serviceCycles.status, "active"),
        ),
      );

    await transaction
      .update(replacementRequests)
      .set({ status: "completed", respondedAt: cycle.endsAt, updatedAt: now })
      .where(
        and(
          eq(replacementRequests.assignmentId, cycle.assignmentId),
          eq(replacementRequests.cycleNumber, cycle.cycleNumber),
          eq(replacementRequests.status, "requested"),
        ),
      );

    const [acceptedSwitch] = await transaction
      .select({
        id: replacementRequests.id,
        desiredCoachUserId: replacementRequests.desiredCoachUserId,
      })
      .from(replacementRequests)
      .where(
        and(
          eq(replacementRequests.assignmentId, cycle.assignmentId),
          eq(replacementRequests.cycleNumber, cycle.cycleNumber),
          eq(replacementRequests.status, "approved"),
        ),
      )
      .limit(1);
    const nextCoachUserId =
      acceptedSwitch?.desiredCoachUserId ?? cycle.coachUserId;

    const [nextCycle] = await transaction
      .select()
      .from(serviceCycles)
      .where(
        and(
          eq(serviceCycles.purchaseId, cycle.purchaseId),
          eq(serviceCycles.cycleNumber, cycle.cycleNumber + 1),
        ),
      )
      .limit(1);

    if (nextCycle) {
      await transaction
        .update(serviceCycles)
        .set({
          coachUserId: nextCoachUserId,
          status: "active",
          updatedAt: now,
        })
        .where(
          and(
            eq(serviceCycles.id, nextCycle.id),
            eq(serviceCycles.status, "scheduled"),
          ),
        );
      await transaction
        .update(coachAssignments)
        .set({
          coachUserId: nextCoachUserId,
          status: "assigned",
          assignedAt: acceptedSwitch ? nextCycle.startsAt : undefined,
          cycleNumber: nextCycle.cycleNumber,
          updatedAt: now,
        })
        .where(eq(coachAssignments.id, cycle.assignmentId));
      if (acceptedSwitch) {
        await transaction
          .update(coachingSessions)
          .set({
            status: "cancelled",
            cancellationReason:
              "Coach switch became effective at the service-cycle boundary.",
            updatedAt: now,
          })
          .where(
            and(
              eq(coachingSessions.assignmentId, cycle.assignmentId),
              eq(coachingSessions.coachUserId, cycle.coachUserId),
              eq(coachingSessions.status, "scheduled"),
              sql`${coachingSessions.startsAt} >= ${nextCycle.startsAt}`,
            ),
          );
        await transaction
          .update(replacementRequests)
          .set({ appliedAt: nextCycle.startsAt, updatedAt: now })
          .where(eq(replacementRequests.id, acceptedSwitch.id));
        await transaction.insert(notifications).values([
          {
            userId: cycle.clientUserId,
            type: "switch.applied",
            title: "Your new coach is active",
            body: `Your accepted coach switch took effect at the start of service cycle ${nextCycle.cycleNumber}.`,
            actionUrl: "/client",
            metadata: {
              assignmentId: cycle.assignmentId,
              cycleNumber: nextCycle.cycleNumber,
            },
          },
          {
            userId: cycle.coachUserId,
            type: "switch.client_transferred",
            title: "Coach switch completed",
            body: "The accepted coach switch has taken effect. Your assignment with this client has ended.",
            actionUrl: "/coach",
            metadata: {
              assignmentId: cycle.assignmentId,
              cycleNumber: cycle.cycleNumber,
            },
          },
          {
            userId: nextCoachUserId,
            type: "switch.client_started",
            title: "New assignment is active",
            body: `Your new 30-day service cycle ${nextCycle.cycleNumber} has started.`,
            actionUrl: "/coach/clients",
            metadata: {
              assignmentId: cycle.assignmentId,
              cycleNumber: nextCycle.cycleNumber,
            },
          },
        ]);
      } else {
        await transaction.insert(notifications).values({
          userId: cycle.clientUserId,
          type: "service_cycle.started",
          title: "New service cycle started",
          body: `Your 30-day service cycle ${nextCycle.cycleNumber} has started with your current coach.`,
          actionUrl: "/client",
          metadata: {
            assignmentId: cycle.assignmentId,
            cycleNumber: nextCycle.cycleNumber,
          },
        });
      }
      await transaction
        .insert(scheduledJobs)
        .values({
          jobType: "complete_service_cycle",
          deduplicationKey: `complete_service_cycle:${nextCycle.id}`,
          payload: {
            assignmentId: cycle.assignmentId,
            serviceCycleId: nextCycle.id,
          },
          runAt: nextCycle.endsAt,
        })
        .onConflictDoNothing();
    } else {
      await transaction
        .update(coachAssignments)
        .set({ status: "ended", endedAt: cycle.endsAt, updatedAt: now })
        .where(eq(coachAssignments.id, cycle.assignmentId));
      await transaction
        .update(planPurchases)
        .set({ status: "completed", expiresAt: cycle.endsAt, updatedAt: now })
        .where(eq(planPurchases.id, cycle.purchaseId));
      await transaction.insert(notifications).values({
        userId: cycle.clientUserId,
        type: "plan.completed",
        title: "Plan completed",
        body: "Congratulations on completing your coaching plan. Your final service cycle is now complete.",
        actionUrl: "/client/plan",
        metadata: { purchaseId: cycle.purchaseId },
      });
    }

    await transaction.insert(auditLogs).values({
      action: "service_cycle.completed",
      targetType: "service_cycle",
      targetId: cycle.id,
      safeMetadata: {
        cycleNumber: cycle.cycleNumber,
        coachChanged: Boolean(acceptedSwitch),
      },
    });
    return nextCycle?.id ?? null;
  });
}

export async function reconcileServiceCycle(
  serviceCycleId: string,
  now = new Date(),
) {
  let currentId: string | null = serviceCycleId;
  for (let count = 0; currentId && count < 3; count += 1) {
    currentId = await completeOneServiceCycle(currentId, now);
  }
}

export async function reconcileDueServiceCycles(
  limit = 100,
  now = new Date(),
) {
  const due = await getDb()
    .select({ id: serviceCycles.id })
    .from(serviceCycles)
    .where(
      and(
        eq(serviceCycles.status, "active"),
        lte(serviceCycles.endsAt, now),
      ),
    )
    .limit(limit);
  for (const cycle of due) {
    await reconcileServiceCycle(cycle.id, now);
  }
  await reconcileDuePlanUpgrades(limit, now);
  await expireDueSwitchRequests(now);
  return due.length;
}

export async function closeLegacyActiveSwitches(assignmentId: string) {
  await getDb()
    .update(replacementRequests)
    .set({ status: "completed", updatedAt: new Date() })
    .where(
      and(
        eq(replacementRequests.assignmentId, assignmentId),
        inArray(replacementRequests.status, [
          "requested",
          "reviewing",
          "approved",
        ]),
      ),
    );
}
