import { eq } from "drizzle-orm";
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

const signedUrlSchema = z.object({
  kind: z.literal("assessment-report"),
  fileId: z.uuid(),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = signedUrlSchema.parse(await request.json());
    const db = getDb();
    const [record] = await db
      .select()
      .from(assessmentReports)
      .where(eq(assessmentReports.id, input.fileId))
      .limit(1);
    if (!record) {
      throw new HttpError(404, "file_not_found", "The file was not found.");
    }
    await assertAssessmentAccess(record.assessmentId, user);

    const { data, error } = await createAdminClient()
      .storage.from("assessment-reports")
      .createSignedUrl(record.storagePath, 60);
    if (error || !data) {
      throw new HttpError(502, "signed_url_failed", "The file link could not be created.");
    }
    return NextResponse.json({ url: data.signedUrl, expiresIn: 60 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
