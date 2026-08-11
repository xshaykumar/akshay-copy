import { describe, expect, it } from "vitest";
import {
  CLIENT_SELECTION_WINDOW_MS,
  COACH_APPLICATION_WINDOW_MS,
  nextAssignmentPhase,
  type AssignmentPhase,
} from "../lib/assignments/lifecycle-state";

const start = new Date("2026-08-01T00:00:00.000Z");

function initialPhase(): AssignmentPhase {
  return {
    status: "selection",
    selectionWindowEndsAt: new Date(
      start.getTime() + CLIENT_SELECTION_WINDOW_MS,
    ),
    applicationWindowEndsAt: null,
    cycleNumber: 1,
    refundEligibleAt: null,
  };
}

describe("coach assignment lifecycle", () => {
  it("opens a six-day coach application phase after client selection expires", () => {
    const selection = initialPhase();
    const application = nextAssignmentPhase(
      selection,
      selection.selectionWindowEndsAt,
    );

    expect(application?.status).toBe("open_pool");
    expect(application?.applicationWindowEndsAt?.getTime()).toBe(
      selection.selectionWindowEndsAt.getTime() +
        COACH_APPLICATION_WINDOW_MS,
    );
    expect(application?.cycleNumber).toBe(1);
    expect(application?.refundEligibleAt).toBeNull();
  });

  it("reopens client selection and enables refunds after an empty application phase", () => {
    const selection = initialPhase();
    const application = nextAssignmentPhase(
      selection,
      selection.selectionWindowEndsAt,
    );
    expect(application).not.toBeNull();

    const renewed = nextAssignmentPhase(
      application as AssignmentPhase,
      application?.applicationWindowEndsAt as Date,
    );
    expect(renewed?.status).toBe("selection");
    expect(renewed?.cycleNumber).toBe(2);
    expect(renewed?.refundEligibleAt).toEqual(
      application?.applicationWindowEndsAt,
    );
    expect(renewed?.selectionWindowEndsAt.getTime()).toBe(
      (application?.applicationWindowEndsAt as Date).getTime() +
        CLIENT_SELECTION_WINDOW_MS,
    );
  });

  it("preserves refund eligibility across later cycles", () => {
    const refundEligibleAt = new Date("2026-08-08T00:00:00.000Z");
    const laterApplication: AssignmentPhase = {
      status: "open_pool",
      selectionWindowEndsAt: new Date("2026-08-09T00:00:00.000Z"),
      applicationWindowEndsAt: new Date("2026-08-15T00:00:00.000Z"),
      cycleNumber: 2,
      refundEligibleAt,
    };

    const renewed = nextAssignmentPhase(
      laterApplication,
      laterApplication.applicationWindowEndsAt as Date,
    );
    expect(renewed?.cycleNumber).toBe(3);
    expect(renewed?.refundEligibleAt).toEqual(refundEligibleAt);
  });
});
