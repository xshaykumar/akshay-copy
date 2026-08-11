import { createHash } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { paymentOrders, webhookEvents } from "@/db/schema";
import { HttpError, jsonError, requestIdFrom } from "@/lib/http/errors";
import { fulfillRazorpayCapturedPayment } from "@/lib/payments/fulfillment";
import { getRazorpayWebhookSecret } from "@/lib/payments/razorpay";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/signatures";

const paymentEntitySchema = z
  .object({
    id: z.string().min(1).max(100),
    order_id: z.string().min(1).max(100),
    amount: z.union([z.number(), z.string()]),
    currency: z.string().min(3).max(10),
    status: z.enum([
      "created",
      "authorized",
      "captured",
      "refunded",
      "failed",
    ]),
    captured: z.boolean().optional(),
    created_at: z.number().int().positive().optional(),
    error_code: z.string().max(200).nullish(),
  })
  .passthrough();

const webhookSchema = z
  .object({
    event: z.string().min(1).max(100),
    payload: z
      .object({
        payment: z.object({ entity: paymentEntitySchema }).optional(),
      })
      .passthrough(),
  })
  .passthrough();

function processingErrorCode(error: unknown) {
  if (error instanceof HttpError) return error.code;
  if (error instanceof z.ZodError) return "invalid_webhook_payload";
  return error instanceof Error ? error.constructor.name : "internal_error";
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let eventId: string | null = null;
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    eventId = request.headers.get("x-razorpay-event-id");
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      throw new HttpError(
        400,
        "missing_webhook_signature",
        "A valid Razorpay webhook signature is required.",
      );
    }
    if (!eventId || eventId.length > 200) {
      throw new HttpError(
        400,
        "missing_webhook_event_id",
        "A valid Razorpay webhook event ID is required.",
      );
    }
    if (
      !verifyRazorpayWebhookSignature({
        rawBody,
        signature,
        secret: getRazorpayWebhookSecret(),
      })
    ) {
      throw new HttpError(
        400,
        "invalid_webhook_signature",
        "The Razorpay webhook signature is invalid.",
      );
    }

    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const event = webhookSchema.parse(JSON.parse(rawBody) as unknown);
    const db = getDb();
    const [existing] = await db
      .select()
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.provider, "razorpay"),
          eq(webhookEvents.eventId, eventId),
        ),
      )
      .limit(1);
    if (existing && existing.payloadHash !== payloadHash) {
      throw new HttpError(
        409,
        "webhook_payload_conflict",
        "The webhook event ID was reused with another payload.",
      );
    }
    if (existing?.processedAt) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    const attemptedAt = new Date();
    if (existing) {
      await db
        .update(webhookEvents)
        .set({
          attempts: sql`${webhookEvents.attempts} + 1`,
          lastAttemptAt: attemptedAt,
          processingErrorCode: null,
        })
        .where(
          and(
            eq(webhookEvents.provider, "razorpay"),
            eq(webhookEvents.eventId, eventId),
          ),
        );
    } else {
      await db.insert(webhookEvents).values({
        provider: "razorpay",
        eventId,
        eventType: event.event,
        payloadHash,
        attempts: 1,
        lastAttemptAt: attemptedAt,
      });
    }

    try {
      const payment = event.payload.payment?.entity;
      if (event.event === "payment.captured" || event.event === "order.paid") {
        if (
          !payment ||
          payment.status !== "captured" ||
          payment.captured === false
        ) {
          throw new HttpError(
            400,
            "invalid_capture_event",
            "The capture event does not contain a captured payment.",
          );
        }
        const amountPaise = Number(payment.amount);
        if (!Number.isSafeInteger(amountPaise) || amountPaise < 0) {
          throw new HttpError(
            400,
            "invalid_payment_amount",
            "The webhook payment amount is invalid.",
          );
        }
        await fulfillRazorpayCapturedPayment({
          orderId: payment.order_id,
          paymentId: payment.id,
          amountPaise,
          currency: payment.currency,
          capturedAt: payment.created_at
            ? new Date(payment.created_at * 1000)
            : new Date(),
          requestId,
          source: "webhook",
        });
      } else if (event.event === "payment.failed" && payment) {
        await db
          .update(paymentOrders)
          .set({
            status: "failed",
            failedAt: new Date(),
            failureCode: payment.error_code ?? "provider_payment_failed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentOrders.provider, "razorpay"),
              eq(paymentOrders.providerReference, payment.order_id),
              ne(paymentOrders.status, "captured"),
            ),
          );
      }

      await db
        .update(webhookEvents)
        .set({ processedAt: new Date(), processingErrorCode: null })
        .where(
          and(
            eq(webhookEvents.provider, "razorpay"),
            eq(webhookEvents.eventId, eventId),
          ),
        );
      return NextResponse.json({ received: true });
    } catch (error) {
      await db
        .update(webhookEvents)
        .set({ processingErrorCode: processingErrorCode(error) })
        .where(
          and(
            eq(webhookEvents.provider, "razorpay"),
            eq(webhookEvents.eventId, eventId),
          ),
        );
      throw error;
    }
  } catch (error) {
    return jsonError(error, requestId);
  }
}
