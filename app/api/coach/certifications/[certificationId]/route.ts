import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs, coachCertifications, coachProfiles } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ certificationId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireRole("coach");
    const { certificationId } = await context.params;
    const id = z.uuid().parse(certificationId);
    const db = getDb();
    const [[profile], [record]] = await Promise.all([
      db
        .select({
          approvalStatus: coachProfiles.approvalStatus,
          rejectionReason: coachProfiles.rejectionReason,
          certificationSubmittedAt: coachProfiles.certificationSubmittedAt,
        })
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, coach.id))
        .limit(1),
      db
        .select({
          storagePath: coachCertifications.storagePath,
          verificationStatus: coachCertifications.verificationStatus,
        })
        .from(coachCertifications)
        .where(
          and(
            eq(coachCertifications.id, id),
            eq(coachCertifications.coachUserId, coach.id),
          ),
        )
        .limit(1),
    ]);
    if (!record) throw new HttpError(404, "certification_not_found", "The qualification was not found.");
    if (
      !profile ||
      profile.approvalStatus === "suspended" ||
      record.verificationStatus === "submitted" ||
      record.verificationStatus === "approved"
    ) {
      throw new HttpError(409, "certification_locked", "This certification application is currently locked.");
    }

    await db.transaction(async (transaction) => {
      await transaction
        .delete(coachCertifications)
        .where(
          and(
            eq(coachCertifications.id, id),
            eq(coachCertifications.coachUserId, coach.id),
          ),
        );
      const remaining = await transaction
        .select({ verificationStatus: coachCertifications.verificationStatus })
        .from(coachCertifications)
        .where(eq(coachCertifications.coachUserId, coach.id));
      const nextStatus = remaining.some((item) => item.verificationStatus === "submitted")
        ? "submitted"
        : remaining.some((item) => item.verificationStatus === "draft")
          ? "draft"
          : remaining.some((item) => item.verificationStatus === "rejected")
            ? "rejected"
            : remaining.some((item) => item.verificationStatus === "approved")
              ? "approved"
              : "draft";
      await transaction
        .update(coachProfiles)
        .set({
          approvalStatus: nextStatus,
          rejectionReason: nextStatus === "rejected" ? profile.rejectionReason : null,
          certificationSubmittedAt:
            nextStatus === "submitted" ? profile.certificationSubmittedAt : null,
          updatedAt: new Date(),
        })
        .where(eq(coachProfiles.userId, coach.id));
      await transaction.insert(auditLogs).values({
        actorUserId: coach.id,
        action: "coach.certification_removed",
        targetType: "coach_certification",
        targetId: id,
        requestId,
      });
    });
    await createAdminClient().storage.from("coach-certificates").remove([record.storagePath]);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
