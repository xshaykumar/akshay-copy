import { describe, expect, it } from "vitest";
import {
  hasClientAvailability,
  preCoachingResponsesSchema,
} from "../lib/assessments/pre-coaching";

const validAssessment = {
  age: 29,
  gender: "male",
  heightCm: 178,
  weightKg: 79.5,
  goals: ["strength", "general_fitness"],
  experience: "intermediate",
  hasMedicalCondition: false,
  dietaryPreference: "non_vegetarian",
  trainingDaysPerWeek: 4,
  preferredTrainingTime: "morning",
  additionalInformation: "I travel twice a month.",
  declarationAccepted: true,
} as const;

describe("pre-coaching assessment validation", () => {
  it("accepts a complete assessment with multiple goals", () => {
    expect(preCoachingResponsesSchema.safeParse(validAssessment).success).toBe(true);
  });

  it("rejects submission without the declaration", () => {
    expect(
      preCoachingResponsesSchema.safeParse({
        ...validAssessment,
        declarationAccepted: false,
      }).success,
    ).toBe(false);
  });

  it("requires details when Other is selected as a goal", () => {
    const result = preCoachingResponsesSchema.safeParse({
      ...validAssessment,
      goals: ["other"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unsafe or implausible training inputs", () => {
    expect(
      preCoachingResponsesSchema.safeParse({
        ...validAssessment,
        age: 8,
        trainingDaysPerWeek: 9,
      }).success,
    ).toBe(false);
  });

  it("treats training days and preferred time as complete client availability", () => {
    expect(
      hasClientAvailability({
        trainingDaysPerWeek: 4,
        preferredTrainingTime: "evening",
      }),
    ).toBe(true);
    expect(hasClientAvailability({ trainingDaysPerWeek: 4 })).toBe(false);
    expect(
      hasClientAvailability({
        trainingDaysPerWeek: 8,
        preferredTrainingTime: "evening",
      }),
    ).toBe(false);
  });
});
