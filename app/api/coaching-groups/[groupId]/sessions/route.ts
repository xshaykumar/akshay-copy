import { and, eq, gt, inArray, isNotNull, lt, or } from "drizzle-orm";
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
import { parseGoogleMeetUrl } from "@/lib/meetings/google-meet";

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  meetingUrl: z.string().trim().max(500),
});

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const { groupId: rawGroupId } = await context.params;
    const groupId = z.uuid().parse(rawGroupId);
    const { actor, group, isAdmin } = await requireGroupManager(groupId);
    if (isAdmin) {
      throw new HttpError(403, "coach_action_required", "Only the group's coach can schedule a session.");
    }
    const input = createSchema.parse(await request.json());
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const duration = endsAt.getTime() - startsAt.getTime();
    if (startsAt <= new Date() || duration < 15 * 60_000 || duration > 4 * 60 * 60_000) {
      throw new HttpError(400, "invalid_session_time", "Choose a future session lasting between 15 minutes and 4 hours.");
    }
    const googleMeet = parseGoogleMeetUrl(input.meetingUrl);
    if (!googleMeet) {
      throw new HttpError(400, "google_meet_link_required", "Paste a valid https://meet.google.com meeting link.");
    }
    const eligibleMembers = (await getEligibleGroupMembers(groupId)).filter(
      (member) => member.purchaseExpiresAt && member.purchaseExpiresAt >= endsAt,
    );
    if (eligibleMembers.length === 0) {
      throw new HttpError(409, "group_has_no_eligible_members", "Add at least one active group-plan client whose plan covers this session.");
    }
    const clientIds = eligibleMembers.map((member) => member.clientUserId);
    const [individualConflict] = await getDb().select({ id: coachingSessions.id })
      .from(coachingSessions)
      .where(and(
        eq(coachingSessions.status, "scheduled"),
        lt(coachingSessions.startsAt, endsAt),
        gt(coachingSessions.endsAt, startsAt),
        or(
          eq(coachingSessions.coachUserId, actor.id),
          inArray(coachingSessions.clientUserId, clientIds),
        ),
      )).limit(1);
    const [groupConflict] = await getDb().select({ id: coachingGroupSessions.id })
      .from(coachingGroupSessions)
      .leftJoin(coachingGroupMembers, eq(coachingGroupMembers.groupId, coachingGroupSessions.groupId))
      .leftJoin(coachAssignments, and(eq(coachAssignments.id, coachingGroupMembers.assignmentId), eq(coachAssignments.status, "assigned")))
      .leftJoin(planPurchases, and(eq(planPurchases.id, coachAssignments.purchaseId), eq(planPurchases.status, "active"), gt(planPurchases.expiresAt, new Date())))
      .where(and(
        eq(coachingGroupSessions.status, "scheduled"),
        lt(coachingGroupSessions.startsAt, endsAt),
        gt(coachingGroupSessions.endsAt, startsAt),
        or(
          eq(coachingGroupSessions.coachUserId, actor.id),
          and(inArray(coachingGroupMembers.clientUserId, clientIds), isNotNull(coachAssignments.id), isNotNull(planPurchases.id)),
        ),
      )).limit(1);
    if (individualConflict || groupConflict) {
      throw new HttpError(409, "session_time_conflict", "The coach or a group member already has a session during that time.");
    }
    const [individualLinkConflict] = await getDb().select({ id: coachingSessions.id })
      .from(coachingSessions)
      .where(and(eq(coachingSessions.meetingProvider, "google_meet"), eq(coachingSessions.providerRoomId, googleMeet.code))).limit(1);
    const [groupLinkConflict] = await getDb().select({ id: coachingGroupSessions.id })
      .from(coachingGroupSessions)
      .where(and(eq(coachingGroupSessions.meetingProvider, "google_meet"), eq(coachingGroupSessions.providerRoomId, googleMeet.code))).limit(1);
    if (individualLinkConflict || groupLinkConflict) {
      throw new HttpError(409, "google_meet_link_in_use", "Create a new Google Meet link for each coaching session.");
    }

    const created = await getDb().transaction(async (transaction) => {
      const [session] = await transaction.insert(coachingGroupSessions).values({
        groupId,
        coachUserId: actor.id,
        title: input.title,
        startsAt,
        endsAt,
        meetingProvider: "google_meet",
        providerRoomId: googleMeet.code,
      }).returning();
      await transaction.insert(auditLogs).values({
        actorUserId: actor.id,
        action: "coaching_group_session.created",
        targetType: "coaching_group_session",
        targetId: session.id,
        requestId,
        safeMetadata: { groupId, memberCount: eligibleMembers.length },
      });
      await transaction.insert(notifications).values(eligibleMembers.map((member) => ({
        userId: member.clientUserId,
        type: "coaching_group_session.scheduled",
        title: `${group.name}: new group session`,
        body: `${input.title} is scheduled for ${startsAt.toLocaleString("en-IN")} to ${endsAt.toLocaleTimeString("en-IN")}. Join: ${googleMeet.url}`,
        actionUrl: "/client/schedule",
        metadata: { groupId, groupSessionId: session.id },
      })));
      return session;
    });
    return NextResponse.json({ session: created }, { status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
