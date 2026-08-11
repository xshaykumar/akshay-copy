import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  paymentOrders,
  planPurchases,
  planUpgrades,
  plans,
} from "@/db/schema";
import { requireRole, type AuthenticatedAppUser } from "@/lib/auth/session";
import {
  coachActivationDurationSchema,
  coachActivationOptionFor,
  type CoachActivationDuration,
  COACH_ACTIVATION_CURRENCY,
} from "@/lib/coaches/activation";
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
  getRazorpayCheckoutKeyId,
  getRazorpayClient,
} from "@/lib/payments/razorpay";
import { reconcileRazorpayCheckout } from "@/lib/payments/abandonment";
import { getOnlineBasicUpgradeOffer } from "@/lib/plans/upgrade";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";

const createOrderSchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("plan_purchase"),
    planCode: z.string().trim().min(2).max(50),
  }),
  z.object({
    purpose: z.literal("coach_activation"),
    durationDays: coachActivationDurationSchema,
  }),
  z.object({ purpose: z.literal("plan_upgrade") }),
]);

type CheckoutOrder = {
  paymentOrderId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  purpose: "plan_purchase" | "plan_upgrade" | "coach_activation";
  name: string;
  description: string;
};

type CheckoutOrderSource = {
  paymentOrderId: string;
  providerReference: string | null;
  amountPaise: number;
  currency: string;
  purpose: "plan_purchase" | "plan_upgrade" | "coach_activation";
  name: string;
  description: string;
};

function receiptFor(prefix: "pp" | "pu" | "ca", id: string) {
  return `${prefix}_${id.replaceAll("-", "")}`;
}

async function reconcileExistingCheckout(
  user: AuthenticatedAppUser,
  purpose: "plan_purchase" | "plan_upgrade" | "coach_activation",
  requestId: string,
) {
  const db = getDb();
  let existing: { orderId: string | null } | undefined;
  if (purpose === "plan_purchase") {
    [existing] = await db
      .select({ orderId: paymentOrders.providerReference })
      .from(paymentOrders)
      .innerJoin(planPurchases, eq(planPurchases.id, paymentOrders.purchaseId))
      .where(
        and(
          eq(paymentOrders.provider, "razorpay"),
          eq(paymentOrders.userId, user.id),
          eq(paymentOrders.purpose, purpose),
          inArray(paymentOrders.status, ["created", "authorized", "failed"]),
          eq(planPurchases.status, "pending"),
        ),
      )
      .orderBy(desc(paymentOrders.createdAt))
      .limit(1);
  } else if (purpose === "plan_upgrade") {
    [existing] = await db
      .select({ orderId: paymentOrders.providerReference })
      .from(paymentOrders)
      .innerJoin(planUpgrades, eq(planUpgrades.paymentOrderId, paymentOrders.id))
      .where(
        and(
          eq(paymentOrders.provider, "razorpay"),
          eq(paymentOrders.userId, user.id),
          eq(paymentOrders.purpose, purpose),
          inArray(paymentOrders.status, ["created", "authorized", "failed"]),
          eq(planUpgrades.status, "payment_pending"),
        ),
      )
      .orderBy(desc(paymentOrders.createdAt))
      .limit(1);
  } else {
    [existing] = await db
      .select({ orderId: paymentOrders.providerReference })
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.provider, "razorpay"),
          eq(paymentOrders.userId, user.id),
          eq(paymentOrders.purpose, purpose),
          inArray(paymentOrders.status, ["created", "authorized"]),
        ),
      )
      .orderBy(desc(paymentOrders.createdAt))
      .limit(1);
  }

  if (!existing) return;
  if (!existing.orderId) {
    throw new HttpError(
      409,
      "payment_order_in_progress",
      "The previous payment order is still being prepared. Try again shortly.",
    );
  }
  const status = await reconcileRazorpayCheckout({
    userId: user.id,
    orderId: existing.orderId,
    requestId,
  });
  if (status === "processing") {
    throw new HttpError(
      409,
      "payment_still_processing",
      "The previous payment is still processing. Wait for its status to update before starting another checkout.",
    );
  }
}

