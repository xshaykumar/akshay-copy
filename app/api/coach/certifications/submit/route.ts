import { and, count, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  auditLogs,
  coachCertifications,
  coachProfiles,
  notifications,
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

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireRole("coach");
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `submit-coach-certifications:${coach.id}`,
      key,
      requestHash: hashRequest({ coachUserId: coach.id }),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          const [[profile], [certificationCount]] = await Promise.all([
            transaction
              .select({ approvalStatus: coachProfiles.approvalStatus })
              .from(coachProfiles)
              .where(eq(coachProfiles.userId, coach.id))
              .limit(1),
            transaction
              .select({ value: count() })
              .from(coachCertifications)
              .where(
                and(
                  eq(coachCertifications.coachUserId, coach.id),
                  inArray(coachCertifications.verificationStatus, [
                    "draft",
                    "rejected",
                  ]),
                ),
              ),
          ]);
          if (!profile) throw new HttpError(404, "coach_profile_missing", "Coach profile not found.");
          if (profile.approvalStatus === "submitted") {
            return { userId: coach.id, status: "submitted" as const };
          }
          if (profile.approvalStatus === "suspended") {
            throw new HttpError(409, "certification_locked", "This certification application cannot be submitted.");
          }
          if (certificationCount.value < 1) {
            throw new HttpError(400, "qualification_required", "Add at least one eligible qualification and certificate.");
          }
          await transaction
            .update(coachCertifications)
            .set({
              verificationStatus: "submitted",
              reviewedAt: null,
              reviewedByUserId: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(coachCertifications.coachUserId, coach.id),
                inArray(coachCertifications.verificationStatus, [
                  "draft",
                  "rejected",
                ]),
              ),
            );
          await transaction
            .update(coachProfiles)
            .set({
              approvalStatus: "submitted",
              rejectionReason: null,
              certificationReviewMessage: null,
              certificationSubmittedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(coachProfiles.userId, coach.id));
          const admins = await transaction
            .select({ userId: userRoles.userId })
            .from(userRoles)
            .where(eq(userRoles.role, "admin"));
          await transaction.insert(notifications).values([
            {
              userId: coach.id,
              type: "coach.certification_submitted",
              title: "Certification submitted",
              body: "Your certificates were sent to the administrator for review.",
              actionUrl: "/coach/certification",
              metadata: {},
            },
            ...admins.map((admin) => ({
              userId: admin.userId,
              type: "admin.certification_submitted",
              title: "New coach certification",
              body: "A coach submitted certificates for verification.",
              actionUrl: "/admin/verification",
              metadata: { coachUserId: coach.id },
            })),
          ]);
          await transaction.insert(auditLogs).values({
            actorUserId: coach.id,
            action: "coach.certifications_submitted",
            targetType: "user",
            targetId: coach.id,
            requestId,
          });
          return { userId: coach.id, status: "submitted" as const };
        });
        return { reference: coach.id, value };
      },
    });
    return NextResponse.json({ coach: result.value, replayed: result.replayed });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
