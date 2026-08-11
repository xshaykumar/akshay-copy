import { and, gt, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import { coachProfiles } from "../../db/schema";
import { addElapsedDays, SERVICE_CYCLE_DAYS } from "../plans/duration";

export const COACH_ACTIVATION_FEE_PAISE = 15_900;
export const COACH_ACTIVATION_CURRENCY = "INR";

export const coachActivationOptions = [
  { durationDays: 30, amountPaise: 15_900 },
  { durationDays: 90, amountPaise: 45_900 },
  { durationDays: 365, amountPaise: 149_000 },
] as const;

export const coachActivationDurationSchema = z.union([
  z.literal(30),
  z.literal(90),
  z.literal(365),
]);

export type CoachActivationDuration = z.infer<
  typeof coachActivationDurationSchema
>;

export function coachActivationOptionFor(durationDays: number) {
  return coachActivationOptions.find(
    (option) => option.durationDays === durationDays,
  );
}

export const coachAvailabilityDays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type CoachAvailabilityDay = (typeof coachAvailabilityDays)[number];

export const coachAvailabilityDayLabels: Record<CoachAvailabilityDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const coachAvailabilityTimeSlots = [
  "06:00-07:00",
  "07:00-08:00",
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
  "18:00-19:00",
  "19:00-20:00",
] as const;

export type CoachAvailabilityTimeSlot =
  (typeof coachAvailabilityTimeSlots)[number];

export const coachAvailabilityTimeSlotLabels: Record<
  CoachAvailabilityTimeSlot,
  string
> = Object.fromEntries(
  coachAvailabilityTimeSlots.map((slot) => {
    const [start, end] = slot.split("-");
    const format = (value: string) => {
      const hour = Number(value.slice(0, 2));
      return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
    };
    return [slot, `${format(start)}–${format(end)}`];
  }),
) as Record<CoachAvailabilityTimeSlot, string>;

export const coachAvailabilitySchema = z.object({
  availableDays: z.array(z.enum(coachAvailabilityDays)).min(1).max(7),
  availableTimeSlots: z
    .array(z.enum(coachAvailabilityTimeSlots))
    .min(1)
    .max(coachAvailabilityTimeSlots.length),
  locationState: z.string().trim().min(2).max(100),
  locationCity: z.string().trim().min(2).max(100),
  locationDistrict: z.string().trim().min(2).max(100),
});

export function addActivationPeriod(
  from: Date,
  durationDays: CoachActivationDuration = SERVICE_CYCLE_DAYS,
) {
  return addElapsedDays(from, durationDays);
}

export function hasCoachAvailability(profile: {
  availableDays?: readonly string[] | null;
  availableTimeSlots?: readonly string[] | null;
}) {
  return Boolean(
    profile.availableDays?.length && profile.availableTimeSlots?.length,
  );
}

export function isCoachProfileActive(
  profile: {
    approvedAt?: Date | string | null;
    certificationWaivedAt?: Date | string | null;
    activationExpiresAt?: Date | string | null;
  },
  now = new Date(),
) {
  if (
    (!profile.approvedAt && !profile.certificationWaivedAt) ||
    !profile.activationExpiresAt
  ) return false;
  return new Date(profile.activationExpiresAt).getTime() > now.getTime();
}

export function activeCoachConditions(now = new Date()) {
  return and(
    or(
      isNotNull(coachProfiles.approvedAt),
      isNotNull(coachProfiles.certificationWaivedAt),
    ),
    gt(coachProfiles.activationExpiresAt, now),
  );
}
