import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs, coachCertifications, coachProfiles } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { coachQualificationSchema } from "@/lib/coaches/certifications";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_CERTIFICATE_BYTES = 1024 * 1024;
const allowedCertificateTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireRole("coach");
    const formData = await request.formData();
    const qualificationType = coachQualificationSchema.parse(
      formData.get("qualificationType"),
    );
    const qualificationTitle =
      qualificationType === "other"
        ? z
            .string()
            .trim()
            .min(3)
            .max(120)
            .parse(formData.get("qualificationTitle"))
        : null;
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "certificate_required", "Choose a certificate to upload.");
    }
    if (
      file.size <= 0 ||
      file.size > MAX_CERTIFICATE_BYTES ||
      !allowedCertificateTypes.has(file.type)
    ) {
      throw new HttpError(
        400,
        "invalid_certificate",
        "Certificates must be PDF, JPG, JPEG, or PNG and no larger than 1 MB.",
      );
    }

    const db = getDb();
    const [[profile], [existing]] = await Promise.all([
      db
        .select({ approvalStatus: coachProfiles.approvalStatus })
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, coach.id))
        .limit(1),
      db
        .select({ id: coachCertifications.id })
        .from(coachCertifications)
        .where(
          and(
            eq(coachCertifications.coachUserId, coach.id),
            eq(coachCertifications.qualificationType, qualificationType),
          ),
        )
        .limit(1),
    ]);
    if (!profile) throw new HttpError(404, "coach_profile_missing", "Coach profile not found.");
    if (["submitted", "suspended"].includes(profile.approvalStatus)) {
      throw new HttpError(409, "certification_locked", "This certification application is currently locked.");
    }
    if (existing) {
      throw new HttpError(409, "qualification_exists", "That qualification has already been added.");
    }

    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const storagePath = `${coach.id}/${crypto.randomUUID()}.${extension}`;
    const storage = createAdminClient().storage.from("coach-certificates");
    const { error: uploadError } = await storage.upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      throw new HttpError(502, "certificate_upload_failed", "The certificate could not be stored.");
    }

    try {
      const [certification] = await db.transaction(async (transaction) => {
        const result = await transaction
          .insert(coachCertifications)
          .values({
            coachUserId: coach.id,
            qualificationType,
            qualificationTitle,
            storagePath,
            originalFilename: file.name.slice(0, 255),
            contentType: file.type,
            sizeBytes: file.size,
            verificationStatus: "draft",
          })
          .returning({ id: coachCertifications.id });
        await transaction
          .update(coachProfiles)
          .set({
            approvalStatus: "draft",
            rejectionReason: null,
            certificationSubmittedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(coachProfiles.userId, coach.id));
        await transaction.insert(auditLogs).values({
          actorUserId: coach.id,
          action: "coach.certification_added",
          targetType: "coach_certification",
          targetId: result[0].id,
          requestId,
        });
        return result;
      });
      return NextResponse.json({ certification }, { status: 201 });
    } catch (error) {
      await storage.remove([storagePath]);
      throw error;
    }
  } catch (error) {
    return jsonError(error, requestId);
  }
}
