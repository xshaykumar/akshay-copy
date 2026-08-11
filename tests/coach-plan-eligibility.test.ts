import { describe, expect, it } from "vitest";
import {
  coachCanServePlan,
  isAthleteExecutivePlan,
} from "../lib/plans/coach-eligibility";

describe("coach plan eligibility", () => {
  const athletePlan = {
    code: "athlete-executive-180",
    name: "Athlete / Executive Performance",
  };

  it("identifies every duration of the Athlete / Executive plan", () => {
    expect(isAthleteExecutivePlan(athletePlan)).toBe(true);
    expect(
      isAthleteExecutivePlan({
        code: "legacy-code",
        name: "Athlete / Executive Performance",
      }),
    ).toBe(true);
    expect(
      isAthleteExecutivePlan({
        code: "online-individual-180",
        name: "Online Individual Coaching",
      }),
    ).toBe(false);
  });

  it("excludes Other-only coaches from Athlete / Executive assignments", () => {
    expect(
      coachCanServePlan({ athleteExecutiveEligible: false }, athletePlan),
    ).toBe(false);
    expect(
      coachCanServePlan({ athleteExecutiveEligible: true }, athletePlan),
    ).toBe(true);
  });

  it("does not restrict Other-only coaches from other plans", () => {
    expect(
      coachCanServePlan(
        { athleteExecutiveEligible: false },
        {
          code: "online-group-90",
          name: "Online Group Coaching",
        },
      ),
    ).toBe(true);
  });
});