async function createPlanOrder(user: AuthenticatedAppUser, planCode: string) {
  const db = getDb();
  const internal = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`razorpay-plan-order:${user.id}`}))`,
    );
    const [currentPurchase] = await transaction
      .select({ id: planPurchases.id })
      .from(planPurchases)
      .where(
        and(
          eq(planPurchases.clientUserId, user.id),
          inArray(planPurchases.status, ["paid", "active"]),
        ),
      )
      .limit(1);
    if (currentPurchase) {
      throw new HttpError(
        409,
        "active_plan_exists",
        "Complete or refund your current plan before purchasing another.",
      );
    }

    const [plan] = await transaction
      .select()
      .from(plans)
      .where(and(eq(plans.code, planCode), eq(plans.active, true)))
      .limit(1);
    if (!plan) {
      throw new HttpError(404, "plan_not_found", "The plan is unavailable.");
    }
    if (plan.pricePaise <= 0) {
      throw new HttpError(
        400,
        "paid_plan_required",
        "Only paid commercial plans can be purchased through Razorpay.",
      );
    }
    if (plan.currency !== "INR") {
      throw new HttpError(
        409,
        "unsupported_currency",
        "This plan cannot currently be paid online.",
      );
    }

    const [existingOpenOrder] = await transaction
      .select({
        paymentOrderId: paymentOrders.id,
        providerReference: paymentOrders.providerReference,
        planId: planPurchases.planId,
      })
      .from(paymentOrders)
      .innerJoin(
        planPurchases,
        eq(planPurchases.id, paymentOrders.purchaseId),
      )
      .where(
        and(
          eq(paymentOrders.provider, "razorpay"),
          eq(paymentOrders.userId, user.id),
          eq(paymentOrders.purpose, "plan_purchase"),
          inArray(paymentOrders.status, ["created", "authorized", "failed"]),
          eq(planPurchases.status, "pending"),
        ),
      )
      .orderBy(desc(paymentOrders.createdAt))
      .limit(1);
    if (existingOpenOrder) {
      if (existingOpenOrder.planId !== plan.id) {
        throw new HttpError(
          409,
          "checkout_already_open",
          "Finish the existing plan checkout before selecting another plan.",
        );
      }
      if (!existingOpenOrder.providerReference) {
        throw new HttpError(
          409,
          "payment_order_in_progress",
          "The payment order is still being prepared. Try again shortly.",
        );
      }
      return {
        paymentOrderId: existingOpenOrder.paymentOrderId,
        providerReference: existingOpenOrder.providerReference,
        receipt: null,
        amountPaise: plan.pricePaise,
        currency: plan.currency,
        purpose: "plan_purchase" as const,
        name: plan.name,
        description: `${plan.name} · ${plan.durationDays} days`,
        needsProviderOrder: false,
        purchaseId: null,
      };
    }

    const [purchase] = await transaction
      .insert(planPurchases)
      .values({
        clientUserId: user.id,
        planId: plan.id,
        status: "pending",
        amountPaise: plan.pricePaise,
        currency: plan.currency,
      })
      .returning({ id: planPurchases.id });
    const [paymentOrder] = await transaction
      .insert(paymentOrders)
      .values({
        userId: user.id,
        purchaseId: purchase.id,
        purpose: "plan_purchase",
        provider: "razorpay",
        amountPaise: plan.pricePaise,
        currency: plan.currency,
        status: "created",
      })
      .returning({ id: paymentOrders.id });
    const receipt = receiptFor("pp", paymentOrder.id);
    await transaction
      .update(paymentOrders)
      .set({ receipt })
      .where(eq(paymentOrders.id, paymentOrder.id));
    return {
      paymentOrderId: paymentOrder.id,
      providerReference: null,
      receipt,
      amountPaise: plan.pricePaise,
      currency: plan.currency,
      purpose: "plan_purchase" as const,
      name: plan.name,
      description: `${plan.name} · ${plan.durationDays} days`,
      needsProviderOrder: true,
      purchaseId: purchase.id,
    };
  });

  if (!internal.needsProviderOrder) return internal;

  try {
    const providerOrder = await getRazorpayClient().orders.create({
      amount: internal.amountPaise,
      currency: internal.currency,
      receipt: internal.receipt as string,
      partial_payment: false,
      notes: {
        payment_order_id: internal.paymentOrderId,
        purpose: internal.purpose,
      },
    });
    if (
      Number(providerOrder.amount) !== internal.amountPaise ||
      providerOrder.currency !== internal.currency
    ) {
      throw new Error("Razorpay returned an inconsistent order.");
    }
    await db
      .update(paymentOrders)
      .set({ providerReference: providerOrder.id, updatedAt: new Date() })
      .where(eq(paymentOrders.id, internal.paymentOrderId));
    return { ...internal, providerReference: providerOrder.id };
  } catch (error) {
    await db.transaction(async (transaction) => {
      await transaction
        .update(paymentOrders)
        .set({
          status: "failed",
          failedAt: new Date(),
          failureCode: "provider_order_creation_failed",
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, internal.paymentOrderId));
      if (internal.purchaseId) {
        await transaction
          .update(planPurchases)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(planPurchases.id, internal.purchaseId));
      }
    });
    throw error;
  }
}

async function createPlanUpgradeOrder(user: AuthenticatedAppUser) {
  const quotedAt = new Date();
  await reconcileDueServiceCycles(100, quotedAt);
  const offer = await getOnlineBasicUpgradeOffer(user.id, quotedAt);
  if (!offer) {
    throw new HttpError(
      409,
      "plan_upgrade_unavailable",
      "An Online Basic to Online Elite upgrade is not currently available.",
    );
  }
  const db = getDb();
  const internal = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`razorpay-plan-upgrade:${user.id}`}))`,
    );
    const [purchase] = await transaction
      .select({
        clientUserId: planPurchases.clientUserId,
        planId: planPurchases.planId,
        status: planPurchases.status,
      })
      .from(planPurchases)
      .where(eq(planPurchases.id, offer.purchaseId))
      .limit(1);
    if (
      !purchase ||
      purchase.clientUserId !== user.id ||
      purchase.planId !== offer.fromPlanId ||
      purchase.status !== "active"
    ) {
      throw new HttpError(
        409,
        "plan_upgrade_changed",
        "The plan changed before checkout. Refresh My Plan and try again.",
      );
    }
    const [existingUpgrade] = await transaction
      .select({ id: planUpgrades.id })
      .from(planUpgrades)
      .where(
        and(
          eq(planUpgrades.purchaseId, offer.purchaseId),
          sql`${planUpgrades.status} in ('payment_pending', 'scheduled', 'applied')`,
        ),
      )
      .limit(1);
    if (existingUpgrade) {
      throw new HttpError(
        409,
        "plan_upgrade_exists",
        "An upgrade already exists for this plan. Refresh My Plan to see its status.",
      );
    }

    const [upgrade] = await transaction
      .insert(planUpgrades)
      .values({
        purchaseId: offer.purchaseId,
        clientUserId: user.id,
        fromPlanId: offer.fromPlanId,
        toPlanId: offer.toPlanId,
        amountPaise: offer.amountPaise,
        currency: offer.currency,
        applicableCycles: offer.applicableCycles,
        requestedAt: quotedAt,
        effectiveAt: offer.effectiveAt,
      })
      .returning({ id: planUpgrades.id });
    const [paymentOrder] = await transaction
      .insert(paymentOrders)
      .values({
        userId: user.id,
        purchaseId: offer.purchaseId,
        purpose: "plan_upgrade",
        provider: "razorpay",
        amountPaise: offer.amountPaise,
        currency: offer.currency,
        status: "created",
      })
      .returning({ id: paymentOrders.id });
    const receipt = receiptFor("pu", paymentOrder.id);
    await transaction
      .update(paymentOrders)
      .set({ receipt })
      .where(eq(paymentOrders.id, paymentOrder.id));
    await transaction
      .update(planUpgrades)
      .set({ paymentOrderId: paymentOrder.id, updatedAt: quotedAt })
      .where(eq(planUpgrades.id, upgrade.id));
    return {
      paymentOrderId: paymentOrder.id,
      providerReference: null,
      receipt,
      amountPaise: offer.amountPaise,
      currency: offer.currency,
      purpose: "plan_upgrade" as const,
      name: "Upgrade to Online Elite",
      description: `Online Elite upgrade · effective ${offer.effectiveAt.toLocaleDateString("en-IN")}`,
      needsProviderOrder: true,
      upgradeId: upgrade.id,
    };
  });

  try {
    const providerOrder = await getRazorpayClient().orders.create({
      amount: internal.amountPaise,
      currency: internal.currency,
      receipt: internal.receipt,
      partial_payment: false,
      notes: {
        payment_order_id: internal.paymentOrderId,
        plan_upgrade_id: internal.upgradeId,
        purpose: internal.purpose,
      },
    });
    if (
      Number(providerOrder.amount) !== internal.amountPaise ||
      providerOrder.currency !== internal.currency
    ) {
      throw new Error("Razorpay returned an inconsistent upgrade order.");
    }
    await db
      .update(paymentOrders)
      .set({ providerReference: providerOrder.id, updatedAt: new Date() })
      .where(eq(paymentOrders.id, internal.paymentOrderId));
    return { ...internal, providerReference: providerOrder.id };
  } catch (error) {
    const failedAt = new Date();
    await db.transaction(async (transaction) => {
      await transaction
        .update(paymentOrders)
        .set({
          status: "failed",
          failedAt,
          failureCode: "provider_order_creation_failed",
          updatedAt: failedAt,
        })
        .where(eq(paymentOrders.id, internal.paymentOrderId));
      await transaction
        .update(planUpgrades)
        .set({ status: "cancelled", updatedAt: failedAt })
        .where(eq(planUpgrades.id, internal.upgradeId));
    });
    throw error;
  }
}

