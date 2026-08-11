import { describe, expect, it } from "vitest";
import {
  athleteExecutiveQualificationTypes,
  certificationStatusLabel,
  coachQualificationDisplayName,
  coachQualificationSchema,
  coachQualificationTypes,
} from "../lib/coaches/certifications";
import {
  addActivationPeriod,
  coachActivationOptions,
  coachAvailabilitySchema,
  hasCoachAvailability,
  isCoachProfileActive,
} from "../lib/coaches/activation";

describe("coach certification options", () => {
  it("accepts every supported qualification", () => {
    for (const qualification of coachQualificationTypes) {
      expect(coachQualificationSchema.safeParse(qualification).success).toBe(true);
    }
  });

  it("rejects qualifications outside the approved list", () => {
    expect(coachQualificationSchema.safeParse("unverified_online_course").success).toBe(false);
  });

  it("supports a named Other qualification without treating it as listed eligibility", () => {
    expect(coachQualificationSchema.safeParse("other").success).toBe(true);
    expect(
      coachQualificationDisplayName(
        "other",
        "NASM Performance Enhancement",
      ),
    ).toBe("NASM Performance Enhancement");
    expect(athleteExecutiveQualificationTypes).not.toContain("other");
    expect(athleteExecutiveQualificationTypes).toContain("cscs");
  });

  it("labels certification decisions separately from profile activation", () => {
    expect(certificationStatusLabel("approved")).toBe("Accepted");
    expect(certificationStatusLabel("draft")).toBe("Pending submission");
    expect(certificationStatusLabel("submitted")).toBe("Under review");
    expect(certificationStatusLabel("rejected")).toBe("Rejected");
  });
});

describe("coach activation", () => {
  it("requires certification approval or an admin waiver plus a non-expired period", () => {
    const now = new Date("2026-07-29T12:00:00.000Z");
    expect(
      isCoachProfileActive(
        {
          approvedAt: new Date("2026-07-20T00:00:00.000Z"),
          activationExpiresAt: new Date("2026-08-20T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);
    expect(
      isCoachProfileActive(
        {
          approvedAt: null,
          certificationWaivedAt: new Date("2026-07-25T00:00:00.000Z"),
          activationExpiresAt: new Date("2026-08-20T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);
    expect(
      isCoachProfileActive(
        {
          approvedAt: null,
          certificationWaivedAt: null,
          activationExpiresAt: new Date("2026-08-20T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
    expect(
      isCoachProfileActive(
        {
          approvedAt: new Date("2026-07-20T00:00:00.000Z"),
          activationExpiresAt: new Date("2026-07-29T11:59:59.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("adds exactly 30 elapsed days and validates testing availability options", () => {
    expect(
      addActivationPeriod(new Date("2026-07-29T12:00:00.000Z")).toISOString(),
    ).toBe("2026-08-28T12:00:00.000Z");
    expect(
      coachAvailabilitySchema.safeParse({
        availableDays: ["monday", "saturday"],
        availableTimeSlots: ["09:00-10:00", "17:00-18:00"],
        locationState: "Delhi",
        locationCity: "New Delhi",
        locationDistrict: "South Delhi",
      }).success,
    ).toBe(true);
    expect(
      coachAvailabilitySchema.safeParse({
        availableDays: ["holiday"],
        availableTimeSlots: ["midnight"],
        locationState: "",
        locationCity: "",
        locationDistrict: "",
      }).success,
    ).toBe(false);
  });

  it("offers the accepted coach activation durations and prices", () => {
    expect(coachActivationOptions).toEqual([
      { durationDays: 30, amountPaise: 15_900 },
      { durationDays: 90, amountPaise: 45_900 },
      { durationDays: 365, amountPaise: 149_000 },
    ]);
    const startsAt = new Date("2026-08-05T12:00:00.000Z");
    expect(addActivationPeriod(startsAt, 90).toISOString()).toBe(
      "2026-11-03T12:00:00.000Z",
    );
    expect(addActivationPeriod(startsAt, 365).toISOString()).toBe(
      "2027-08-05T12:00:00.000Z",
    );
  });

  it("requires both a saved day and time slot for admin activation", () => {
    expect(
      hasCoachAvailability({
        availableDays: ["monday"],
        availableTimeSlots: ["09:00-10:00"],
      }),
    ).toBe(true);
    expect(
      hasCoachAvailability({
        availableDays: ["monday"],
        availableTimeSlots: [],
      }),
    ).toBe(false);
    expect(
      hasCoachAvailability({
        availableDays: [],
        availableTimeSlots: ["09:00-10:00"],
      }),
    ).toBe(false);
  });
});
