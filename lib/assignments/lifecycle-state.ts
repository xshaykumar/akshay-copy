export const CLIENT_SELECTION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const COACH_APPLICATION_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

export type AssignmentPhase = {
  status: "selection" | "open_pool";
  selectionWindowEndsAt: Date;
  applicationWindowEndsAt: Date | null;
  cycleNumber: number;
  refundEligibleAt: Date | null;
};

export function nextAssignmentPhase(
  current: AssignmentPhase,
  now: Date,
): AssignmentPhase | null {
  if (
    current.status === "selection" &&
    current.selectionWindowEndsAt <= now
  ) {
    return {
      ...current,
      status: "open_pool",
      applicationWindowEndsAt: new Date(
        current.selectionWindowEndsAt.getTime() +
          COACH_APPLICATION_WINDOW_MS,
      ),
    };
  }

  if (
    current.status === "open_pool" &&
    current.applicationWindowEndsAt &&
    current.applicationWindowEndsAt <= now
  ) {
    return {
      status: "selection",
      selectionWindowEndsAt: new Date(
        current.applicationWindowEndsAt.getTime() +
          CLIENT_SELECTION_WINDOW_MS,
      ),
      applicationWindowEndsAt: null,
      cycleNumber: current.cycleNumber + 1,
      refundEligibleAt:
        current.refundEligibleAt ?? current.applicationWindowEndsAt,
    };
  }

  return null;
}
