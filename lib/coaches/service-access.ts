import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { coachProfiles } from "@/db/schema";
import { HttpError } from "@/lib/http/errors";

export function hasCurrentCoachServiceAccess(
  profile: { activationExpiresAt?: Date | string | null },
  now = new Date(),
) {
  return Boolean(
    profile.activationExpiresAt &&
      new Date(profile.activationExpiresAt).getTime() > now.getTime(),
  );
}

export async function coachHasCurrentServiceAccess(
  coachUserId: string,
  now = new Date(),
) {
  const [profile] = await getDb()
    .select({ activationExpiresAt: coachProfiles.activationExpiresAt })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, coachUserId))
    .limit(1);

  return Boolean(profile && hasCurrentCoachServiceAccess(profile, now));
}

export async function requireCurrentCoachServiceAccess(
  coachUserId: string,
  now = new Date(),
) {
  if (!(await coachHasCurrentServiceAccess(coachUserId, now))) {
    throw new HttpError(
      403,
      "coach_activation_required",
      "Reactivate your coach account to access clients, groups, and sessions.",
    );
  }
}
