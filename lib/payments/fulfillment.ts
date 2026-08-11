import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  coachActivationPayments,
  coachAssignments,
  coachProfiles,
  notifications,
  paymentOrders,
  planPurchases,
  planUpgrades,
  plans,
  scheduledJobs,
} from "@/db/schema";
import { CLIENT_SELECTION_WINDOW_MS } from "@/lib/assignments/lifecycle";
import {
  addActivationPeriod,
  coachActivationOptionFor,
  isCoachProfileActive,
} from "@/lib/coaches/activation";
import { HttpError } from "@/lib/http/errors";
import { formatPlanDuration } from "@/lib/plans/duration";
import { applyPlanUpgradeInTransaction } from "@/lib/plans/upgrade";

export type RazorpayCapturedPayment = {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  checkoutSignature?: string;
  capturedAt?: Date;
  requestId?: string;
  source: "checkout" | "webhook";
};

type FulfillmentResult =
  | {
      purpose: "plan_purchase";
      paymentOrderId: string;
      purchaseId: string;
      assignmentId: string;
      alreadyFulfilled: boolean;
    }
  | {
      purpose: "coach_activation";
      paymentOrderId: string;
      activationPaymentId: string;
      periodEndsAt: Date;
      active: boolean;
      alreadyFulfilled: boolean;
    }
  | {
      purpose: "plan_upgrade";
      paymentOrderId: string;
      upgradeId: string;
      effectiveAt: Date;
      applied: boolean;
      alreadyFulfilled: boolean;
    };

