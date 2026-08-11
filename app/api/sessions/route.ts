import { and, asc, eq, gt, isNotNull, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  coachingGroupMembers,
  coachingGroupSessions,
  coachingSessions,
  notifications,
  planPurchases,
  serviceCycles,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { requireCurrentCoachServiceAccess } from "@/lib/coaches/service-access";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { parseGoogleMeetUrl } from "@/lib/meetings/google-meet";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";

const createSchema = z.object({
  assignmentId: z.uuid(),
  title: z.string().trim().min(2).max(120),
  mode: z.enum(["online", "offline"]),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  meetingUrl: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await requireUser();
    if (user.roles.includes("coach")) {
      await requireCurrentCoachServiceAccess(user.id);
    }
    await reconcileDueServiceCycles();
    const rows = await getDb()
      .select()
      .from(coachingSessions)
      .where(
        or(
          eq(coachingSessions.clientUserId, user.id),
          eq(coachingSessions.coachUserId, user.id),
        ),
      )
      .orderBy(asc(coachingSessions.startsAt))
      .limit(200);
    return NextResponse.json({ sessions: rows });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireUser();
    await reconcileDueServiceCycles();
    if (!coach.roles.includes("coach")) {
      throw new HttpError(403, "role_required", "Coach access is required.");
    }
    await requireCurrentCoachServiceAccess(coach.id);
    const input = createSchema.parse(await request.json());
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const googleMeet = input.mode === "online"
      ? parseGoogleMeetUrl(input.meetingUrl ?? "")
      : null;
    if (input.mode === "online" && !googleMeet) {
      throw new HttpError(
        400,
        "google_meet_link_required",
        "Paste a valid https://meet.google.com meeting link.",
      );
    }
    const duration = endsAt.getTime() - startsAt.getTime();
    if (
      startsAt <= new Date() ||
      duration < 15 * 60 * 1000 ||
      duration > 4 * 60 * 60 * 1000
    ) {
      throw new HttpError(
        400,
        "invalid_session_time",
        "Choose a future session lasting between 15 minutes and 4 hours.",
      );
    }
    const [assignment] = await getDb()
      .select({
        id: coachAssignments.id,
        clientUserId: coachAssignments.clientUserId,
        purchaseStatus: planPurchases.status,
        purchaseExpiresAt: planPurchases.expiresAt,
        cycleEndsAt: serviceCycles.endsAt,
      })
      .from(coachAssignments)
      .innerJoin(
        planPurchases,
        eq(planPurchases.id, coachAssignments.purchaseId),
      )
      .innerJoin(
        serviceCycles,
        and(
          eq(serviceCycles.assignmentId, coachAssignments.id),
          eq(serviceCycles.coachUserId, coach.id),
          eq(serviceCycles.status, "active"),
        ),
      )
      .where(
        and(
          eq(coachAssignments.id, input.assignmentId),
          eq(coachAssignments.coachUserId, coach.id),
          eq(coachAssignments.status, "assigned"),
        ),
      )
      .limit(1);
    if (!assignment) {
      throw new HttpError(404, "assignment_not_found", "Active assignment not found.");
    }
    if (
      assignment.purchaseStatus !== "active" ||
      !assignment.purchaseExpiresAt ||
      assignment.purchaseExpiresAt <= new Date() ||
      endsAt > assignment.purchaseExpiresAt ||
      endsAt > assignment.cycleEndsAt
    ) {
      throw new HttpError(
        409,
        "plan_inactive",
        "The session must finish within the current 30-day service cycle.",
      );
    }
    const [conflict] = await getDb()
      .select({ id: coachingSessions.id })
      .from(coachingSessions)
      .where(
        and(
          eq(coachingSessions.status, "scheduled"),
          lt(coachingSessions.startsAt, endsAt),
          gt(coachingSessions.endsAt, startsAt),
          or(
            eq(coachingSessions.coachUserId, coach.id),
            eq(coachingSessions.clientUserId, assignment.clientUserId),
          ),
        ),
      )
      .limit(1);
    if (conflict) {
      throw new HttpError(
        409,
        "session_time_conflict",
        "The coach or client already has a session during that time.",
      );
    }
    const [groupConflict] = await getDb()
      .select({ id: coachingGroupSessions.id })
      .from(coachingGroupSessions)
      .leftJoin(
        coachingGroupMembers,
        eq(coachingGroupMembers.groupId, coachingGroupSessions.groupId),
      )
      .leftJoin(
        coachAssignments,
        and(
          eq(coachAssignments.id, coachingGroupMembers.assignmentId),
          eq(coachAssignments.status, "assigned"),
        ),
      )
      .leftJoin(
        planPurchases,
        and(
          eq(planPurchases.id, coachAssignments.purchaseId),
          eq(planPurchases.status, "active"),
          gt(planPurchases.expiresAt, new Date()),
        ),
      )
      .where(
        and(
          eq(coachingGroupSessions.status, "scheduled"),
          lt(coachingGroupSessions.startsAt, endsAt),
          gt(coachingGroupSessions.endsAt, startsAt),
          or(
            eq(coachingGroupSessions.coachUserId, coach.id),
            and(
              eq(coachingGroupMembers.clientUserId, assignment.clientUserId),
              isNotNull(coachAssignments.id),
              isNotNull(planPurchases.id),
            ),
          ),
        ),
      )
      .limit(1);
    if (groupConflict) {
      throw new HttpError(
        409,
        "session_time_conflict",
        "The coach or client already has a group session during that time.",
      );
    }
    if (googleMeet) {
      const [linkConflict] = await getDb()
        .select({ id: coachingSessions.id })
        .from(coachingSessions)
        .where(
          and(
            eq(coachingSessions.meetingProvider, "google_meet"),
            eq(coachingSessions.providerRoomId, googleMeet.code),
          ),
        )
        .limit(1);
      if (linkConflict) {
        throw new HttpError(
          409,
          "google_meet_link_in_use",
          "Create a new Google Meet link for each coaching session.",
        );
      }
      const [groupLinkConflict] = await getDb()
        .select({ id: coachingGroupSessions.id })
        .from(coachingGroupSessions)
        .where(
          and(
            eq(coachingGroupSessions.meetingProvider, "google_meet"),
            eq(coachingGroupSessions.providerRoomId, googleMeet.code),
          ),
        )
        .limit(1);
      if (groupLinkConflict) {
        throw new HttpError(
          409,
          "google_meet_link_in_use",
          "Create a new Google Meet link for each coaching session.",
        );
      }
    }
    const created = await getDb().transaction(async (transaction) => {
      const [session] = await transaction
        .insert(coachingSessions)
        .values({
          assignmentId: assignment.id,
          clientUserId: assignment.clientUserId,
          coachUserId: coach.id,
          title: input.title,
          mode: input.mode,
          startsAt,
          endsAt,
          meetingProvider: googleMeet ? "google_meet" : "unconfigured",
          providerRoomId: googleMeet?.code ?? null,
        })
        .returning();
      await transaction.insert(auditLogs).values({
        actorUserId: coach.id,
        action: "session.created",
        targetType: "coaching_session",
        targetId: session.id,
        requestId,
      });
      await transaction.insert(notifications).values({
        userId: assignment.clientUserId,
        type: "session.scheduled",
        title: "New coaching session",
        body: `${input.title} is scheduled for ${startsAt.toLocaleString("en-IN")}.`,
        actionUrl: "/client/schedule",
        metadata: { sessionId: session.id, coachUserId: coach.id },
      });
      return session;
    });
    return NextResponse.json({ session: created }, { status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
