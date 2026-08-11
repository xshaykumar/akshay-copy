export const DAY_MS = 24 * 60 * 60 * 1000;
export const SERVICE_CYCLE_DAYS = 30;
export const SERVICE_CYCLE_MS = SERVICE_CYCLE_DAYS * DAY_MS;
export const PLAN_DURATION_DAYS = [90, 180, 365] as const;

export type PlanDurationDays = (typeof PLAN_DURATION_DAYS)[number];

export function addElapsedDays(from: Date, days: number) {
  return new Date(from.getTime() + days * DAY_MS);
}

export function serviceCycleCount(durationDays: number) {
  if (
    !Number.isInteger(durationDays) ||
    !PLAN_DURATION_DAYS.includes(durationDays as PlanDurationDays)
  ) {
    throw new Error("Plan duration must be 90, 180, or 365 days.");
  }
  return durationDays === 90 ? 3 : durationDays === 180 ? 6 : 12;
}

export function formatPlanDuration(durationDays: number) {
  const months = serviceCycleCount(durationDays);
  return `${months} months (${durationDays} days)`;
}
