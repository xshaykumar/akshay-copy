import type { ReactNode } from "react";
import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import { PortalShell } from "@/components/portal/PortalShell";
import { getDb } from "@/db";
import {
  coachAssignments,
  coachProfiles,
  coachSelectionRequests,
  planPurchases,
  replacementRequests,
} from "@/db/schema";
import { requirePageRole } from "@/lib/auth/session";
import { reconcileDueAssignmentLifecycles } from "@/lib/assignments/lifecycle";
import { isCoachProfileActive } from "@/lib/coaches/activation";
import { getProfilePhotoUrl } from "@/lib/profiles/photo";

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const user = await requirePageRole("coach");
  await reconcileDueAssignmentLifecycles();
  const now = new Date();
  const [[profile], [pendingSwitches], [directRequests], [openPool], profilePhotoUrl] = await Promise.all([
    getDb()
      .select({
        approvalStatus: coachProfiles.approvalStatus,
        approvedAt: coachProfiles.approvedAt,
        certificationWaivedAt: coachProfiles.certificationWaivedAt,
        activationExpiresAt: coachProfiles.activationExpiresAt,
        acceptingClients: coachProfiles.acceptingClients,
      })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, user.id))
      .limit(1),
    getDb()
      .select({ value: count() })
      .from(replacementRequests)
      .where(
        and(
          eq(replacementRequests.desiredCoachUserId, user.id),
          eq(replacementRequests.status, "requested"),
          gt(replacementRequests.responseDeadlineAt, now),
        ),
      ),
    getDb()
      .select({ value: count() })
      .from(coachSelectionRequests)
      .where(
        and(
          eq(coachSelectionRequests.coachUserId, user.id),
          eq(coachSelectionRequests.status, "pending"),
          gt(coachSelectionRequests.expiresAt, now),
        ),
      ),
    getDb()
      .select({ value: count() })
      .from(coachAssignments)
      .innerJoin(planPurchases, eq(planPurchases.id, coachAssignments.purchaseId))
      .where(
        and(
          eq(coachAssignments.status, "open_pool"),
          eq(planPurchases.status, "paid"),
          or(
            isNull(coachAssignments.applicationWindowEndsAt),
            gt(coachAssignments.applicationWindowEndsAt, now),
          ),
        ),
      ),
    getProfilePhotoUrl(user.id),
  ]);
  const certificationIndicator = profile?.certificationWaivedAt
    ? undefined
    : profile?.approvalStatus === "rejected"
    ? "danger" as const
    : profile?.approvalStatus === "approved"
      ? "success" as const
      : profile?.approvalStatus === "draft" || profile?.approvalStatus === "submitted" || !profile
      ? "warning" as const
      : undefined;
  const activationIndicator = !profile || !isCoachProfileActive(profile)
    ? "warning" as const
    : undefined;
  const hasOpportunities = directRequests.value > 0 || Boolean(
    profile &&
    profile.acceptingClients &&
    isCoachProfileActive(profile, now) &&
    openPool.value > 0,
  );
  return <PortalShell role="coach" displayName={user.displayName} profilePhotoUrl={profilePhotoUrl} navIndicators={{ ...(certificationIndicator ? { "/coach/certification": certificationIndicator } : {}), ...(activationIndicator ? { "/coach/activation": activationIndicator } : {}), ...(hasOpportunities ? { "/coach/opportunities": "warning" as const } : {}), ...(pendingSwitches.value > 0 ? { "/coach/switch-requests": "warning" as const } : {}) }}>{children}</PortalShell>;
}
