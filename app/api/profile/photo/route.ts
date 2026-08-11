import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { profilePhotos } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PROFILE_PHOTO_BYTES = 500 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png"]);

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (!user.roles.includes("client") && !user.roles.includes("coach")) {
      throw new HttpError(403, "profile_photo_forbidden", "Profile photos are available to client and coach accounts.");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "file_required", "Choose a cropped profile photo.");
    }
    if (
      file.size <= 0 ||
      file.size > MAX_PROFILE_PHOTO_BYTES ||
      !allowedPhotoTypes.has(file.type)
    ) {
      throw new HttpError(
        400,
        "invalid_profile_photo",
        "Use a JPG, JPEG, or PNG profile photo no larger than 500 KB.",
      );
    }

    const db = getDb();
    const [existing] = await db
      .select({ storagePath: profilePhotos.storagePath })
      .from(profilePhotos)
      .where(eq(profilePhotos.userId, user.id))
      .limit(1);
    const extension = file.type === "image/png" ? "png" : "jpg";
    const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const storage = createAdminClient().storage.from("profile-photos");
    const { error: uploadError } = await storage.upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      throw new HttpError(502, "profile_photo_upload_failed", "The profile photo could not be stored.");
    }

    try {
      await db
        .insert(profilePhotos)
        .values({
          userId: user.id,
          storagePath,
          originalFilename: file.name.slice(0, 255),
          contentType: file.type,
          sizeBytes: file.size,
        })
        .onConflictDoUpdate({
          target: profilePhotos.userId,
          set: {
            storagePath,
            originalFilename: file.name.slice(0, 255),
            contentType: file.type,
            sizeBytes: file.size,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      await storage.remove([storagePath]);
      throw error;
    }

    if (existing?.storagePath && existing.storagePath !== storagePath) {
      await storage.remove([existing.storagePath]);
    }

    return NextResponse.json({ photo: { uploaded: true } }, { status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
