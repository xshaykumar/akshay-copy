import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { assessmentReports } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { assertAssessmentAccess } from "@/lib/auth/file-access";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const metadataSchema = z.object({
  kind: z.literal("assessment-report"),
  relationId: z.uuid(),
});

const allowedTypes = {
  "assessment-report": new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
  ]),
} as const;

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const formData = await request.formData();
    const input = metadataSchema.parse({
      kind: formData.get("kind"),
      relationId: formData.get("relationId"),
    });
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "file_required", "Choose a file to upload.");
    }

    const maxSize = 10 * 1024 * 1024;
    if (
      file.size <= 0 ||
      file.size > maxSize ||
      !allowedTypes[input.kind].has(file.type)
    ) {
      throw new HttpError(
        400,
        "invalid_file",
        "The file type or size is not allowed.",
      );
    }

    await assertAssessmentAccess(input.relationId, user);
    if (
      !user.roles.includes("client") &&
      !user.roles.includes("coach") &&
      !user.roles.includes("admin")
    ) {
      throw new HttpError(
        403,
        "report_uploader_forbidden",
        "Only the client, their assigned coach, or an administrator can upload a report.",
      );
    }

    const bucket = "assessment-reports";
    const extension = file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")
      : "";
    const path = `${input.relationId}/${user.id}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      throw new HttpError(502, "storage_upload_failed", "The file could not be stored.");
    }

    try {
      const [record] = await getDb()
        .insert(assessmentReports)
        .values({
          assessmentId: input.relationId,
          storagePath: path,
          originalFilename: file.name.slice(0, 255),
          contentType: file.type,
          sizeBytes: file.size,
          uploadedByUserId: user.id,
        })
        .returning({ id: assessmentReports.id });
      return NextResponse.json({ file: record }, { status: 201 });
    } catch (error) {
      await admin.storage.from(bucket).remove([path]);
      throw error;
    }
  } catch (error) {
    return jsonError(error, requestId);
  }
}
