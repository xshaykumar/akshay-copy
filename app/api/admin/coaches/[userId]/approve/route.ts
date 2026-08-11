import { and, count, eq, sql } from "drizzle-orm";
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

const DEFAULT_ACCEPTANCE_MESSAGE =
  "Thank you for your submission. Welcome to 360 Performance. Please complete your activation details to make your profile active.";

const approvalSchema = z.object({
  message: z.string().trim().max(1000).optional(),
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
    const input = approvalSchema.parse(await request.json().catch(() => ({})));
    const reviewMessage = input.message || DEFAULT_ACCEPTANCE_MESSAGE;
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `approve-coach:${targetUserId}`,
      key,
      requestHash: hashRequest({ targetUserId, reviewMessage }),
      operation: async () => {
        const [approved] = await getDb().transaction(async (transaction) => {
          const [[profile], [certificationCount]] = await Promise.all([
            transaction
              .select({
                approvedAt: coachProfiles.approvedAt,
                activationExpiresAt: coachProfiles.activationExpiresAt,
              })
              .from(coachProfiles)
              .where(
                and(
                  eq(coachProfiles.userId, targetUserId),
                  eq(coachProfiles.approvalStatus, "submitted"),
                ),
              )
              .limit(1),
            transaction
              .select({ value: count() })
              .from(coachCertifications)
              .where(
                and(
                  eq(coachCertifications.coachUserId, targetUserId),
                  eq(coachCertifications.verificationStatus, "submitted"),
                ),
              ),
          ]);
          if (!profile) {
            throw new HttpError(
              409,
              "coach_not_submitted",
              "The coach application is not awaiting approval.",
            );
          }
          if (certificationCount.value < 1) {
            throw new HttpError(
              409,
              "coach_certification_missing",
              "The coach has not uploaded an eligible certification.",
            );
          }
          const reviewedAt = new Date();
          await transaction
            .update(coachCertifications)
            .set({
              verificationStatus: "approved",
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
          const result = await transaction
            .update(coachProfiles)
            .set({
              approvalStatus: "approved",
              approvedAt: profile.approvedAt ?? reviewedAt,
              approvedByUserId: admin.id,
              rejectionReason: null,
              certificationReviewMessage: reviewMessage,
              athleteExecutiveEligible: sql<boolean>`exists (
                select 1
                from app.coach_certifications certification
                where certification.coach_user_id = ${targetUserId}
                  and certification.verification_status = 'approved'
                  and certification.qualification_type <> 'other'
              )`,
              updatedAt: reviewedAt,
            })
            .where(
              and(
                eq(coachProfiles.userId, targetUserId),
                eq(coachProfiles.approvalStatus, "submitted"),
              ),
            )
            .returning({ userId: coachProfiles.userId });
          if (result[0]) {
            const active = Boolean(
              profile.activationExpiresAt &&
                profile.activationExpiresAt > reviewedAt,
            );
            await transaction.insert(notifications).values([
              {
                userId: targetUserId,
                type: "coach.certification_approved",
                title: "Certification approved",
                body: reviewMessage,
                actionUrl: "/coach/certification",
                metadata: { reviewedByUserId: admin.id },
              },
              ...(active
                ? [
                    {
                      userId: targetUserId,
                      type: "coach.activation_completed",
                      title: "Your profile is active",
                      body: `Congratulations! Certification and activation are complete. Your profile is active through ${profile.activationExpiresAt?.toLocaleDateString("en-IN")}.`,
                      actionUrl: "/coach",
                      metadata: {
                        periodEndsAt:
                          profile.activationExpiresAt?.toISOString() ?? null,
                      },
                    },
                  ]
                : []),
            ]);
            await transaction.insert(auditLogs).values({
              actorUserId: admin.id,
              action: "coach.certifications_approved",
              targetType: "user",
              targetId: targetUserId,
              requestId,
            });
          }
          return result;
        });
        if (!approved) {
          throw new HttpError(
            409,
            "coach_not_submitted",
            "The coach application is not awaiting approval.",
          );
        }
        return {
          reference: targetUserId,
          value: {
            userId: targetUserId,
            status: "approved" as const,
            message: reviewMessage,
          },
        };
      },
    });
    return NextResponse.json({
      coach: result.value,
      reference: result.reference,
      replayed: result.replayed,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
