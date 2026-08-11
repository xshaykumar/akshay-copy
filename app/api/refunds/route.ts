import { and, eq, lte, sql } from "drizzle-orm";
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
  userRoles,
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
import { reconcileAssignmentLifecycle } from "@/lib/assignments/lifecycle";

const indianMobileSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .refine(
    (value) => /^(?:\+91|91)?[6-9]\d{9}$/.test(value),
    "Enter a valid Indian mobile number.",
  )
  .transform((value) => `+91${value.slice(-10)}`);

const refundRequestSchema = z.object({
  paymentOrderId: z.uuid(),
  contactEmail: z.email().trim().toLowerCase(),
  contactPhone: indianMobileSchema,
  reasonCode: z.enum([
    "coach_unavailable",
    "duplicate_payment",
    "service_not_started",
    "other",
  ]),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireRole("client");
    const input = refundRequestSchema.parse(await request.json());
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `refund-request:${user.id}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const [existingRefund] = await getDb()
          .select({ id: refunds.id, status: refunds.status })
          .from(refunds)
          .where(
            and(
              eq(refunds.paymentOrderId, input.paymentOrderId),
              eq(refunds.requestedByUserId, user.id),
            ),
          )
          .limit(1);
        if (
          existingRefund &&
          ["requested", "approved", "processing"].includes(existingRefund.status)
        ) {
          return { reference: existingRefund.id, value: existingRefund };
        }

        const [paymentAssignment] = await getDb()
          .select({
            assignmentId: coachAssignments.id,
          })
          .from(paymentOrders)
          .innerJoin(
            coachAssignments,
            eq(coachAssignments.purchaseId, paymentOrders.purchaseId),
          )
          .where(
            and(
              eq(paymentOrders.id, input.paymentOrderId),
              eq(paymentOrders.userId, user.id),
            ),
          )
          .limit(1);
        if (paymentAssignment) {
          await reconcileAssignmentLifecycle(paymentAssignment.assignmentId);
        } else {
          throw new HttpError(
            404,
            "payment_not_refundable",
            "The payment is not connected to an eligible coach assignment.",
          );
        }

        const created = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT id FROM app.coach_assignments WHERE id = ${paymentAssignment.assignmentId} FOR UPDATE`,
          );
          const [eligible] = await transaction
            .select({
              paymentId: paymentOrders.id,
              purchaseId: paymentOrders.purchaseId,
              amountPaise: paymentOrders.amountPaise,
              assignmentId: coachAssignments.id,
            })
            .from(paymentOrders)
            .innerJoin(
              coachAssignments,
              eq(coachAssignments.purchaseId, paymentOrders.purchaseId),
            )
            .where(
              and(
                eq(paymentOrders.id, input.paymentOrderId),
                eq(paymentOrders.userId, user.id),
                eq(paymentOrders.status, "captured"),
                eq(coachAssignments.clientUserId, user.id),
                eq(coachAssignments.status, "selection"),
                lte(coachAssignments.refundEligibleAt, new Date()),
              ),
            )
            .limit(1);
          if (!eligible?.purchaseId) {
            throw new HttpError(
              409,
              "refund_not_yet_eligible",
              "A refund becomes available only after the first coach application phase ends without an assignment.",
            );
          }

          const [refund] = await transaction
            .insert(refunds)
            .values({
              paymentOrderId: eligible.paymentId,
              requestedByUserId: user.id,
              amountPaise: eligible.amountPaise,
              reasonCode: input.reasonCode,
              contactEmail: input.contactEmail,
              contactPhone: input.contactPhone,
            })
            .returning({ id: refunds.id, status: refunds.status });
          const admins = await transaction
            .select({ userId: userRoles.userId })
            .from(userRoles)
            .where(eq(userRoles.role, "admin"));
          const endedAt = new Date();
          await transaction
            .update(coachAssignments)
            .set({
              status: "cancelled",
              endedAt,
              updatedAt: endedAt,
            })
            .where(
              and(
                eq(coachAssignments.id, eligible.assignmentId),
                eq(coachAssignments.status, "selection"),
              ),
            );
          await transaction
            .update(planPurchases)
            .set({ status: "cancelled", updatedAt: endedAt })
            .where(eq(planPurchases.id, eligible.purchaseId));
          await transaction.insert(auditLogs).values({
            actorUserId: user.id,
            action: "refund.requested_assignment_cancelled",
            targetType: "coach_assignment",
            targetId: eligible.assignmentId,
            requestId,
          });
          await transaction.insert(notifications).values([
            {
              userId: user.id,
              type: "refund.requested",
              title: "Refund requested",
              body: "Your refund request was submitted and your coach-matching process has stopped.",
              actionUrl: "/client/plan",
              metadata: { refundId: refund.id },
            },
            ...admins.map((admin) => ({
              userId: admin.userId,
              type: "admin.refund_requested",
              title: "New refund request",
              body: "A client requested a refund after an unsuccessful coach-matching cycle.",
              actionUrl: "/admin/refunds",
              metadata: { refundId: refund.id },
            })),
          ]);
          return refund;
        });
        return { reference: created.id, value: created };
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
