import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { getCompletedPreCoachingAssessment } from "@/lib/assessments/status";
import { requirePageRole } from "@/lib/auth/session";
import { getProfilePhotoUrl } from "@/lib/profiles/photo";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const user = await requirePageRole("client");
  const [completedAssessment, profilePhotoUrl] = await Promise.all([
    getCompletedPreCoachingAssessment(user.id),
    getProfilePhotoUrl(user.id),
  ]);
  return <PortalShell role="client" displayName={user.displayName} profilePhotoUrl={profilePhotoUrl} navIndicators={!completedAssessment ? { "/client/assessment": "warning" } : {}}>{children}</PortalShell>;
}
