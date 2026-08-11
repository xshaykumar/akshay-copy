import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  coachAssignments,
  notifications,
  paymentOrders,
  planPurchases,
  plans,
  scheduledJobs,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { CLIENT_SELECTION_WINDOW_MS } from "@/lib/assignments/lifecycle";
import { formatPlanDuration } from "@/lib/plans/duration";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";
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

const mockPaymentSchema = z.object({
  planCode: z.string().trim().min(2).max(50),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireRole("client");
    const input = mockPaymentSchema.parse(await request.json());
    if (
      process.env.APP_ENV === "production" ||
      process.env.PAYMENTS_MODE !== "mock"
    ) {
      throw new HttpError(404, "not_found", "This endpoint is unavailable.");
    }

    const key = requireIdempotencyKey(request);
    const db = getDb();
    await reconcileDueServiceCycles();
    const paymentProvider = "mock";
    const mockReference = `${paymentProvider}_${hashRequest({ userId: user.id, key }).slice(0, 40)}`;
    const result = await runIdempotent({
      scope: `${paymentProvider}-plan-purchase:${user.id}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const [existingPayment] = await db
          .select({
            purchaseId: paymentOrders.purchaseId,
          })
          .from(paymentOrders)
          .where(
            and(
              eq(paymentOrders.provider, paymentProvider),
              eq(paymentOrders.providerReference, mockReference),
            ),
          )
          .limit(1);
        if (existingPayment?.purchaseId) {
          const [existingAssignment] = await db
            .select({ id: coachAssignments.id })
            .from(coachAssignments)
            .where(eq(coachAssignments.purchaseId, existingPayment.purchaseId))
            .limit(1);
          return {
            reference: existingPayment.purchaseId,
            value: {
              purchaseId: existingPayment.purchaseId,
              assignmentId: existingAssignment?.id ?? null,
            },
          };
        }

        const value = await db.transaction(async (transaction) => {
          const [existingPlan] = await transaction
            .select({ id: planPurchases.id })
            .from(planPurchases)
            .where(
              and(
                eq(planPurchases.clientUserId, user.id),
                inArray(planPurchases.status, ["paid", "active"]),
              ),
            )
            .limit(1);
          if (existingPlan) {
            throw new HttpError(
              409,
              "active_plan_exists",
              "Complete or refund your current plan before purchasing another.",
            );
          }
          const [plan] = await transaction
            .select()
            .from(plans)
            .where(and(eq(plans.code, input.planCode), eq(plans.active, true)))
            .limit(1);
          if (!plan) {
            throw new HttpError(404, "plan_not_found", "The plan is unavailable.");
          }
          if (plan.pricePaise <= 0) {
            throw new HttpError(
              409,
              "paid_plan_required",
              "Only paid commercial plans are available.",
            );
          }

          const purchasedAt = new Date();
          const selectionWindowEndsAt = new Date(
            purchasedAt.getTime() + CLIENT_SELECTION_WINDOW_MS,
          );
          const [purchase] = await transaction
            .insert(planPurchases)
            .values({
              clientUserId: user.id,
              planId: plan.id,
              status: "paid",
              amountPaise: plan.pricePaise,
              currency: plan.currency,
              purchasedAt,
            })
            .returning({ id: planPurchases.id });

          await transaction.insert(paymentOrders).values({
            userId: user.id,
            purchaseId: purchase.id,
            purpose: "plan_purchase",
            provider: paymentProvider,
            providerReference: mockReference,
            amountPaise: plan.pricePaise,
            currency: plan.currency,
            status: "captured",
            capturedAt: purchasedAt,
          });

          const [assignment] = await transaction
            .insert(coachAssignments)
            .values({
              purchaseId: purchase.id,
              clientUserId: user.id,
              status: "selection",
              selectionWindowEndsAt,
            })
            .returning({ id: coachAssignments.id });

          await transaction.insert(scheduledJobs).values({
            jobType: "expire_coach_selection",
            deduplicationKey: `expire_coach_selection:${assignment.id}:cycle:1`,
            payload: { assignmentId: assignment.id },
            runAt: selectionWindowEndsAt,
          });
          await transaction.insert(notifications).values({
            userId: user.id,
            type: "plan.purchased",
            title: "Your plan is ready",
            body: `Congratulations! Your ${formatPlanDuration(plan.durationDays)} plan is ready. Send requests to up to three coaches before the 24-hour selection window closes.`,
            actionUrl: "/client/coaches",
            metadata: {
              assignmentId: assignment.id,
              purchaseId: purchase.id,
              selectionWindowEndsAt: selectionWindowEndsAt.toISOString(),
            },
          });

          return { purchaseId: purchase.id, assignmentId: assignment.id };
        });

        return { reference: value.purchaseId, value };
      },
    });

    return NextResponse.json({
      replayed: result.replayed,
      reference: result.reference,
      purchase: result.value,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
