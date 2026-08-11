export const MEETING_JOIN_EARLY_MS = 10 * 60 * 1000;
export const MEETING_JOIN_GRACE_MS = 15 * 60 * 1000;

export type MeetingAvailability =
  | "upcoming"
  | "ready"
  | "provider_pending"
  | "ended"
  | "unavailable";

export function getMeetingAvailability(
  session: {
    startsAt: Date;
    endsAt: Date;
    status: string;
    meetingProvider: string;
    providerRoomId?: string | null;
  },
  now = new Date(),
): MeetingAvailability {
  if (session.status !== "scheduled") return "unavailable";

  const opensAt = session.startsAt.getTime() - MEETING_JOIN_EARLY_MS;
  const closesAt = session.endsAt.getTime() + MEETING_JOIN_GRACE_MS;
  const current = now.getTime();

  if (current < opensAt) return "upcoming";
  if (current > closesAt) return "ended";
  if (
    session.meetingProvider === "unconfigured" ||
    !session.providerRoomId
  ) {
    return "provider_pending";
  }
  return "ready";
}

export function meetingJoinWindow(session: {
  startsAt: Date;
  endsAt: Date;
}) {
  return {
    opensAt: new Date(session.startsAt.getTime() - MEETING_JOIN_EARLY_MS),
    closesAt: new Date(session.endsAt.getTime() + MEETING_JOIN_GRACE_MS),
  };
}
