import { describe, expect, it } from "vitest";
import {
  getMeetingAvailability,
  meetingJoinWindow,
} from "../lib/meetings/availability";

const baseSession = {
  startsAt: new Date("2026-08-01T10:00:00.000Z"),
  endsAt: new Date("2026-08-01T11:00:00.000Z"),
  status: "scheduled",
  meetingProvider: "provider-x",
  providerRoomId: "room-1",
};

describe("meeting availability", () => {
  it("opens ten minutes before and closes fifteen minutes after", () => {
    const window = meetingJoinWindow(baseSession);
    expect(window.opensAt.toISOString()).toBe("2026-08-01T09:50:00.000Z");
    expect(window.closesAt.toISOString()).toBe("2026-08-01T11:15:00.000Z");
  });

  it("keeps future meetings unavailable until the join window", () => {
    expect(
      getMeetingAvailability(
        baseSession,
        new Date("2026-08-01T09:49:59.000Z"),
      ),
    ).toBe("upcoming");
  });

  it("reports provider setup separately from scheduling", () => {
    expect(
      getMeetingAvailability(
        {
          ...baseSession,
          meetingProvider: "unconfigured",
          providerRoomId: null,
        },
        new Date("2026-08-01T10:10:00.000Z"),
      ),
    ).toBe("provider_pending");
  });

  it("allows access only when the provider room and time window are ready", () => {
    expect(
      getMeetingAvailability(
        baseSession,
        new Date("2026-08-01T10:10:00.000Z"),
      ),
    ).toBe("ready");
  });

  it("closes completed and elapsed meetings", () => {
    expect(
      getMeetingAvailability(
        baseSession,
        new Date("2026-08-01T11:15:01.000Z"),
      ),
    ).toBe("ended");
    expect(
      getMeetingAvailability(
        { ...baseSession, status: "completed" },
        new Date("2026-08-01T10:10:00.000Z"),
      ),
    ).toBe("unavailable");
  });
});
