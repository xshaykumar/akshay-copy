import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assessmentReports, assessments } from "@/db/schema";
import {
  preCoachingResponsesSchema,
  type PreCoachingResponses,
} from "@/lib/assessments/pre-coaching";

export type CompletedPreCoachingAssessment = {
  id: string;
  responses: PreCoachingResponses;
  submittedAt: Date | null;
};

export async function getCompletedPreCoachingAssessment(
  clientUserId: string,
): Promise<CompletedPreCoachingAssessment | null> {
  const db = getDb();
  const submitted = await db
    .select({
      id: assessments.id,
      responses: assessments.responses,
      submittedAt: assessments.submittedAt,
    })
    .from(assessments)
    .where(
      and(
        eq(assessments.clientUserId, clientUserId),
        eq(assessments.status, "submitted"),
      ),
    )
    .orderBy(desc(assessments.version));

  for (const assessment of submitted) {
    const parsed = preCoachingResponsesSchema.safeParse(assessment.responses);
    if (!parsed.success) continue;

    if (parsed.data.hasMedicalCondition && !parsed.data.medicalDetails?.trim()) {
      const [report] = await db
        .select({ id: assessmentReports.id })
        .from(assessmentReports)
        .where(eq(assessmentReports.assessmentId, assessment.id))
        .limit(1);
      if (!report) continue;
    }

    return {
      id: assessment.id,
      responses: parsed.data,
      submittedAt: assessment.submittedAt,
    };
  }

  return null;
}
