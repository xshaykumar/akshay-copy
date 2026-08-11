import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditLogs, coachProfiles } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { coachAvailabilitySchema } from "@/lib/coaches/activation";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";

export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireRole("coach");
    const input = coachAvailabilitySchema.parse(await request.json());
    const [profile] = await getDb().transaction(async (transaction) => {
      const rows = await transaction
        .update(coachProfiles)
        .set({
          availableDays: [...new Set(input.availableDays)],
          availableTimeSlots: [...new Set(input.availableTimeSlots)],
          locationState: input.locationState,
          locationCity: input.locationCity,
          locationDistrict: input.locationDistrict,
          locationLabel: [
            input.locationDistrict,
            input.locationCity,
            input.locationState,
          ].join(", "),
          updatedAt: new Date(),
        })
        .where(eq(coachProfiles.userId, coach.id))
        .returning({
          userId: coachProfiles.userId,
          availableDays: coachProfiles.availableDays,
          availableTimeSlots: coachProfiles.availableTimeSlots,
          locationState: coachProfiles.locationState,
          locationCity: coachProfiles.locationCity,
          locationDistrict: coachProfiles.locationDistrict,
        });
      if (!rows[0]) {
        throw new HttpError(
          404,
          "coach_profile_missing",
          "Coach profile not found.",
        );
      }
      await transaction.insert(auditLogs).values({
        actorUserId: coach.id,
        action: "coach.availability_updated",
        targetType: "user",
        targetId: coach.id,
        requestId,
      });
      return rows;
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