export async function fulfillRazorpayCapturedPayment(
  input: RazorpayCapturedPayment,
): Promise<FulfillmentResult> {
  const db = getDb();
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT id FROM app.payment_orders WHERE provider = 'razorpay' AND provider_reference = ${input.orderId} FOR UPDATE`,
    );
    const [order] = await transaction
      .select()
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.provider, "razorpay"),
          eq(paymentOrders.providerReference, input.orderId),
        ),
      )
      .limit(1);

    if (!order) {
      throw new HttpError(
        404,
        "payment_order_not_found",
        "The Razorpay order is not recognized.",
      );
    }
    if (
      order.amountPaise !== input.amountPaise ||
      order.currency.toUpperCase() !== input.currency.toUpperCase()
    ) {
      throw new HttpError(
        409,
        "payment_amount_mismatch",
        "The captured payment does not match the expected amount.",
      );
    }
    if (
      order.providerPaymentId &&
      order.providerPaymentId !== input.paymentId
    ) {
      throw new HttpError(
        409,
        "payment_identifier_mismatch",
        "The Razorpay payment does not match the recorded payment.",
      );
    }

    if (order.status === "captured") {
      if (order.purpose === "plan_purchase" && order.purchaseId) {
        const [assignment] = await transaction
          .select({ id: coachAssignments.id })
          .from(coachAssignments)
          .where(eq(coachAssignments.purchaseId, order.purchaseId))
          .limit(1);
        if (!assignment) {
          throw new Error("Captured plan payment is missing its assignment.");
        }
        return {
          purpose: "plan_purchase",
          paymentOrderId: order.id,
          purchaseId: order.purchaseId,
          assignmentId: assignment.id,
          alreadyFulfilled: true,
        };
      }
      if (order.purpose === "coach_activation") {
        const [activation] = await transaction
          .select({
            id: coachActivationPayments.id,
            periodEndsAt: coachActivationPayments.periodEndsAt,
            approvedAt: coachProfiles.approvedAt,
            certificationWaivedAt: coachProfiles.certificationWaivedAt,
          })
          .from(coachActivationPayments)
          .innerJoin(
            coachProfiles,
            eq(coachProfiles.userId, coachActivationPayments.coachUserId),
          )
          .where(eq(coachActivationPayments.paymentOrderId, order.id))
          .limit(1);
        if (!activation) {
          throw new Error("Captured activation payment is missing its period.");
        }
        return {
          purpose: "coach_activation",
          paymentOrderId: order.id,
          activationPaymentId: activation.id,
          periodEndsAt: activation.periodEndsAt,
          active: isCoachProfileActive({
            approvedAt: activation.approvedAt,
            certificationWaivedAt: activation.certificationWaivedAt,
            activationExpiresAt: activation.periodEndsAt,
          }),
          alreadyFulfilled: true,
        };
      }
      if (order.purpose === "plan_upgrade") {
        const [upgrade] = await transaction
          .select({
            id: planUpgrades.id,
            status: planUpgrades.status,
            effectiveAt: planUpgrades.effectiveAt,
          })
          .from(planUpgrades)
          .where(eq(planUpgrades.paymentOrderId, order.id))
          .limit(1);
        if (!upgrade) {
          throw new Error("Captured upgrade payment is missing its upgrade record.");
        }
        return {
          purpose: "plan_upgrade",
          paymentOrderId: order.id,
          upgradeId: upgrade.id,
          effectiveAt: upgrade.effectiveAt,
          applied: upgrade.status === "applied",
          alreadyFulfilled: true,
        };
      }
      throw new Error("Captured payment has an unsupported purpose.");
    }

    const capturedAt = input.capturedAt ?? new Date();

    if (order.purpose === "plan_purchase" && order.purchaseId && order.userId) {
      await transaction.execute(
        sql`SELECT id FROM app.plan_purchases WHERE id = ${order.purchaseId} FOR UPDATE`,
      );
      const [purchase] = await transaction
        .select({
          id: planPurchases.id,
          status: planPurchases.status,
          clientUserId: planPurchases.clientUserId,
          planName: plans.name,
          durationDays: plans.durationDays,
        })
        .from(planPurchases)
        .innerJoin(plans, eq(plans.id, planPurchases.planId))
        .where(eq(planPurchases.id, order.purchaseId))
        .limit(1);
      if (!purchase || purchase.clientUserId !== order.userId) {
        throw new Error("Plan payment ownership is inconsistent.");
      }
      if (!["pending", "cancelled"].includes(purchase.status)) {
        throw new Error(`Plan purchase cannot be paid from ${purchase.status}.`);
      }
      const [otherCurrentPurchase] = await transaction
        .select({ id: planPurchases.id })
        .from(planPurchases)
        .where(
          and(
            eq(planPurchases.clientUserId, order.userId),
            ne(planPurchases.id, purchase.id),
            inArray(planPurchases.status, ["paid", "active"]),
          ),
        )
        .limit(1);
      if (otherCurrentPurchase) {
        throw new HttpError(
          409,
          "active_plan_exists",
          "Another current plan already exists for this client.",
        );
      }

      const selectionWindowEndsAt = new Date(
        capturedAt.getTime() + CLIENT_SELECTION_WINDOW_MS,
      );
      await transaction
        .update(planPurchases)
        .set({ status: "paid", purchasedAt: capturedAt, updatedAt: capturedAt })
        .where(eq(planPurchases.id, purchase.id));
      const [assignment] = await transaction
        .insert(coachAssignments)
        .values({
          purchaseId: purchase.id,
          clientUserId: order.userId,
          status: "selection",
          selectionWindowEndsAt,
        })
        .onConflictDoNothing()
        .returning({ id: coachAssignments.id });
      const assignmentId =
        assignment?.id ??
        (
          await transaction
            .select({ id: coachAssignments.id })
            .from(coachAssignments)
            .where(eq(coachAssignments.purchaseId, purchase.id))
            .limit(1)
        )[0]?.id;
      if (!assignmentId) throw new Error("Plan assignment could not be created.");

      await transaction
        .insert(scheduledJobs)
        .values({
          jobType: "expire_coach_selection",
          deduplicationKey: `expire_coach_selection:${assignmentId}:cycle:1`,
          payload: { assignmentId },
          runAt: selectionWindowEndsAt,
        })
        .onConflictDoNothing();
      await transaction
        .insert(notifications)
        .values({
          userId: order.userId,
          type: "plan.purchased",
          deduplicationKey: `plan-purchased:${purchase.id}`,
          title: "Your plan is ready",
          body: `Congratulations! Your ${formatPlanDuration(purchase.durationDays)} ${purchase.planName} plan is ready. Send requests to up to three coaches before the 24-hour selection window closes.`,
          actionUrl: "/client/coaches",
          metadata: {
            assignmentId,
            purchaseId: purchase.id,
            selectionWindowEndsAt: selectionWindowEndsAt.toISOString(),
          },
        })
        .onConflictDoNothing();
      await transaction
        .update(paymentOrders)
        .set({
          providerPaymentId: input.paymentId,
          providerSignature:
            input.checkoutSignature ?? order.providerSignature,
          status: "captured",
          capturedAt,
          failedAt: null,
          failureCode: null,
          updatedAt: capturedAt,
        })
        .where(eq(paymentOrders.id, order.id));
      await transaction.insert(auditLogs).values({
        actorUserId: order.userId,
        action: "payment.plan_captured",
        targetType: "payment_order",
        targetId: order.id,
        requestId: input.requestId,
        safeMetadata: { source: input.source, provider: "razorpay" },
      });
      return {
        purpose: "plan_purchase",
        paymentOrderId: order.id,
        purchaseId: purchase.id,
        assignmentId,
        alreadyFulfilled: false,
      };
    }

    if (
      order.purpose === "plan_upgrade" &&
      order.purchaseId &&
      order.userId
    ) {
      await transaction.execute(
        sql`SELECT id FROM app.plan_purchases WHERE id = ${order.purchaseId} FOR UPDATE`,
      );
      const [upgrade] = await transaction
        .select({
          id: planUpgrades.id,
          status: planUpgrades.status,
          clientUserId: planUpgrades.clientUserId,
          purchaseId: planUpgrades.purchaseId,
          effectiveAt: planUpgrades.effectiveAt,
          amountPaise: planUpgrades.amountPaise,
        })
        .from(planUpgrades)
        .where(eq(planUpgrades.paymentOrderId, order.id))
        .limit(1);
      if (
        !upgrade ||
        upgrade.clientUserId !== order.userId ||
        upgrade.purchaseId !== order.purchaseId ||
        upgrade.status !== "payment_pending" ||
        upgrade.amountPaise !== order.amountPaise
      ) {
        throw new Error("Plan upgrade payment ownership or status is inconsistent.");
      }
      const [assignment] = await transaction
        .select({ coachUserId: coachAssignments.coachUserId })
        .from(coachAssignments)
        .where(eq(coachAssignments.purchaseId, order.purchaseId))
        .limit(1);

      await transaction
        .update(planUpgrades)
        .set({ status: "scheduled", paidAt: capturedAt, updatedAt: capturedAt })
        .where(eq(planUpgrades.id, upgrade.id));
      await transaction
        .update(paymentOrders)
        .set({
          providerPaymentId: input.paymentId,
          providerSignature:
            input.checkoutSignature ?? order.providerSignature,
          status: "captured",
          capturedAt,
          failedAt: null,
          failureCode: null,
          updatedAt: capturedAt,
        })
        .where(eq(paymentOrders.id, order.id));
      await transaction
        .insert(scheduledJobs)
        .values({
          jobType: "apply_plan_upgrade",
          deduplicationKey: `apply_plan_upgrade:${upgrade.id}`,
          payload: { upgradeId: upgrade.id },
          runAt: upgrade.effectiveAt,
        })
        .onConflictDoNothing();
      await transaction
        .insert(notifications)
        .values([
          {
            userId: order.userId,
            type: "plan.upgrade_scheduled",
            deduplicationKey: `plan-upgrade-scheduled-client:${upgrade.id}`,
            title: "Your Online Elite upgrade is scheduled",
            body: `Payment is confirmed. Online Elite becomes active on ${upgrade.effectiveAt.toLocaleString("en-IN")}. Your original expiry date will not change.`,
            actionUrl: "/client/plan",
            metadata: {
              upgradeId: upgrade.id,
              purchaseId: upgrade.purchaseId,
              effectiveAt: upgrade.effectiveAt.toISOString(),
            },
          },
          ...(assignment?.coachUserId
            ? [
                {
                  userId: assignment.coachUserId,
                  type: "plan.client_upgrade_scheduled",
                  deduplicationKey: `plan-upgrade-scheduled-coach:${upgrade.id}`,
                  title: "A client has upgraded their plan",
                  body: `The assigned client's Online Elite upgrade becomes active on ${upgrade.effectiveAt.toLocaleString("en-IN")}.`,
                  actionUrl: "/coach/clients",
                  metadata: {
                    upgradeId: upgrade.id,
                    purchaseId: upgrade.purchaseId,
                    clientUserId: order.userId,
                    effectiveAt: upgrade.effectiveAt.toISOString(),
                  },
                },
              ]
            : []),
        ])
        .onConflictDoNothing();
      await transaction.insert(auditLogs).values({
        actorUserId: order.userId,
        action: "payment.plan_upgrade_captured",
        targetType: "payment_order",
        targetId: order.id,
        requestId: input.requestId,
        safeMetadata: {
          source: input.source,
          provider: "razorpay",
          upgradeId: upgrade.id,
        },
      });

      const applied = upgrade.effectiveAt <= capturedAt;
      if (applied) {
        await applyPlanUpgradeInTransaction(transaction, upgrade.id, capturedAt);
      }
      return {
        purpose: "plan_upgrade",
        paymentOrderId: order.id,
        upgradeId: upgrade.id,
        effectiveAt: upgrade.effectiveAt,
        applied,
        alreadyFulfilled: false,
      };
    }

    if (order.purpose === "coach_activation" && order.userId) {
      const activationOption = coachActivationOptionFor(
        order.activationDurationDays ?? 0,
      );
      if (!activationOption) {
        throw new Error("Coach activation order has an invalid duration.");
      }
      await transaction.execute(
        sql`SELECT user_id FROM app.coach_profiles WHERE user_id = ${order.userId} FOR UPDATE`,
      );
      const [profile] = await transaction
        .select({
          approvedAt: coachProfiles.approvedAt,
          certificationWaivedAt: coachProfiles.certificationWaivedAt,
          activationExpiresAt: coachProfiles.activationExpiresAt,
        })
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, order.userId))
        .limit(1);
      if (!profile) throw new Error("Coach profile is missing.");

      const periodStartsAt =
        profile.activationExpiresAt && profile.activationExpiresAt > capturedAt
          ? profile.activationExpiresAt
          : capturedAt;
      const periodEndsAt = addActivationPeriod(
        periodStartsAt,
        activationOption.durationDays,
      );
      const [activation] = await transaction
        .insert(coachActivationPayments)
        .values({
          coachUserId: order.userId,
          paymentOrderId: order.id,
          provider: "razorpay",
          providerReference: input.paymentId,
          amountPaise: order.amountPaise,
          durationDays: activationOption.durationDays,
          currency: order.currency,
          status: "captured",
          periodStartsAt,
          periodEndsAt,
          paidAt: capturedAt,
        })
        .returning({ id: coachActivationPayments.id });
      await transaction
        .update(coachProfiles)
        .set({ activationExpiresAt: periodEndsAt, updatedAt: capturedAt })
        .where(eq(coachProfiles.userId, order.userId));
      const active = isCoachProfileActive({
        approvedAt: profile.approvedAt,
        certificationWaivedAt: profile.certificationWaivedAt,
        activationExpiresAt: periodEndsAt,
      });
      await transaction
        .insert(notifications)
        .values({
          userId: order.userId,
          type: active
            ? "coach.activation_completed"
            : "coach.activation_fee_recorded",
          deduplicationKey: `coach-activation-payment:${order.id}`,
          title: active
            ? "Your profile is active"
            : "Activation fee recorded",
          body: active
            ? `Congratulations! Your ${activationOption.durationDays}-day activation is valid through ${periodEndsAt.toLocaleDateString("en-IN")}.`
            : "Your fee is recorded. Your profile will become active after your certification is approved.",
          actionUrl: "/coach",
          metadata: {
            paymentId: activation.id,
            periodEndsAt: periodEndsAt.toISOString(),
          },
        })
        .onConflictDoNothing();
      await transaction
        .update(paymentOrders)
        .set({
          providerPaymentId: input.paymentId,
          providerSignature:
            input.checkoutSignature ?? order.providerSignature,
          status: "captured",
          capturedAt,
          failedAt: null,
          failureCode: null,
          updatedAt: capturedAt,
        })
        .where(eq(paymentOrders.id, order.id));
      await transaction.insert(auditLogs).values({
        actorUserId: order.userId,
        action: "payment.coach_activation_captured",
        targetType: "payment_order",
        targetId: order.id,
        requestId: input.requestId,
        safeMetadata: {
          source: input.source,
          provider: "razorpay",
          durationDays: activationOption.durationDays,
        },
      });
      return {
        purpose: "coach_activation",
        paymentOrderId: order.id,
        activationPaymentId: activation.id,
        periodEndsAt,
        active,
        alreadyFulfilled: false,
      };
    }

    throw new Error("Payment purpose is not fulfillable by Razorpay.");
  });
}
