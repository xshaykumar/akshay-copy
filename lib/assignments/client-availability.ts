import { z } from "zod";
import {
  coachAvailabilityDays,
  coachAvailabilityTimeSlotLabels,
  coachAvailabilityTimeSlots,
} from "../coaches/activation";

const clientSelectableTimes = coachAvailabilityTimeSlots.map(
  (slot) => slot.split("-")[0],
);

export const clientPreferredTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Select one valid time slot.")
  .refine(
    (time) => clientSelectableTimes.includes(time),
    "Select one of the available one-hour time slots.",
  );

export const clientCoachSelectionAvailabilitySchema = z.object({
  selectedDays: z
    .array(z.enum(coachAvailabilityDays))
    .min(1, "Select at least one available day.")
    .max(7)
    .transform((days) => [...new Set(days)]),
  selectedTime: clientPreferredTimeSchema,
});

function timeToMinutes(time: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function availabilityRangeContainsTime(range: string, time: string) {
  const [startValue, endValue, extra] = range.split("-");
  if (extra !== undefined) return false;
  const start = timeToMinutes(startValue);
  const end = timeToMinutes(endValue);
  const requested = timeToMinutes(time);
  if (start === null || end === null || requested === null || start === end) {
    return false;
  }
  return start < end
    ? requested >= start && requested < end
    : requested >= start || requested < end;
}

export function coachMatchesClientAvailability(
  coach: {
    availableDays: readonly string[];
    availableTimeSlots: readonly string[];
  },
  selectedDays: readonly string[],
  selectedTime: string,
) {
  return (
    selectedDays.some((day) => coach.availableDays.includes(day)) &&
    coach.availableTimeSlots.some((range) =>
      availabilityRangeContainsTime(range, selectedTime),
    )
  );
}

export function formatClientPreferredTime(value: string | null | undefined) {
  const minutes = value ? timeToMinutes(value) : null;
  if (minutes === null) return "Time not selected";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatClientPreferredSlot(value: string | null | undefined) {
  const slot = coachAvailabilityTimeSlots.find(
    (candidate) => candidate.startsWith(`${value ?? ""}-`),
  );
  return slot ? coachAvailabilityTimeSlotLabels[slot] : "Slot not selected";
}
