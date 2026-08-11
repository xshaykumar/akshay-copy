import { z } from "zod";

export const assessmentGoals = [
  "fat_loss",
  "muscle_gain",
  "strength",
  "athlete_performance",
  "rehabilitation",
  "general_fitness",
  "other",
] as const;

export const assessmentGoalLabels: Record<(typeof assessmentGoals)[number], string> = {
  fat_loss: "Fat Loss",
  muscle_gain: "Muscle Gain",
  strength: "Strength",
  athlete_performance: "Athlete Performance",
  rehabilitation: "Rehabilitation",
  general_fitness: "General Fitness",
  other: "Other",
};

export const assessmentGenders = [
  "female",
  "male",
  "non_binary",
  "prefer_not_to_say",
  "other",
] as const;

export const assessmentGenderLabels: Record<(typeof assessmentGenders)[number], string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
  other: "Other",
};

export const assessmentExperiences = ["beginner", "intermediate", "advanced"] as const;
export const dietaryPreferences = ["vegetarian", "non_vegetarian", "vegan"] as const;
export const preferredTrainingTimes = ["morning", "afternoon", "evening", "flexible"] as const;

export const clientAvailabilitySchema = z.object({
  trainingDaysPerWeek: z.number().int().min(1).max(7),
  preferredTrainingTime: z.enum(preferredTrainingTimes),
});

export function hasClientAvailability(responses: unknown) {
  return clientAvailabilitySchema.safeParse(responses).success;
}

const assessmentFields = {
  age: z.number().int().min(13).max(100),
  gender: z.enum(assessmentGenders),
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(25).max(400),
  goals: z.array(z.enum(assessmentGoals)).min(1).max(assessmentGoals.length),
  otherGoal: z.string().trim().max(300).optional(),
  experience: z.enum(assessmentExperiences),
  hasMedicalCondition: z.boolean(),
  medicalDetails: z.string().trim().max(4_000).optional(),
  dietaryPreference: z.enum(dietaryPreferences),
  trainingDaysPerWeek: z.number().int().min(1).max(7),
  preferredTrainingTime: z.enum(preferredTrainingTimes),
  additionalInformation: z.string().trim().max(4_000).optional(),
  declarationAccepted: z.boolean(),
};

export const preCoachingDraftResponsesSchema = z.object(assessmentFields).partial().strict();

export const preCoachingResponsesSchema = z
  .object({
    ...assessmentFields,
    declarationAccepted: z.literal(true),
  })
  .strict()
  .superRefine((responses, context) => {
    if (responses.goals.includes("other") && !responses.otherGoal?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["otherGoal"],
        message: "Describe your other goal.",
      });
    }
  });

export type PreCoachingDraftResponses = z.infer<typeof preCoachingDraftResponsesSchema>;
export type PreCoachingResponses = z.infer<typeof preCoachingResponsesSchema>;
