import "server-only";

import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  notifications,
  planPurchases,
  planUpgrades,
  plans,
  serviceCycles,
} from "@/db/schema";
import { serviceCycleCount } from "@/lib/plans/duration";
import { calculateOnlineBasicUpgrade } from "@/lib/plans/upgrade-rules";

type AppTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export type OnlineBasicUpgradeOffer = {
  purchaseId: string;
  fromPlanId: string;
  toPlanId: string;
  fromPlanName: string;
  toPlanName: string;
  durationDays: number;
  currentCycleNumber: number;
  totalCycles: number;
  applicableCycles: number;
  amountPaise: number;
  currency: string;
  effectiveAt: Date;
  requestedOnCycleDayOne: boolean;
};

export async function getOnlineBasicUpgradeOffer(
  clientUserId: string,
  now = new Date(),
): Promise<OnlineBasicUpgradeOffer | null> {
  const db = getDb();
  const [purchase] = await db
    .select({
      id: planPurchases.id,
      planId: plans.id,
      planName: plans.name,
      planCode: plans.code,
      durationDays: plans.durationDays,
      pricePaise: plans.pricePaise,
      currency: plans.currency,
    })
    .from(planPurchases)
    .innerJoin(plans, eq(plans.id, planPurchases.planId))
    .where(
      and(
        eq(planPurchases.clientUserId, clientUserId),
        eq(planPurchases.status, "active"),
      ),
    )
    .limit(1);
  if (!purchase || !purchase.planCode.startsWith("online-basic-")) return null;

  const [existing] = await db
    .select({ id: planUpgrades.id })
    .from(planUpgrades)
    .where(
      and(
        eq(planUpgrades.purchaseId, purchase.id),
        sql`${planUpgrades.status} in ('payment_pending', 'scheduled', 'applied')`,
      ),
    )
    .limit(1);
  if (existing) return null;

  const totalCycles = serviceCycleCount(purchase.durationDays);
  const [cycle] = await db
    .select({
      cycleNumber: serviceCycles.cycleNumber,
      startsAt: serviceCycles.startsAt,
      endsAt: serviceCycles.endsAt,
    })
    .from(serviceCycles)
    .where(
      and(
        eq(serviceCycles.purchaseId, purchase.id),
        eq(serviceCycles.status, "active"),
      ),
    )
    .limit(1);
  if (!cycle || cycle.cycleNumber >= totalCycles) return null;

  const [[nextCycle], [targetPlan]] = await Promise.all([
    db
      .select({ startsAt: serviceCycles.startsAt })
      .from(serviceCycles)
      .where(
        and(
          eq(serviceCycles.purchaseId, purchase.id),
          eq(serviceCycles.cycleNumber, cycle.cycleNumber + 1),
        ),
      )
      .limit(1),
    db
      .select({
        id: plans.id,
        name: plans.name,
        pricePaise: plans.pricePaise,
        currency: plans.currency,
      })
      .from(plans)
      .where(
        and(
          eq(plans.code, `online-elite-${purchase.durationDays}`),
          eq(plans.active, true),
        ),
      )
      .limit(1),
  ]);
  if (!targetPlan || targetPlan.currency !== purchase.currency) return null;

  const calculated = calculateOnlineBasicUpgrade({
    now,
    cycleStartsAt: cycle.startsAt,
    cycleEndsAt: cycle.endsAt,
    nextCycleStartsAt: nextCycle?.startsAt ?? null,
    currentCycleNumber: cycle.cycleNumber,
    totalCycles,
    fromPlanPricePaise: purchase.pricePaise,
    toPlanPricePaise: targetPlan.pricePaise,
  });
  return {
    purchaseId: purchase.id,
    fromPlanId: purchase.planId,
    toPlanId: targetPlan.id,
    fromPlanName: purchase.planName,
    toPlanName: targetPlan.name,
    durationDays: purchase.durationDays,
    currentCycleNumber: cycle.cycleNumber,
    totalCycles,
    currency: purchase.currency,
    ...calculated,
  };
}

