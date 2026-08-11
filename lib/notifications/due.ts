import "server-only";

import { and, asc, eq, gt, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  coachProfiles,
  coachingSessions,
  notifications,
  planPurchases,
} from "@/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export async function createDueNotificationsForUser(
  userId: string,
  now = new Date(),
) {
  const sevenDaysFromNow = new Date(now.getTime() + 7 * DAY_MS);
  const twentyFourHoursFromNow = new Date(now.getTime() + DAY_MS);
  const [[plan], [coachProfile], upcomingSessions] = await Promise.all([
    getDb()
      .select({
        id: planPurchases.id,
        expiresAt: planPurchases.expiresAt,
      })
      .from(planPurchases)
      .where(
        and(
          eq(planPurchases.clientUserId, userId),
          eq(planPurchases.status, "active"),
          gt(planPurchases.expiresAt, now),
          lte(planPurchases.expiresAt, sevenDaysFromNow),
        ),
      )
      .orderBy(asc(planPurchases.expiresAt))
      .limit(1),
    getDb()
      .select({
        activationExpiresAt: coachProfiles.activationExpiresAt,
      })
      .from(coachProfiles)
      .where(
        and(
          eq(coachProfiles.userId, userId),
          gt(coachProfiles.activationExpiresAt, now),
          lte(coachProfiles.activationExpiresAt, sevenDaysFromNow),
        ),
      )
      .limit(1),
    getDb()
      .select({
        id: coachingSessions.id,
        title: coachingSessions.title,
        startsAt: coachingSessions.startsAt,
        coachUserId: coachingSessions.coachUserId,
      })
      .from(coachingSessions)
      .where(
        and(
          eq(coachingSessions.status, "scheduled"),
          gt(coachingSessions.startsAt, now),
          lte(coachingSessions.startsAt, twentyFourHoursFromNow),
          or(
            eq(coachingSessions.clientUserId, userId),
            eq(coachingSessions.coachUserId, userId),
          ),
        ),
      )
      .orderBy(asc(coachingSessions.startsAt))
      .limit(10),
  ]);

  const rows: (typeof notifications.$inferInsert)[] = [];
  if (plan?.expiresAt) {
    const oneDay = plan.expiresAt.getTime() - now.getTime() <= DAY_MS;
    rows.push({
      userId,
      type: "plan.expiring",
      deduplicationKey: `plan-expiry:${plan.id}:${oneDay ? "1d" : "7d"}`,
      title: oneDay ? "Plan ends within 24 hours" : "Plan ends soon",
      body: `Your plan ends on ${plan.expiresAt.toLocaleString("en-IN")}.`,
      actionUrl: "/client/plan",
      metadata: { purchaseId: plan.id, oneDay },
    });
  }
  if (coachProfile?.activationExpiresAt) {
    const oneDay =
      coachProfile.activationExpiresAt.getTime() - now.getTime() <= DAY_MS;
    rows.push({
      userId,
      type: "coach.activation_expiring",
      deduplicationKey: `coach-activation-expiry:${userId}:${coachProfile.activationExpiresAt.toISOString()}:${oneDay ? "1d" : "7d"}`,
      title: oneDay
        ? "Profile activation ends within 24 hours"
        : "Profile activation ends soon",
      body: `Renew before ${coachProfile.activationExpiresAt.toLocaleString("en-IN")} to keep your profile active.`,
      actionUrl: "/coach/activation",
      metadata: { oneDay },
    });
  }
  for (const session of upcomingSessions) {
    const oneHour = session.startsAt.getTime() - now.getTime() <= HOUR_MS;
    rows.push({
      userId,
      type: "session.reminder",
      deduplicationKey: `session-reminder:${session.id}:${oneHour ? "1h" : "24h"}:${userId}`,
      title: oneHour ? "Session begins within one hour" : "Session tomorrow",
      body: `${session.title} starts at ${session.startsAt.toLocaleString("en-IN")}.`,
      actionUrl:
        session.coachUserId === userId
          ? "/coach/schedule"
          : "/client/schedule",
      metadata: { sessionId: session.id, oneHour },
    });
  }
  if (rows.length > 0) {
    await getDb().insert(notifications).values(rows).onConflictDoNothing();
  }
}
