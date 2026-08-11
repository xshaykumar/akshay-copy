import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  notifications,
  paymentOrders,
  planPurchases,
  refunds,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
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

export async function POST(
  request: Request,
  context: { params: Promise<{ refundId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const admin = await requireRole("admin");
    const { refundId } = await context.params;
    const id = z.uuid().parse(refundId);
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `approve-refund:${id}`,
      key,
      requestHash: hashRequest({ id }),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          const [refund] = await transaction
            .select()
            .from(refunds)
            .where(
              and(eq(refunds.id, id), eq(refunds.status, "requested")),
            )
            .limit(1);
          const [alreadyCompleted] = refund
            ? [null]
            : await transaction
                .select({ id: refunds.id, status: refunds.status })
                .from(refunds)
                .where(
                  and(eq(refunds.id, id), eq(refunds.status, "completed")),
                )
                .limit(1);
          if (alreadyCompleted) {
            return { id, status: "completed" as const };
          }
          if (!refund) {
            throw new HttpError(
              409,
              "refund_unavailable",
              "The refund is not awaiting approval.",
            );
          }
          const mockReference = `mock_refund_${crypto.randomUUID()}`;
          await transaction
            .update(refunds)
            .set({
              status: "completed",
              providerReference: mockReference,
              updatedAt: new Date(),
            })
            .where(eq(refunds.id, id));
          const [payment] = await transaction
            .update(paymentOrders)
            .set({ status: "refunded", updatedAt: new Date() })
            .where(eq(paymentOrders.id, refund.paymentOrderId))
            .returning({ purchaseId: paymentOrders.purchaseId });
          if (payment?.purchaseId) {
            await transaction
              .update(planPurchases)
              .set({ status: "refunded", updatedAt: new Date() })
              .where(eq(planPurchases.id, payment.purchaseId));
            await transaction
              .update(coachAssignments)
              .set({
                status: "cancelled",
                endedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(coachAssignments.purchaseId, payment.purchaseId));
          }
          if (refund.requestedByUserId) {
            await transaction.insert(notifications).values({
              userId: refund.requestedByUserId,
              type: "refund.completed",
              title: "Refund completed",
              body: "Your refund was approved and marked complete.",
              actionUrl: "/client/plan",
              metadata: {
                refundId: id,
                providerReference: mockReference,
              },
            });
          }
          await transaction.insert(auditLogs).values({
            actorUserId: admin.id,
            action: "refund.approved",
            targetType: "refund",
            targetId: id,
            requestId,
          });
          return { id, status: "completed" as const };
        });
        return { reference: id, value };
      },
    });
    return NextResponse.json({
      refund: result.value,
      reference: result.reference,
      replayed: result.replayed,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
