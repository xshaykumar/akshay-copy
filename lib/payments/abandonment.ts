import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  paymentOrders,
  planPurchases,
  planUpgrades,
} from "@/db/schema";
import { HttpError } from "@/lib/http/errors";
import { getRazorpayClient } from "@/lib/payments/razorpay";

export type CheckoutReconciliationStatus =
  | "abandoned"
  | "processing"
  | "completed";

export async function reconcileRazorpayCheckout(input: {
  userId: string;
  orderId: string;
  requestId: string;
}): Promise<CheckoutReconciliationStatus> {
  const db = getDb();
  const [localOrder] = await db
    .select()
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.provider, "razorpay"),
        eq(paymentOrders.providerReference, input.orderId),
        eq(paymentOrders.userId, input.userId),
      ),
    )
    .limit(1);

  if (!localOrder) {
    throw new HttpError(
      404,
      "payment_order_not_found",
      "The Razorpay order is not recognized for this account.",
    );
  }
  if (localOrder.status === "captured" || localOrder.status === "refunded") {
    return "completed";
  }

  let providerOrder;
  let providerPayments;
  try {
    [providerOrder, providerPayments] = await Promise.all([
      getRazorpayClient().orders.fetch(input.orderId),
      getRazorpayClient().orders.fetchPayments(input.orderId),
    ]);
  } catch {
    throw new HttpError(
      502,
      "payment_status_unavailable",
      "Payment status could not be confirmed. The checkout remains pending for safety.",
    );
  }

  if (
    Number(providerOrder.amount) !== localOrder.amountPaise ||
    providerOrder.currency.toUpperCase() !== localOrder.currency.toUpperCase()
  ) {
    throw new HttpError(
      409,
      "payment_order_mismatch",
      "The Razorpay order does not match the saved checkout.",
    );
  }

  const paymentInProgress = providerPayments.items.some((payment) =>
    ["authorized", "captured"].includes(payment.status),
  );
  if (providerOrder.status === "paid" || paymentInProgress) {
    return "processing";
  }

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT id FROM app.payment_orders WHERE id = ${localOrder.id} FOR UPDATE`,
    );
    const [lockedOrder] = await transaction
      .select()
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.id, localOrder.id),
          eq(paymentOrders.userId, input.userId),
        ),
      )
      .limit(1);

    if (!lockedOrder) {
      throw new HttpError(
        404,
        "payment_order_not_found",
        "The payment order no longer exists.",
      );
    }
    if (
      lockedOrder.status === "captured" ||
      lockedOrder.status === "refunded"
    ) {
      return "completed";
    }
    if (lockedOrder.status === "authorized") {
      return "processing";
    }

    const now = new Date();
    const alreadyAbandoned =
      lockedOrder.status === "failed" &&
      lockedOrder.failureCode === "checkout_abandoned";
    await transaction
      .update(paymentOrders)
      .set({
        status: "failed",
        failedAt: now,
        failureCode: "checkout_abandoned",
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentOrders.id, lockedOrder.id),
          inArray(paymentOrders.status, ["created", "failed"]),
        ),
      );
    if (lockedOrder.purchaseId) {
      await transaction
        .update(planPurchases)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(planPurchases.id, lockedOrder.purchaseId),
            eq(planPurchases.status, "pending"),
          ),
        );
    }
    if (lockedOrder.purpose === "plan_upgrade") {
      await transaction
        .update(planUpgrades)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(planUpgrades.paymentOrderId, lockedOrder.id),
            eq(planUpgrades.status, "payment_pending"),
          ),
        );
    }
    if (!alreadyAbandoned) {
      await transaction.insert(auditLogs).values({
        actorUserId: input.userId,
        action: "payment.checkout_abandoned",
        targetType: "payment_order",
        targetId: lockedOrder.id,
        requestId: input.requestId,
        safeMetadata: {
          purpose: lockedOrder.purpose,
          provider: "razorpay",
        },
      });
    }
    return "abandoned";
  });
}
