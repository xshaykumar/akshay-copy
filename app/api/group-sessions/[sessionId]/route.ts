import { and, eq, gt, inArray, isNotNull, lt, ne, or } from "drizzle-orm";
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
} from "@/db/schema";
import { getEligibleGroupMembers, requireGroupManager } from "@/lib/group-coaching";
import { assertSameOrigin, HttpError, jsonError, requestIdFrom } from "@/lib/http/errors";
import { googleMeetUrlFromCode, parseGoogleMeetUrl } from "@/lib/meetings/google-meet";

const updateSchema = z.object({
  action: z.enum(["reschedule", "meeting_link", "status"]),
  status: z.enum(["completed", "missed"]).optional(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  meetingUrl: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const { sessionId } = await context.params;
    const id = z.uuid().parse(sessionId);
    const input = updateSchema.parse(await request.json());
    const [session] = await getDb().select().from(coachingGroupSessions)
      .where(eq(coachingGroupSessions.id, id)).limit(1);
    if (!session) throw new HttpError(404, "session_not_found", "Group session not found.");
    const { actor, group, isAdmin } = await requireGroupManager(session.groupId);
    if (isAdmin || actor.id !== session.coachUserId) {
      throw new HttpError(403, "coach_action_required", "Only the group's coach can update this session.");
    }
    if (session.status !== "scheduled") {
      throw new HttpError(409, "session_unavailable", "This session cannot be updated.");
    }

    let changes: Partial<typeof coachingGroupSessions.$inferInsert> = {};
    let action = "";
    let body = "";
    let eligibilityEnd = session.endsAt;
    if (input.action === "reschedule") {
      if (!input.startsAt || !input.endsAt) {
        throw new HttpError(400, "session_time_required", "Choose the new session time and duration.");
      }
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      const duration = endsAt.getTime() - startsAt.getTime();
      if (startsAt <= new Date() || duration < 15 * 60_000 || duration > 4 * 60 * 60_000) {
        throw new HttpError(400, "invalid_session_time", "Choose a future session lasting between 15 minutes and 4 hours.");
      }
      const members = (await getEligibleGroupMembers(session.groupId)).filter((member) => member.purchaseExpiresAt && member.purchaseExpiresAt >= endsAt);
      if (members.length === 0) throw new HttpError(409, "group_has_no_eligible_members", "No active member's plan covers the new time.");
      const clientIds = members.map((member) => member.clientUserId);
      const [individualConflict] = await getDb().select({ id: coachingSessions.id }).from(coachingSessions)
        .where(and(eq(coachingSessions.status, "scheduled"), lt(coachingSessions.startsAt, endsAt), gt(coachingSessions.endsAt, startsAt), or(eq(coachingSessions.coachUserId, actor.id), inArray(coachingSessions.clientUserId, clientIds)))).limit(1);
      const [groupConflict] = await getDb().select({ id: coachingGroupSessions.id }).from(coachingGroupSessions)
        .leftJoin(coachingGroupMembers, eq(coachingGroupMembers.groupId, coachingGroupSessions.groupId))
        .leftJoin(coachAssignments, and(eq(coachAssignments.id, coachingGroupMembers.assignmentId), eq(coachAssignments.status, "assigned")))
        .leftJoin(planPurchases, and(eq(planPurchases.id, coachAssignments.purchaseId), eq(planPurchases.status, "active"), gt(planPurchases.expiresAt, new Date())))
        .where(and(ne(coachingGroupSessions.id, id), eq(coachingGroupSessions.status, "scheduled"), lt(coachingGroupSessions.startsAt, endsAt), gt(coachingGroupSessions.endsAt, startsAt), or(eq(coachingGroupSessions.coachUserId, actor.id), and(inArray(coachingGroupMembers.clientUserId, clientIds), isNotNull(coachAssignments.id), isNotNull(planPurchases.id))))).limit(1);
      if (individualConflict || groupConflict) throw new HttpError(409, "session_time_conflict", "The coach or a group member already has a session during that time.");
      changes = { startsAt, endsAt, rescheduledAt: new Date(), updatedAt: new Date() };
      eligibilityEnd = endsAt;
      action = "rescheduled";
      body = `${session.title} now runs from ${startsAt.toLocaleString("en-IN")} to ${endsAt.toLocaleTimeString("en-IN")}. Join: ${googleMeetUrlFromCode(session.providerRoomId)}`;
    } else if (input.action === "meeting_link") {
      const meet = parseGoogleMeetUrl(input.meetingUrl ?? "");
      if (!meet) throw new HttpError(400, "invalid_google_meet_link", "Paste a valid https://meet.google.com meeting link.");
      const [individualConflict] = await getDb().select({ id: coachingSessions.id }).from(coachingSessions)
        .where(and(eq(coachingSessions.meetingProvider, "google_meet"), eq(coachingSessions.providerRoomId, meet.code))).limit(1);
      const [groupConflict] = await getDb().select({ id: coachingGroupSessions.id }).from(coachingGroupSessions)
        .where(and(ne(coachingGroupSessions.id, id), eq(coachingGroupSessions.meetingProvider, "google_meet"), eq(coachingGroupSessions.providerRoomId, meet.code))).limit(1);
      if (individualConflict || groupConflict) throw new HttpError(409, "google_meet_link_in_use", "Create a new Google Meet link for each coaching session.");
      changes = { providerRoomId: meet.code, updatedAt: new Date() };
      action = "meeting_link_updated";
      body = `${session.title} is scheduled for ${session.startsAt.toLocaleString("en-IN")} to ${session.endsAt.toLocaleTimeString("en-IN")}. Updated link: ${meet.url}`;
    } else {
      if (!input.status) throw new HttpError(400, "session_status_required", "Choose a session status.");
      if (session.startsAt > new Date()) throw new HttpError(409, "session_not_started", "A future session cannot be marked complete or missed.");
      changes = { status: input.status, updatedAt: new Date() };
      action = input.status;
      body = `${session.title} was marked ${input.status}.`;
    }

    const members = (await getEligibleGroupMembers(session.groupId)).filter((member) => member.purchaseExpiresAt && member.purchaseExpiresAt >= eligibilityEnd);
    const updated = await getDb().transaction(async (transaction) => {
      const [row] = await transaction.update(coachingGroupSessions).set(changes)
        .where(and(eq(coachingGroupSessions.id, id), eq(coachingGroupSessions.status, "scheduled"), eq(coachingGroupSessions.coachUserId, actor.id))).returning();
      if (!row) throw new HttpError(409, "session_unavailable", "This session cannot be updated.");
      await transaction.insert(auditLogs).values({ actorUserId: actor.id, action: `coaching_group_session.${action}`, targetType: "coaching_group_session", targetId: id, requestId, safeMetadata: { groupId: group.id } });
      if (members.length) await transaction.insert(notifications).values(members.map((member) => ({
        userId: member.clientUserId,
        type: `coaching_group_session.${action}`,
        title: `${group.name}: session updated`,
        body,
        actionUrl: "/client/schedule",
        metadata: { groupId: group.id, groupSessionId: id },
      })));
      return row;
    });
    return NextResponse.json({ session: updated });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
