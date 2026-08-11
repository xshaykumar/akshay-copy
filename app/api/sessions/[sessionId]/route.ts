import { and, eq, gt, isNotNull, lt, ne, or } from "drizzle-orm";
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

const updateSchema = z.object({
  action: z.enum(["reschedule", "meeting_link", "status"]).optional(),
  status: z.enum(["completed", "missed"]).optional(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  meetingUrl: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await reconcileDueServiceCycles();
    const { sessionId } = await context.params;
    const id = z.uuid().parse(sessionId);
    const input = updateSchema.parse(await request.json());
    const action = input.action ?? "status";
    const [session] = await getDb()
      .select()
      .from(coachingSessions)
      .where(eq(coachingSessions.id, id))
      .limit(1);
    if (
      !session ||
      (session.clientUserId !== user.id && session.coachUserId !== user.id)
    ) {
      throw new HttpError(404, "session_not_found", "Session not found.");
    }
    if (session.coachUserId === user.id) {
      await requireCurrentCoachServiceAccess(user.id);
    }
    if (session.status !== "scheduled") {
      throw new HttpError(409, "session_unavailable", "Session cannot be updated.");
    }
    const [assignment] = await getDb()
      .select({
        status: coachAssignments.status,
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
          eq(serviceCycles.coachUserId, session.coachUserId),
          eq(serviceCycles.status, "active"),
        ),
      )
      .where(eq(coachAssignments.id, session.assignmentId))
      .limit(1);
    if (!assignment || assignment.status !== "assigned") {
      throw new HttpError(
        409,
        "assignment_inactive",
        "The coaching assignment is not active.",
      );
    }

    if (action === "meeting_link") {
      if (!user.roles.includes("coach") || session.coachUserId !== user.id) {
        throw new HttpError(
          403,
          "coach_action_required",
          "Only the assigned coach can change the Google Meet link.",
        );
      }
      if (session.mode !== "online") {
        throw new HttpError(
          409,
          "offline_session",
          "An in-person session does not use a Google Meet link.",
        );
      }
      const googleMeet = parseGoogleMeetUrl(input.meetingUrl ?? "");
      if (!googleMeet) {
        throw new HttpError(
          400,
          "invalid_google_meet_link",
          "Paste a valid https://meet.google.com meeting link.",
        );
      }
      const [linkConflict] = await getDb()
        .select({ id: coachingSessions.id })
        .from(coachingSessions)
        .where(
          and(
            ne(coachingSessions.id, id),
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
        throw new HttpError(409, "google_meet_link_in_use", "Create a new Google Meet link for each coaching session.");
      }
      const [updated] = await getDb()
        .update(coachingSessions)
        .set({
          meetingProvider: "google_meet",
          providerRoomId: googleMeet.code,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(coachingSessions.id, id),
            eq(coachingSessions.status, "scheduled"),
            eq(coachingSessions.coachUserId, user.id),
          ),
        )
        .returning();
      if (!updated) {
        throw new HttpError(409, "session_unavailable", "Session cannot be updated.");
      }
      await getDb().insert(auditLogs).values({
        actorUserId: user.id,
        action: "session.meeting_link_updated",
        targetType: "coaching_session",
        targetId: id,
        requestId,
      });
      await getDb().insert(notifications).values({
        userId: session.clientUserId,
        type: "session.meeting_link_updated",
        title: "Google Meet link updated",
        body: `The meeting link for ${session.title} is ready.`,
        actionUrl: "/client/schedule",
        metadata: { sessionId: id },
      });
      return NextResponse.json({ session: updated });
    }

    if (action === "reschedule") {
      if (!user.roles.includes("coach") || session.coachUserId !== user.id) {
        throw new HttpError(
          403,
          "coach_action_required",
          "Only the assigned coach can reschedule this session.",
        );
      }
      if (!input.startsAt || !input.endsAt) {
        throw new HttpError(
          400,
          "session_time_required",
          "Choose the new session time and duration.",
        );
      }
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
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
            ne(coachingSessions.id, id),
            eq(coachingSessions.status, "scheduled"),
            lt(coachingSessions.startsAt, endsAt),
            gt(coachingSessions.endsAt, startsAt),
            or(
              eq(coachingSessions.coachUserId, session.coachUserId),
              eq(coachingSessions.clientUserId, session.clientUserId),
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
              eq(coachingGroupSessions.coachUserId, session.coachUserId),
              and(
                eq(coachingGroupMembers.clientUserId, session.clientUserId),
                isNotNull(coachAssignments.id),
                isNotNull(planPurchases.id),
              ),
            ),
          ),
        )
        .limit(1);
      if (groupConflict) {
        throw new HttpError(409, "session_time_conflict", "The coach or client already has a group session during that time.");
      }
      const [updated] = await getDb()
        .update(coachingSessions)
        .set({
          startsAt,
          endsAt,
          rescheduledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(coachingSessions.id, id),
            eq(coachingSessions.status, "scheduled"),
            eq(coachingSessions.coachUserId, user.id),
          ),
        )
        .returning();
      if (!updated) {
        throw new HttpError(409, "session_unavailable", "Session cannot be updated.");
      }
      await getDb().insert(auditLogs).values({
        actorUserId: user.id,
        action: "session.rescheduled",
        targetType: "coaching_session",
        targetId: id,
        requestId,
      });
      await getDb().insert(notifications).values({
        userId: session.clientUserId,
        type: "session.rescheduled",
        title: "Session rescheduled",
        body: `${session.title} now starts at ${startsAt.toLocaleString("en-IN")}.`,
        actionUrl: "/client/schedule",
        metadata: { sessionId: id },
      });
      return NextResponse.json({ session: updated });
    }

    if (!input.status) {
      throw new HttpError(400, "session_status_required", "Choose a session status.");
    }
    if (session.startsAt > new Date()) {
      throw new HttpError(
        409,
        "session_not_started",
        "A future session cannot be marked complete or missed.",
      );
    }
    if (!user.roles.includes("coach") || session.coachUserId !== user.id) {
      throw new HttpError(
        403,
        "coach_action_required",
        "Only the assigned coach can set that status.",
      );
    }
    const [updated] = await getDb()
      .update(coachingSessions)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(coachingSessions.id, id),
          eq(coachingSessions.status, "scheduled"),
          eq(coachingSessions.coachUserId, user.id),
        ),
      )
      .returning();
    if (!updated) {
      throw new HttpError(409, "session_unavailable", "Session cannot be updated.");
    }
    await getDb().insert(auditLogs).values({
      actorUserId: user.id,
      action: `session.${input.status}`,
      targetType: "coaching_session",
      targetId: id,
      requestId,
    });
    await getDb().insert(notifications).values({
      userId: session.clientUserId,
      type: `session.${input.status}`,
      title:
        input.status === "completed"
          ? "Session completed"
          : "Session marked missed",
      body: `${session.title} was marked ${input.status}.`,
      actionUrl: "/client/schedule",
      metadata: { sessionId: id },
    });
    return NextResponse.json({ session: updated });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