export async function applyPlanUpgradeInTransaction(
  transaction: AppTransaction,
  upgradeId: string,
  now = new Date(),
) {
  await transaction.execute(
    sql`SELECT id FROM app.plan_upgrades WHERE id = ${upgradeId} FOR UPDATE`,
  );
  const [upgrade] = await transaction
    .select({
      id: planUpgrades.id,
      status: planUpgrades.status,
      purchaseId: planUpgrades.purchaseId,
      clientUserId: planUpgrades.clientUserId,
      toPlanId: planUpgrades.toPlanId,
      toPlanName: plans.name,
      amountPaise: planUpgrades.amountPaise,
      effectiveAt: planUpgrades.effectiveAt,
      coachUserId: coachAssignments.coachUserId,
    })
    .from(planUpgrades)
    .innerJoin(plans, eq(plans.id, planUpgrades.toPlanId))
    .leftJoin(
      coachAssignments,
      eq(coachAssignments.purchaseId, planUpgrades.purchaseId),
    )
    .where(eq(planUpgrades.id, upgradeId))
    .limit(1);
  if (!upgrade || upgrade.status === "applied") return upgrade ?? null;
  if (upgrade.status !== "scheduled" || upgrade.effectiveAt > now) return null;

  const [updatedPurchase] = await transaction
    .update(planPurchases)
    .set({
      planId: upgrade.toPlanId,
      amountPaise: sql`${planPurchases.amountPaise} + ${upgrade.amountPaise}`,
      updatedAt: now,
    })
    .where(
      and(
        eq(planPurchases.id, upgrade.purchaseId),
        eq(planPurchases.status, "active"),
      ),
    )
    .returning({ id: planPurchases.id });
  if (!updatedPurchase) {
    throw new Error("The active purchase was unavailable when its upgrade became due.");
  }
  await transaction
    .update(planUpgrades)
    .set({ status: "applied", appliedAt: now, updatedAt: now })
    .where(eq(planUpgrades.id, upgrade.id));

  await transaction
    .insert(notifications)
    .values({
      userId: upgrade.clientUserId,
      type: "plan.upgrade_applied",
      deduplicationKey: `plan-upgrade-applied-client:${upgrade.id}`,
      title: "Your Online Elite upgrade is active",
      body: `Your coaching plan has been upgraded to ${upgrade.toPlanName}. The original expiry date remains unchanged.`,
      actionUrl: "/client/plan",
      metadata: { upgradeId: upgrade.id, purchaseId: upgrade.purchaseId },
    })
    .onConflictDoNothing();
  if (upgrade.coachUserId) {
    await transaction
      .insert(notifications)
      .values({
        userId: upgrade.coachUserId,
        type: "plan.client_upgrade_applied",
        deduplicationKey: `plan-upgrade-applied-coach:${upgrade.id}`,
        title: "A client plan has upgraded",
        body: `The assigned client's plan is now ${upgrade.toPlanName}.`,
        actionUrl: "/coach/clients",
        metadata: {
          upgradeId: upgrade.id,
          purchaseId: upgrade.purchaseId,
          clientUserId: upgrade.clientUserId,
        },
      })
      .onConflictDoNothing();
  }
  await transaction.insert(auditLogs).values({
    actorUserId: upgrade.clientUserId,
    action: "plan.upgrade_applied",
    targetType: "plan_upgrade",
    targetId: upgrade.id,
    safeMetadata: {
      purchaseId: upgrade.purchaseId,
      amountPaise: upgrade.amountPaise,
    },
  });
  return upgrade;
}

export async function reconcilePlanUpgrade(
  upgradeId: string,
  now = new Date(),
) {
  return getDb().transaction((transaction) =>
    applyPlanUpgradeInTransaction(transaction, upgradeId, now),
  );
}

export async function reconcileDuePlanUpgrades(
  limit = 100,
  now = new Date(),
) {
  const due = await getDb()
    .select({ id: planUpgrades.id })
    .from(planUpgrades)
    .where(
      and(
        eq(planUpgrades.status, "scheduled"),
        lte(planUpgrades.effectiveAt, now),
      ),
    )
    .limit(limit);
  for (const upgrade of due) await reconcilePlanUpgrade(upgrade.id, now);
  return due.length;
}
