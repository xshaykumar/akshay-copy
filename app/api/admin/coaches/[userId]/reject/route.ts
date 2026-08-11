import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachCertifications,
  coachProfiles,
  notifications,
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

const rejectionSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const admin = await requireRole("admin");
    const { userId } = await context.params;
    const targetUserId = z.uuid().parse(userId);
    const input = rejectionSchema.parse(await request.json());
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `reject-coach:${targetUserId}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const [rejected] = await getDb().transaction(async (transaction) => {
          const [profile] = await transaction
            .select({
              approvedAt: coachProfiles.approvedAt,
              acceptingClients: coachProfiles.acceptingClients,
            })
            .from(coachProfiles)
            .where(
              and(
                eq(coachProfiles.userId, targetUserId),
                eq(coachProfiles.approvalStatus, "submitted"),
              ),
            )
            .limit(1);
          if (!profile) {
            throw new HttpError(
              409,
              "coach_not_submitted",
              "The coach application is not awaiting review.",
            );
          }
          const reviewedAt = new Date();
          await transaction
            .update(coachCertifications)
            .set({
              verificationStatus: "rejected",
              reviewedAt,
              reviewedByUserId: admin.id,
              updatedAt: reviewedAt,
            })
            .where(
              and(
                eq(coachCertifications.coachUserId, targetUserId),
                eq(coachCertifications.verificationStatus, "submitted"),
              ),
            );
          const rows = await transaction
            .update(coachProfiles)
            .set({
              approvalStatus: "rejected",
              rejectionReason: input.reason,
              certificationReviewMessage: input.reason,
              acceptingClients: profile.approvedAt
                ? profile.acceptingClients
                : false,
              updatedAt: reviewedAt,
            })
            .where(
              and(
                eq(coachProfiles.userId, targetUserId),
                eq(coachProfiles.approvalStatus, "submitted"),
              ),
            )
            .returning({ userId: coachProfiles.userId });
          if (rows[0]) {
            await transaction.insert(notifications).values({
              userId: targetUserId,
              type: "coach.certification_rejected",
              title: "Certification needs attention",
              body: input.reason,
              actionUrl: "/coach/certification",
              metadata: { reviewedByUserId: admin.id },
            });
            await transaction.insert(auditLogs).values({
              actorUserId: admin.id,
              action: "coach.certifications_rejected",
              targetType: "user",
              targetId: targetUserId,
              requestId,
            });
          }
          return rows;
        });
        if (!rejected) {
          throw new HttpError(409, "coach_not_submitted", "The coach application is not awaiting review.");
        }
        return {
          reference: targetUserId,
          value: { userId: targetUserId, status: "rejected" as const },
        };
      },
    });
    return NextResponse.json({ coach: result.value, replayed: result.replayed });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
