import { and, eq, gt, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  coachAssignments,
  coachingGroupMembers,
  coachingGroups,
  coachingGroupSessions,
  planPurchases,
  plans,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { requireCurrentCoachServiceAccess } from "@/lib/coaches/service-access";
import { HttpError, jsonError, requestIdFrom } from "@/lib/http/errors";
import { getMeetingAvailability, meetingJoinWindow } from "@/lib/meetings/availability";
import { googleMeetUrlFromCode } from "@/lib/meetings/google-meet";

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const id = z.uuid().parse(sessionId);
    const [session] = await getDb().select().from(coachingGroupSessions)
      .where(eq(coachingGroupSessions.id, id)).limit(1);
    if (!session) throw new HttpError(404, "session_not_found", "Group session not found.");
    const [group] = await getDb().select().from(coachingGroups)
      .where(eq(coachingGroups.id, session.groupId)).limit(1);
    const isCoach = group?.coachUserId === user.id && user.roles.includes("coach");
    if (isCoach) {
      await requireCurrentCoachServiceAccess(user.id);
    }
    let isEligibleClient = false;
    if (user.roles.includes("client")) {
      const [membership] = await getDb().select({ assignmentId: coachingGroupMembers.assignmentId })
        .from(coachingGroupMembers)
        .innerJoin(coachAssignments, and(
          eq(coachAssignments.id, coachingGroupMembers.assignmentId),
          eq(coachAssignments.status, "assigned"),
          eq(coachAssignments.coachUserId, session.coachUserId),
        ))
        .innerJoin(planPurchases, and(
          eq(planPurchases.id, coachAssignments.purchaseId),
          eq(planPurchases.status, "active"),
          gt(planPurchases.expiresAt, new Date()),
        ))
        .innerJoin(plans, and(eq(plans.id, planPurchases.planId), like(plans.code, "group-online-coaching-%")))
        .where(and(
          eq(coachingGroupMembers.groupId, session.groupId),
          eq(coachingGroupMembers.clientUserId, user.id),
        )).limit(1);
      isEligibleClient = Boolean(membership);
    }
    if (!isCoach && !isEligibleClient) {
      throw new HttpError(404, "session_not_found", "Group session not found.");
    }
    const availability = getMeetingAvailability(session);
    const window = meetingJoinWindow(session);
    if (availability === "upcoming") {
      throw new HttpError(409, "meeting_not_open", `The call opens at ${window.opensAt.toLocaleString("en-IN")}.`);
    }
    if (availability !== "ready") {
      throw new HttpError(409, "meeting_unavailable", "The call is not available.");
    }
    const joinUrl = googleMeetUrlFromCode(session.providerRoomId);
    if (!joinUrl) throw new HttpError(409, "meeting_link_invalid", "This session does not have a valid Google Meet link.");
    return NextResponse.json({ joinUrl });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
