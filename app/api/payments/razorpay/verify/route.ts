import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { paymentOrders } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { fulfillRazorpayCapturedPayment } from "@/lib/payments/fulfillment";
import {
  getRazorpayClient,
  getRazorpayKeySecret,
} from "@/lib/payments/razorpay";
import { verifyRazorpayCheckoutSignature } from "@/lib/payments/signatures";

const verificationSchema = z.object({
  razorpay_order_id: z.string().trim().min(8).max(100),
  razorpay_payment_id: z.string().trim().min(8).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = verificationSchema.parse(await request.json());
    const [order] = await getDb()
      .select()
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.provider, "razorpay"),
          eq(paymentOrders.providerReference, input.razorpay_order_id),
          eq(paymentOrders.userId, user.id),
        ),
      )
      .limit(1);
    if (!order) {
      throw new HttpError(
        404,
        "payment_order_not_found",
        "This Razorpay order does not belong to the signed-in account.",
      );
    }
    const roleRequired =
      order.purpose === "coach_activation" ? "coach" : "client";
    if (!user.roles.includes(roleRequired)) {
      throw new HttpError(
        403,
        "payment_role_mismatch",
        "This account cannot complete the selected payment.",
      );
    }
    if (
      !verifyRazorpayCheckoutSignature({
        orderId: input.razorpay_order_id,
        paymentId: input.razorpay_payment_id,
        signature: input.razorpay_signature,
        secret: getRazorpayKeySecret(),
      })
    ) {
      throw new HttpError(
        400,
        "invalid_payment_signature",
        "The payment signature is invalid.",
      );
    }

    const razorpay = getRazorpayClient();
    let payment = await razorpay.payments.fetch(input.razorpay_payment_id);
    if (
      payment.order_id !== input.razorpay_order_id ||
      Number(payment.amount) !== order.amountPaise ||
      payment.currency.toUpperCase() !== order.currency.toUpperCase()
    ) {
      throw new HttpError(
        409,
        "payment_details_mismatch",
        "Razorpay returned payment details that do not match this order.",
      );
    }

    if (payment.status === "authorized") {
      try {
        payment = await razorpay.payments.capture(
          payment.id,
          order.amountPaise,
          order.currency,
        );
      } catch {
        payment = await razorpay.payments.fetch(input.razorpay_payment_id);
      }
    }

    if (payment.status !== "captured" || !payment.captured) {
      await getDb()
        .update(paymentOrders)
        .set({
          providerPaymentId: payment.id,
          providerSignature: input.razorpay_signature,
          status: payment.status === "failed" ? "failed" : "authorized",
          failedAt: payment.status === "failed" ? new Date() : null,
          failureCode:
            payment.status === "failed" ? "provider_payment_failed" : null,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));
      if (payment.status === "failed") {
        throw new HttpError(
          402,
          "payment_failed",
          "Razorpay did not complete the payment.",
        );
      }
      return NextResponse.json(
        {
          status: "processing",
          paymentOrderId: order.id,
          message:
            "Payment is authorized and awaiting capture. Your access will update automatically after capture.",
        },
        { status: 202 },
      );
    }

    const fulfillment = await fulfillRazorpayCapturedPayment({
      orderId: input.razorpay_order_id,
      paymentId: payment.id,
      amountPaise: Number(payment.amount),
      currency: payment.currency,
      checkoutSignature: input.razorpay_signature,
      capturedAt: new Date(),
      requestId,
      source: "checkout",
    });
    return NextResponse.json({
      status: "captured",
      fulfillment,
      destination:
        fulfillment.purpose === "plan_purchase"
          ? "/client/coaches"
          : fulfillment.purpose === "plan_upgrade"
            ? "/client/plan"
            : "/coach/activation",
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
