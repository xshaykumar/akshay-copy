import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  coachAssignments,
  coachProfiles,
  clientProfiles,
  planPurchases,
  plans,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { activeCoachConditions } from "@/lib/coaches/activation";
import { coachCanServePlan } from "@/lib/plans/coach-eligibility";
import { reconcileDueAssignmentLifecycles } from "@/lib/assignments/lifecycle";
import { HttpError, jsonError, requestIdFrom } from "@/lib/http/errors";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const coach = await requireRole("coach");
    const [profile] = await getDb()
      .select()
      .from(coachProfiles)
      .where(
        and(
          eq(coachProfiles.userId, coach.id),
          activeCoachConditions(),
          eq(coachProfiles.acceptingClients, true),
        ),
      )
      .limit(1);
    if (!profile) {
      throw new HttpError(
        403,
        "coach_not_available",
        "An active coach profile that is accepting clients is required.",
      );
    }
    await reconcileDueAssignmentLifecycles();
    const rows = await getDb()
      .select({
        id: coachAssignments.id,
        planCode: plans.code,
        planName: plans.name,
        coachingMode: plans.coachingMode,
        durationDays: plans.durationDays,
        availableSince: coachAssignments.updatedAt,
        applicationWindowEndsAt: coachAssignments.applicationWindowEndsAt,
        cycleNumber: coachAssignments.cycleNumber,
        state: clientProfiles.locationState,
        city: clientProfiles.locationCity,
        district: clientProfiles.locationDistrict,
      })
      .from(coachAssignments)
      .innerJoin(planPurchases, eq(planPurchases.id, coachAssignments.purchaseId))
      .innerJoin(plans, eq(plans.id, planPurchases.planId))
      .leftJoin(
        clientProfiles,
        eq(clientProfiles.userId, coachAssignments.clientUserId),
      )
      .where(
        and(
          eq(coachAssignments.status, "open_pool"),
          eq(planPurchases.status, "paid"),
          or(
            isNull(coachAssignments.applicationWindowEndsAt),
            gt(coachAssignments.applicationWindowEndsAt, new Date()),
          ),
        ),
      )
      .orderBy(asc(coachAssignments.updatedAt))
      .limit(100);
    return NextResponse.json({
      opportunities: rows.filter((row) =>
        coachCanServePlan(profile, { code: row.planCode, name: row.planName }),
      ),
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
