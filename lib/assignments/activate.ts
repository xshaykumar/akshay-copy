import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  planPurchases,
  plans,
  scheduledJobs,
  serviceCycles,
} from "@/db/schema";
import {
  addElapsedDays,
  SERVICE_CYCLE_DAYS,
  serviceCycleCount,
} from "@/lib/plans/duration";

type AppTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export async function activateAssignedPurchase(
  transaction: AppTransaction,
  input: {
    assignmentId: string;
    purchaseId: string;
    clientUserId: string;
    coachUserId: string;
    activatedAt: Date;
  },
) {
  const [purchase] = await transaction
    .select({
      id: planPurchases.id,
      status: planPurchases.status,
      durationDays: plans.durationDays,
    })
    .from(planPurchases)
    .innerJoin(plans, eq(plans.id, planPurchases.planId))
    .where(eq(planPurchases.id, input.purchaseId))
    .limit(1);
  if (!purchase || !["paid", "active"].includes(purchase.status)) {
    throw new Error("The paid plan purchase could not be activated.");
  }

  const expiresAt = addElapsedDays(input.activatedAt, purchase.durationDays);
  await transaction
    .update(planPurchases)
    .set({
      status: "active",
      activatedAt: input.activatedAt,
      expiresAt,
      updatedAt: input.activatedAt,
    })
    .where(eq(planPurchases.id, purchase.id));

  const totalCycles = serviceCycleCount(purchase.durationDays);
  const rows = Array.from({ length: totalCycles }, (_, index) => {
    const cycleNumber = index + 1;
    const startsAt = addElapsedDays(
      input.activatedAt,
      index * SERVICE_CYCLE_DAYS,
    );
    return {
      purchaseId: purchase.id,
      assignmentId: input.assignmentId,
      clientUserId: input.clientUserId,
      coachUserId: cycleNumber === 1 ? input.coachUserId : null,
      cycleNumber,
      startsAt,
      endsAt:
        cycleNumber === totalCycles
          ? expiresAt
          : addElapsedDays(startsAt, SERVICE_CYCLE_DAYS),
      status:
        cycleNumber === 1 ? ("active" as const) : ("scheduled" as const),
    };
  });
  const cycles = await transaction
    .insert(serviceCycles)
    .values(rows)
    .onConflictDoNothing()
    .returning({
      id: serviceCycles.id,
      cycleNumber: serviceCycles.cycleNumber,
      endsAt: serviceCycles.endsAt,
    });
  const firstCycle =
    cycles.find((cycle) => cycle.cycleNumber === 1) ??
    (
      await transaction
        .select({
          id: serviceCycles.id,
          cycleNumber: serviceCycles.cycleNumber,
          endsAt: serviceCycles.endsAt,
        })
        .from(serviceCycles)
        .where(eq(serviceCycles.purchaseId, purchase.id))
        .limit(1)
    )[0];
  if (!firstCycle) {
    throw new Error("The first service cycle could not be created.");
  }

  await transaction
    .insert(scheduledJobs)
    .values({
      jobType: "complete_service_cycle",
      deduplicationKey: `complete_service_cycle:${firstCycle.id}`,
      payload: {
        assignmentId: input.assignmentId,
        serviceCycleId: firstCycle.id,
      },
      runAt: firstCycle.endsAt,
    })
    .onConflictDoNothing();

  return { expiresAt, totalCycles };
}
