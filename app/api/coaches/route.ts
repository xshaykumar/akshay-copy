import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  coachProfiles,
  coachSpecialties,
  users,
} from "@/db/schema";
import { jsonError, requestIdFrom } from "@/lib/http/errors";
import { activeCoachConditions } from "@/lib/coaches/activation";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const db = getDb();
    const coachRows = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        slug: coachProfiles.slug,
        yearsExperience: coachProfiles.yearsExperience,
        languages: coachProfiles.languages,
        coachingModes: coachProfiles.coachingModes,
        locationLabel: coachProfiles.locationLabel,
        locationState: coachProfiles.locationState,
        locationCity: coachProfiles.locationCity,
        locationDistrict: coachProfiles.locationDistrict,
        availableDays: coachProfiles.availableDays,
        availableTimeSlots: coachProfiles.availableTimeSlots,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(users.id, coachProfiles.userId))
      .where(
        and(
          activeCoachConditions(),
          eq(coachProfiles.acceptingClients, true),
          eq(users.status, "active"),
        ),
      )
      .orderBy(asc(users.displayName));

    const specialtyRows = await db
      .select()
      .from(coachSpecialties)
      .orderBy(asc(coachSpecialties.specialty));
    const specialtiesByCoach = Map.groupBy(
      specialtyRows,
      ({ coachUserId }) => coachUserId,
    );

    return NextResponse.json({
      coaches: coachRows.map((coach) => ({
        ...coach,
        specialties:
          specialtiesByCoach
            .get(coach.userId)
            ?.map(({ specialty }) => specialty) ?? [],
      })),
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
