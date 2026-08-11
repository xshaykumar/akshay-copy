import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachProfiles,
  coachSpecialties,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { isCoachProfileActive } from "@/lib/coaches/activation";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";

const profileSchema = z.object({
  yearsExperience: z.number().int("Years of experience must be a whole number.").min(0, "Years of experience cannot be negative.").max(70, "Years of experience cannot exceed 70."),
  languages: z.array(z.string().trim().min(2, "Each language must contain at least 2 characters.").max(40, "Each language must contain no more than 40 characters.")).min(1, "Enter at least one language.").max(10, "Enter no more than 10 languages."),
  coachingModes: z
    .array(z.enum(["online", "offline"]))
    .min(1, "Select at least one coaching mode.")
    .max(2, "Select no more than two coaching modes."),
  locationLabel: z.string().trim().max(100).nullable(),
  specialties: z.array(z.string().trim().min(2, "Each specialty must contain at least 2 characters.").max(60, "Each specialty must contain no more than 60 characters.")).min(1, "Enter at least one specialty.").max(12, "Enter no more than 12 specialties."),
  acceptingClients: z.boolean(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await requireRole("coach");
    const db = getDb();
    const [profile] = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, user.id))
      .limit(1);
    const specialties = await db
      .select({ specialty: coachSpecialties.specialty })
      .from(coachSpecialties)
      .where(eq(coachSpecialties.coachUserId, user.id));
    return NextResponse.json({
      profile: profile
        ? {
            ...profile,
            specialties: specialties.map(({ specialty }) => specialty),
          }
        : null,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireRole("coach");
    const input = profileSchema.parse(await request.json());
    const value = await getDb().transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, user.id))
        .limit(1);
      if (!current) {
        throw new HttpError(404, "coach_profile_missing", "Coach profile not found.");
      }
      const active = isCoachProfileActive(current);
      if (input.acceptingClients && !active) {
        throw new HttpError(
          409,
          "coach_not_active",
          "Accepting clients can be enabled after certification approval and a valid 30-day activation.",
        );
      }
      const [profile] = await transaction
        .update(coachProfiles)
        .set({
          yearsExperience: input.yearsExperience,
          languages: [...new Set(input.languages)],
          coachingModes: [...new Set(input.coachingModes)],
          locationLabel: input.locationLabel,
          acceptingClients:
            active && input.acceptingClients,
          updatedAt: new Date(),
        })
        .where(eq(coachProfiles.userId, user.id))
        .returning({
          userId: coachProfiles.userId,
          approvalStatus: coachProfiles.approvalStatus,
          acceptingClients: coachProfiles.acceptingClients,
        });
      await transaction
        .delete(coachSpecialties)
        .where(eq(coachSpecialties.coachUserId, user.id));
      await transaction.insert(coachSpecialties).values(
        [...new Set(input.specialties)].map((specialty) => ({
          coachUserId: user.id,
          specialty,
        })),
      );
      await transaction.insert(auditLogs).values({
        actorUserId: user.id,
        action: "coach.profile_updated",
        targetType: "user",
        targetId: user.id,
        requestId,
      });
      return profile;
    });
    return NextResponse.json({ profile: value });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
