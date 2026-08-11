import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  coachAssignments,
  coachingSessions,
  planPurchases,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { requireCurrentCoachServiceAccess } from "@/lib/coaches/service-access";
import {
  getMeetingAvailability,
  meetingJoinWindow,
} from "@/lib/meetings/availability";
import { googleMeetUrlFromCode } from "@/lib/meetings/google-meet";
import {
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    const user = await requireUser();
    await reconcileDueServiceCycles();
    const { sessionId } = await context.params;
    const id = z.uuid().parse(sessionId);
    const [session] = await getDb()
      .select()
      .from(coachingSessions)
      .where(
        and(
          eq(coachingSessions.id, id),
          or(
            eq(coachingSessions.clientUserId, user.id),
            eq(coachingSessions.coachUserId, user.id),
          ),
        ),
      )
      .limit(1);
    if (!session) {
      throw new HttpError(404, "session_not_found", "Session not found.");
    }
    if (session.coachUserId === user.id) {
      await requireCurrentCoachServiceAccess(user.id);
    }
    const [assignment] = await getDb()
      .select({
        status: coachAssignments.status,
        purchaseStatus: planPurchases.status,
        purchaseExpiresAt: planPurchases.expiresAt,
      })
      .from(coachAssignments)
      .innerJoin(
        planPurchases,
        eq(planPurchases.id, coachAssignments.purchaseId),
      )
      .where(eq(coachAssignments.id, session.assignmentId))
      .limit(1);
    if (
      !assignment ||
      assignment.status !== "assigned" ||
      assignment.purchaseStatus !== "active" ||
      !assignment.purchaseExpiresAt ||
      assignment.purchaseExpiresAt <= new Date()
    ) {
      throw new HttpError(
        409,
        "assignment_inactive",
        "The coaching assignment is not active.",
      );
    }
    if (session.mode !== "online") {
      throw new HttpError(409, "offline_session", "This is an in-person session.");
    }

    const availability = getMeetingAvailability(session);
    const window = meetingJoinWindow(session);
    if (availability === "upcoming") {
      throw new HttpError(
        409,
        "meeting_not_open",
        `The call opens at ${window.opensAt.toLocaleString("en-IN")}.`,
      );
    }
    if (availability === "ended" || availability === "unavailable") {
      throw new HttpError(409, "meeting_unavailable", "The call is no longer available.");
    }
    if (availability === "provider_pending") {
      throw new HttpError(
        503,
        "meeting_provider_pending",
        "The video provider has not been connected yet.",
      );
    }

    if (session.meetingProvider !== "google_meet" || !session.providerRoomId) {
      throw new HttpError(
        409,
        "meeting_provider_invalid",
        "This session does not have a valid Google Meet link.",
      );
    }
    const joinUrl = googleMeetUrlFromCode(session.providerRoomId);
    if (!joinUrl) {
      throw new HttpError(
        409,
        "meeting_link_invalid",
        "This session does not have a valid Google Meet link.",
      );
    }
    return NextResponse.json({ joinUrl });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
