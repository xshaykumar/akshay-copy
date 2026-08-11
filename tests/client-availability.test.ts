import { describe, expect, it } from "vitest";
import {
  availabilityRangeContainsTime,
  clientCoachSelectionAvailabilitySchema,
  coachMatchesClientAvailability,
  formatClientPreferredSlot,
  formatClientPreferredTime,
} from "../lib/assignments/client-availability";

describe("client coach-selection availability", () => {
  it("requires one or more days and exactly one supported slot start", () => {
    expect(clientCoachSelectionAvailabilitySchema.safeParse({
      selectedDays: ["monday", "wednesday"],
      selectedTime: "06:00",
    }).success).toBe(true);
    expect(clientCoachSelectionAvailabilitySchema.safeParse({
      selectedDays: [],
      selectedTime: "06:00",
    }).success).toBe(false);
    expect(clientCoachSelectionAvailabilitySchema.safeParse({
      selectedDays: ["monday"],
      selectedTime: "06:30",
    }).success).toBe(false);
  });

  it("matches a coach only when a selected day and the one-hour slot overlap", () => {
    const coach = {
      availableDays: ["monday", "friday"],
      availableTimeSlots: ["06:00-07:00", "18:00-19:00"],
    };
    expect(coachMatchesClientAvailability(coach, ["monday"], "06:00")).toBe(true);
    expect(coachMatchesClientAvailability(coach, ["tuesday"], "06:00")).toBe(false);
    expect(coachMatchesClientAvailability(coach, ["monday"], "07:00")).toBe(false);
  });

  it("treats the range end as exclusive and formats the saved start", () => {
    expect(availabilityRangeContainsTime("06:00-07:00", "06:00")).toBe(true);
    expect(availabilityRangeContainsTime("06:00-07:00", "07:00")).toBe(false);
    expect(formatClientPreferredTime("18:00")).toBe("6:00 PM");
    expect(formatClientPreferredSlot("18:00")).toBe("6 PM–7 PM");
  });
});
