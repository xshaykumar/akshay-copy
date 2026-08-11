import "server-only";

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { profilePhotos } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getProfilePhotoUrl(userId: string) {
  const [photo] = await getDb()
    .select({ storagePath: profilePhotos.storagePath })
    .from(profilePhotos)
    .where(eq(profilePhotos.userId, userId))
    .limit(1);
  if (!photo) return null;

  const { data, error } = await createAdminClient()
    .storage
    .from("profile-photos")
    .createSignedUrl(photo.storagePath, 60 * 60);
  return error ? null : data?.signedUrl ?? null;
}

export async function getProfilePhotoUrls(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map<string, string | null>();
  const photos = await getDb()
    .select({ userId: profilePhotos.userId, storagePath: profilePhotos.storagePath })
    .from(profilePhotos)
    .where(inArray(profilePhotos.userId, uniqueIds));
  const storage = createAdminClient().storage.from("profile-photos");
  const entries = await Promise.all(photos.map(async (photo) => {
    const { data, error } = await storage.createSignedUrl(photo.storagePath, 60 * 60);
    return [photo.userId, error ? null : data?.signedUrl ?? null] as const;
  }));
  return new Map(entries);
}
