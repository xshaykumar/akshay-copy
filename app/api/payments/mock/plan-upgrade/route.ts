import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  notifications,
  paymentOrders,
  planPurchases,
  planUpgrades,
  scheduledJobs,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { HttpError, assertSameOrigin, jsonError, requestIdFrom } from "@/lib/http/errors";
import { hashRequest, requireIdempotencyKey, runIdempotent } from "@/lib/idempotency";
import { getOnlineBasicUpgradeOffer } from "@/lib/plans/upgrade";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireRole("client");
    if (process.env.APP_ENV === "production" || process.env.PAYMENTS_MODE !== "mock") {
      throw new HttpError(404, "not_found", "This endpoint is unavailable.");
    }
    const key = requireIdempotencyKey(request);
    const quotedAt = new Date();
    await reconcileDueServiceCycles(100, quotedAt);
    const offer = await getOnlineBasicUpgradeOffer(user.id, quotedAt);
    if (!offer) {
      throw new HttpError(409, "plan_upgrade_unavailable", "An Online Basic to Online Elite upgrade is not currently available.");
    }
    const result = await runIdempotent({
      scope: `mock-plan-upgrade:${user.id}`,
      key,
      requestHash: hashRequest({ purchaseId: offer.purchaseId }),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${`mock-plan-upgrade:${user.id}`}))`,
          );
          const [purchase] = await transaction
            .select({ planId: planPurchases.planId, status: planPurchases.status })
            .from(planPurchases)
            .where(
              and(
                eq(planPurchases.id, offer.purchaseId),
                eq(planPurchases.clientUserId, user.id),
              ),
            )
            .limit(1);
          if (!purchase || purchase.status !== "active" || purchase.planId !== offer.fromPlanId) {
            throw new HttpError(409, "plan_upgrade_changed", "The plan changed before checkout. Refresh My Plan and try again.");
          }
          const [upgrade] = await transaction
            .insert(planUpgrades)
            .values({
              purchaseId: offer.purchaseId,
              clientUserId: user.id,
              fromPlanId: offer.fromPlanId,
              toPlanId: offer.toPlanId,
              status: "scheduled",
              amountPaise: offer.amountPaise,
              currency: offer.currency,
              applicableCycles: offer.applicableCycles,
              requestedAt: quotedAt,
              effectiveAt: offer.effectiveAt,
              paidAt: quotedAt,
            })
            .returning({ id: planUpgrades.id });
          const [payment] = await transaction
            .insert(paymentOrders)
            .values({
              userId: user.id,
              purchaseId: offer.purchaseId,
              purpose: "plan_upgrade",
              provider: "mock",
              providerReference: `mock_upgrade_${upgrade.id.replaceAll("-", "")}`,
              amountPaise: offer.amountPaise,
              currency: offer.currency,
              status: "captured",
              capturedAt: quotedAt,
            })
            .returning({ id: paymentOrders.id });
          await transaction
            .update(planUpgrades)
            .set({ paymentOrderId: payment.id, updatedAt: quotedAt })
            .where(eq(planUpgrades.id, upgrade.id));
          await transaction.insert(scheduledJobs).values({
            jobType: "apply_plan_upgrade",
            deduplicationKey: `apply_plan_upgrade:${upgrade.id}`,
            payload: { upgradeId: upgrade.id },
            runAt: offer.effectiveAt,
          });
          const [assignment] = await transaction
            .select({ coachUserId: coachAssignments.coachUserId })
            .from(coachAssignments)
            .where(eq(coachAssignments.purchaseId, offer.purchaseId))
            .limit(1);
          await transaction.insert(notifications).values({
            userId: user.id,
            type: "plan.upgrade_scheduled",
            deduplicationKey: `plan-upgrade-scheduled-client:${upgrade.id}`,
            title: "Your Online Elite upgrade is scheduled",
            body: `Payment is confirmed. Online Elite becomes active on ${offer.effectiveAt.toLocaleString("en-IN")}. Your original expiry date will not change.`,
            actionUrl: "/client/plan",
            metadata: { upgradeId: upgrade.id, effectiveAt: offer.effectiveAt.toISOString() },
          });
          if (assignment?.coachUserId) {
            await transaction.insert(notifications).values({
              userId: assignment.coachUserId,
              type: "plan.client_upgrade_scheduled",
              deduplicationKey: `plan-upgrade-scheduled-coach:${upgrade.id}`,
              title: "A client has upgraded their plan",
              body: `The assigned client's Online Elite upgrade becomes active on ${offer.effectiveAt.toLocaleString("en-IN")}.`,
              actionUrl: "/coach/clients",
              metadata: { upgradeId: upgrade.id, clientUserId: user.id },
            });
          }
          await transaction.insert(auditLogs).values({
            actorUserId: user.id,
            action: "payment.plan_upgrade_captured",
            targetType: "plan_upgrade",
            targetId: upgrade.id,
            requestId,
            safeMetadata: { provider: "mock", amountPaise: offer.amountPaise },
          });
          return { upgradeId: upgrade.id, effectiveAt: offer.effectiveAt.toISOString() };
        });
        return { reference: value.upgradeId, value };
      },
    });
    return NextResponse.json({ upgrade: result.value, replayed: result.replayed });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
