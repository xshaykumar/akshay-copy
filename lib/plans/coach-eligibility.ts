export type PlanIdentity = {
  code: string;
  name: string;
};

export function isAthleteExecutivePlan(plan: PlanIdentity) {
  const normalizedCode = plan.code.trim().toLowerCase();
  const normalizedName = plan.name.trim().toLowerCase();
  return (
    normalizedCode === "athlete-executive" ||
    normalizedCode.startsWith("athlete-executive-") ||
    normalizedName === "athlete / executive performance" ||
    normalizedName === "athlete/executive performance"
  );
}

export function coachCanServePlan(
  coach: { athleteExecutiveEligible: boolean },
  plan: PlanIdentity,
) {
  return !isAthleteExecutivePlan(plan) || coach.athleteExecutiveEligible;
}