async function createCoachActivationOrder(
  user: AuthenticatedAppUser,
  durationDays: CoachActivationDuration,
) {
  const db = getDb();
  const option = coachActivationOptionFor(durationDays);
  if (!option) {
    throw new HttpError(
      400,
      "activation_option_invalid",
      "Choose a valid coach activation period.",
    );
  }
  const internal = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`razorpay-activation-order:${user.id}`}))`,
    );
    const [existingOpenOrder] = await transaction
      .select({
        paymentOrderId: paymentOrders.id,
        providerReference: paymentOrders.providerReference,
        durationDays: paymentOrders.activationDurationDays,
      })
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.provider, "razorpay"),
          eq(paymentOrders.userId, user.id),
          eq(paymentOrders.purpose, "coach_activation"),
          inArray(paymentOrders.status, ["created", "authorized"]),
        ),
      )
      .orderBy(desc(paymentOrders.createdAt))
      .limit(1);
    if (existingOpenOrder) {
      if (existingOpenOrder.durationDays !== durationDays) {
        throw new HttpError(
          409,
          "checkout_already_open",
          `A ${existingOpenOrder.durationDays ?? 30}-day activation checkout is already open. Complete it before selecting another duration.`,
        );
      }
      if (!existingOpenOrder.providerReference) {
        throw new HttpError(
          409,
          "payment_order_in_progress",
          "The payment order is still being prepared. Try again shortly.",
        );
      }
      return {
        paymentOrderId: existingOpenOrder.paymentOrderId,
        providerReference: existingOpenOrder.providerReference,
        receipt: null,
        amountPaise: option.amountPaise,
        currency: COACH_ACTIVATION_CURRENCY,
        purpose: "coach_activation" as const,
        name: "Coach profile activation",
        description: `${durationDays}-day coach profile activation`,
        needsProviderOrder: false,
      };
    }

    const [paymentOrder] = await transaction
      .insert(paymentOrders)
      .values({
        userId: user.id,
        purpose: "coach_activation",
        activationDurationDays: durationDays,
        provider: "razorpay",
        amountPaise: option.amountPaise,
        currency: COACH_ACTIVATION_CURRENCY,
        status: "created",
      })
      .returning({ id: paymentOrders.id });
    const receipt = receiptFor("ca", paymentOrder.id);
    await transaction
      .update(paymentOrders)
      .set({ receipt })
      .where(eq(paymentOrders.id, paymentOrder.id));
    return {
      paymentOrderId: paymentOrder.id,
      providerReference: null,
      receipt,
      amountPaise: option.amountPaise,
      currency: COACH_ACTIVATION_CURRENCY,
      purpose: "coach_activation" as const,
      name: "Coach profile activation",
      description: `${durationDays}-day coach profile activation`,
      needsProviderOrder: true,
    };
  });

  if (!internal.needsProviderOrder) return internal;

  try {
    const providerOrder = await getRazorpayClient().orders.create({
      amount: internal.amountPaise,
      currency: internal.currency,
      receipt: internal.receipt as string,
      partial_payment: false,
      notes: {
        payment_order_id: internal.paymentOrderId,
        purpose: internal.purpose,
        duration_days: String(durationDays),
      },
    });
    if (
      Number(providerOrder.amount) !== internal.amountPaise ||
      providerOrder.currency !== internal.currency
    ) {
      throw new Error("Razorpay returned an inconsistent order.");
    }
    await db
      .update(paymentOrders)
      .set({ providerReference: providerOrder.id, updatedAt: new Date() })
      .where(eq(paymentOrders.id, internal.paymentOrderId));
    return { ...internal, providerReference: providerOrder.id };
  } catch (error) {
    await db
      .update(paymentOrders)
      .set({
        status: "failed",
        failedAt: new Date(),
        failureCode: "provider_order_creation_failed",
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, internal.paymentOrderId));
    throw error;
  }
}

function checkoutResponse(
  order: CheckoutOrderSource,
  user: AuthenticatedAppUser,
): CheckoutOrder & {
  keyId: string;
  prefill: { name: string; email: string; contact: string };
} {
  if (!order.providerReference) {
    throw new Error("Razorpay order creation did not return an order ID.");
  }
  return {
    paymentOrderId: order.paymentOrderId,
    orderId: order.providerReference,
    amountPaise: order.amountPaise,
    currency: order.currency,
    purpose: order.purpose,
    name: order.name,
    description: order.description,
    keyId: getRazorpayCheckoutKeyId(),
    prefill: {
      name: user.displayName,
      email: user.email ?? "",
      contact: user.phone ?? "",
    },
  };
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const input = createOrderSchema.parse(await request.json());
    const user = await requireRole(
      input.purpose === "coach_activation" ? "coach" : "client",
    );
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `razorpay-order:${input.purpose}:${user.id}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        await reconcileExistingCheckout(user, input.purpose, requestId);
        const order =
          input.purpose === "plan_purchase"
            ? await createPlanOrder(user, input.planCode)
            : input.purpose === "plan_upgrade"
              ? await createPlanUpgradeOrder(user)
              : await createCoachActivationOrder(user, input.durationDays);
        return {
          reference: order.paymentOrderId,
          value: checkoutResponse(order, user),
        };
      },
    });

    if (result.value) {
      return NextResponse.json({ checkout: result.value, replayed: false });
    }

    const [record] = await getDb()
      .select({
        paymentOrderId: paymentOrders.id,
        orderId: paymentOrders.providerReference,
        amountPaise: paymentOrders.amountPaise,
        currency: paymentOrders.currency,
        purpose: paymentOrders.purpose,
        planName: plans.name,
        durationDays: plans.durationDays,
        activationDurationDays: paymentOrders.activationDurationDays,
        upgradeEffectiveAt: planUpgrades.effectiveAt,
      })
      .from(paymentOrders)
      .leftJoin(planPurchases, eq(planPurchases.id, paymentOrders.purchaseId))
      .leftJoin(plans, eq(plans.id, planPurchases.planId))
      .leftJoin(planUpgrades, eq(planUpgrades.paymentOrderId, paymentOrders.id))
      .where(
        and(
          eq(paymentOrders.id, result.reference),
          eq(paymentOrders.userId, user.id),
          eq(paymentOrders.provider, "razorpay"),
        ),
      )
      .limit(1);
    if (!record?.orderId) {
      throw new HttpError(
        409,
        "payment_order_unavailable",
        "The saved payment order is unavailable. Use a new checkout request.",
      );
    }
    const purpose = record.purpose as
      | "plan_purchase"
      | "plan_upgrade"
      | "coach_activation";
    const replayedOrder = {
      paymentOrderId: record.paymentOrderId,
      providerReference: record.orderId,
      amountPaise: record.amountPaise,
      currency: record.currency,
      purpose,
      name:
        purpose === "plan_purchase"
          ? (record.planName ?? "Coaching plan")
          : purpose === "plan_upgrade"
            ? "Upgrade to Online Elite"
            : "Coach profile activation",
      description:
        purpose === "plan_purchase"
          ? `${record.planName ?? "Coaching plan"} · ${record.durationDays ?? ""} days`
          : purpose === "plan_upgrade"
            ? `Online Elite upgrade effective ${record.upgradeEffectiveAt?.toLocaleDateString("en-IN") ?? "soon"}`
            : `${record.activationDurationDays ?? 30}-day coach profile activation`,
    };
    return NextResponse.json({
      checkout: checkoutResponse(replayedOrder, user),
      replayed: true,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
