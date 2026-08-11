import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assessments,
  coachAssignments,
} from "@/db/schema";
import type { AuthenticatedAppUser } from "@/lib/auth/session";
import { HttpError } from "@/lib/http/errors";
import { reconcileDueServiceCycles } from "@/lib/service-cycles/lifecycle";

function isVerifiedAdmin(user: AuthenticatedAppUser) {
  return user.roles.includes("admin") && user.aal === "aal2";
}

export async function assertAssessmentAccess(
  assessmentId: string,
  user: AuthenticatedAppUser,
) {
  await reconcileDueServiceCycles();
  if (isVerifiedAdmin(user)) return;
  const [assessment] = await getDb()
    .select({ clientUserId: assessments.clientUserId })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);
  if (!assessment) {
    throw new HttpError(404, "assessment_not_found", "The assessment was not found.");
  }
  if (assessment.clientUserId === user.id) return;
  if (user.roles.includes("coach")) {
    const [assignment] = await getDb()
      .select({ id: coachAssignments.id })
      .from(coachAssignments)
      .where(
        and(
          eq(coachAssignments.clientUserId, assessment.clientUserId),
          eq(coachAssignments.coachUserId, user.id),
          eq(coachAssignments.status, "assigned"),
        ),
      )
      .limit(1);
    if (assignment) return;
  }
  throw new HttpError(403, "file_forbidden", "Access is not allowed.");
}
