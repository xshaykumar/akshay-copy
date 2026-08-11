import type { ReactNode } from "react";
import { count, eq } from "drizzle-orm";
import { PortalShell } from "@/components/portal/PortalShell";
import { getDb } from "@/db";
import { coachProfiles, refunds } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePageRole("admin");
  const [[pendingCoaches], [pendingRefunds]] = await Promise.all([
    getDb()
      .select({ value: count() })
      .from(coachProfiles)
      .where(eq(coachProfiles.approvalStatus, "submitted")),
    getDb()
      .select({ value: count() })
      .from(refunds)
      .where(eq(refunds.status, "requested")),
  ]);
  const navIndicators = {
    ...(pendingCoaches.value > 0
      ? { "/admin/verification": "warning" as const }
      : {}),
    ...(pendingRefunds.value > 0
      ? { "/admin/refunds": "warning" as const }
      : {}),
  };
  return <PortalShell role="admin" displayName={user.displayName} navIndicators={navIndicators}>{children}</PortalShell>;
}
