import { addElapsedDays } from "./duration";

export function calculateOnlineBasicUpgrade(input: {
  now: Date;
  cycleStartsAt: Date;
  cycleEndsAt: Date;
  nextCycleStartsAt: Date | null;
  currentCycleNumber: number;
  totalCycles: number;
  fromPlanPricePaise: number;
  toPlanPricePaise: number;
}) {
  if (
    input.currentCycleNumber >= input.totalCycles ||
    input.now < input.cycleStartsAt ||
    input.now >= input.cycleEndsAt
  ) {
    throw new Error(
      "Online Basic cannot be upgraded during the final service cycle.",
    );
  }
  const dayTwoStartsAt = addElapsedDays(input.cycleStartsAt, 1);
  const requestedOnCycleDayOne = input.now < dayTwoStartsAt;
  const effectiveAt = requestedOnCycleDayOne
    ? dayTwoStartsAt
    : input.nextCycleStartsAt;
  if (!effectiveAt) {
    throw new Error("The next service cycle is unavailable for this upgrade.");
  }
  const applicableCycles = requestedOnCycleDayOne
    ? input.totalCycles - input.currentCycleNumber + 1
    : input.totalCycles - input.currentCycleNumber;
  const fullPlanDifference =
    input.toPlanPricePaise - input.fromPlanPricePaise;
  const amountPaise =
    (fullPlanDifference * applicableCycles) / input.totalCycles;
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("The plan upgrade price could not be calculated exactly.");
  }
  return {
    applicableCycles,
    amountPaise,
    effectiveAt,
    requestedOnCycleDayOne,
  };
}
