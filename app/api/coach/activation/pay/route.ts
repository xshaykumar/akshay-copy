import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachActivationPayments,
  coachProfiles,
  notifications,
  paymentOrders,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import {
  addActivationPeriod,
  coachActivationDurationSchema,
  coachActivationOptionFor,
  COACH_ACTIVATION_CURRENCY,
  isCoachProfileActive,
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

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    if (
      process.env.APP_ENV === "production" ||
      process.env.PAYMENTS_MODE !== "mock"
    ) {
      throw new HttpError(
        503,
        "payment_provider_unavailable",
        "Online activation payment is temporarily unavailable.",
      );
    }
    const coach = await requireRole("coach");
    const input = z.object({
      durationDays: coachActivationDurationSchema,
    }).parse(await request.json());
    const option = coachActivationOptionFor(input.durationDays);
    if (!option) {
      throw new HttpError(
        400,
        "activation_option_invalid",
        "Choose a valid coach activation period.",
      );
    }
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `coach-activation-payment:${coach.id}`,
      key,
      requestHash: hashRequest({
        coachUserId: coach.id,
        amountPaise: option.amountPaise,
        durationDays: input.durationDays,
      }),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT user_id FROM app.coach_profiles WHERE user_id = ${coach.id} FOR UPDATE`,
          );
          const [profile] = await transaction
            .select({
              approvedAt: coachProfiles.approvedAt,
              certificationWaivedAt: coachProfiles.certificationWaivedAt,
              activationExpiresAt: coachProfiles.activationExpiresAt,
            })
            .from(coachProfiles)
            .where(eq(coachProfiles.userId, coach.id))
            .limit(1);
          if (!profile) {
            throw new HttpError(
              404,
              "coach_profile_missing",
              "Coach profile not found.",
            );
          }

          const paidAt = new Date();
          const periodStartsAt =
            profile.activationExpiresAt && profile.activationExpiresAt > paidAt
              ? profile.activationExpiresAt
              : paidAt;
          const periodEndsAt = addActivationPeriod(
            periodStartsAt,
            input.durationDays,
          );
          const providerReference = crypto.randomUUID();
          const [paymentOrder] = await transaction
            .insert(paymentOrders)
            .values({
              userId: coach.id,
              purpose: "coach_activation",
              activationDurationDays: input.durationDays,
              provider: "testing",
              providerReference,
              providerPaymentId: providerReference,
              amountPaise: option.amountPaise,
              currency: COACH_ACTIVATION_CURRENCY,
              status: "captured",
              capturedAt: paidAt,
            })
            .returning({ id: paymentOrders.id });
          const [payment] = await transaction
            .insert(coachActivationPayments)
            .values({
              coachUserId: coach.id,
              paymentOrderId: paymentOrder.id,
              provider: "testing",
              providerReference,
              amountPaise: option.amountPaise,
              durationDays: input.durationDays,
              currency: COACH_ACTIVATION_CURRENCY,
              status: "captured",
              periodStartsAt,
              periodEndsAt,
              paidAt,
            })
            .returning({ id: coachActivationPayments.id });
          await transaction
            .update(coachProfiles)
            .set({ activationExpiresAt: periodEndsAt, updatedAt: paidAt })
            .where(eq(coachProfiles.userId, coach.id));
          const active = isCoachProfileActive({
            approvedAt: profile.approvedAt,
            certificationWaivedAt: profile.certificationWaivedAt,
            activationExpiresAt: periodEndsAt,
          });
          await transaction.insert(notifications).values({
            userId: coach.id,
            type: active
              ? "coach.activation_completed"
              : "coach.activation_fee_recorded",
            title: active
              ? "Your profile is active"
              : "Activation fee recorded",
            body: active
              ? `Congratulations! Your ${input.durationDays}-day activation is valid through ${periodEndsAt.toLocaleDateString("en-IN")}.`
              : "Your fee is recorded. Your profile will become active after your certification is approved.",
            actionUrl: "/coach",
            metadata: {
              paymentId: payment.id,
              durationDays: input.durationDays,
              periodEndsAt: periodEndsAt.toISOString(),
            },
          });
          await transaction.insert(auditLogs).values({
            actorUserId: coach.id,
            action: "coach.activation_fee_recorded",
            targetType: "coach_activation_payment",
            targetId: payment.id,
            requestId,
          });
          return {
            paymentId: payment.id,
            amountPaise: option.amountPaise,
            durationDays: input.durationDays,
            currency: COACH_ACTIVATION_CURRENCY,
            periodStartsAt,
            periodEndsAt,
            active,
          };
        });
        return { reference: value.paymentId, value };
      },
    });
    return NextResponse.json({
      activation: result.value,
      reference: result.reference,
      replayed: result.replayed,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
