import { z } from "zod";

export const coachQualificationTypes = [
  "cscs",
  "acsm",
  "bpt",
  "mpt",
  "bsc_sports_exercise_science",
  "msc_sports_exercise_science",
  "other",
] as const;

export const coachQualificationLabels: Record<
  (typeof coachQualificationTypes)[number],
  string
> = {
  cscs: "CSCS (Certified Strength and Conditioning Specialist)",
  acsm: "ACSM (American College of Sports Medicine)",
  bpt: "BPT (Bachelor of Physiotherapy)",
  mpt: "MPT (Master of Physiotherapy)",
  bsc_sports_exercise_science: "BSc in Sports Science / Exercise Science",
  msc_sports_exercise_science: "MSc in Sports Science / Exercise Science",
  other: "Other qualification",
};

export const coachQualificationSchema = z.enum(coachQualificationTypes);
export type CoachQualificationType = z.infer<typeof coachQualificationSchema>;

export const athleteExecutiveQualificationTypes = coachQualificationTypes.filter(
  (qualification) => qualification !== "other",
);

export function coachQualificationDisplayName(
  qualificationType: CoachQualificationType,
  qualificationTitle?: string | null,
) {
  return qualificationType === "other" && qualificationTitle?.trim()
    ? qualificationTitle.trim()
    : coachQualificationLabels[qualificationType];
}

export type CoachCertificationStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "suspended";

export function certificationStatusLabel(status: CoachCertificationStatus) {
  if (status === "approved") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "submitted") return "Under review";
  if (status === "suspended") return "Suspended";
  return "Pending submission";
}
