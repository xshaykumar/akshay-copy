import { notFound } from "next/navigation";
import { CoachPortalPage } from "@/components/portal/CoachPortal";

const sections = new Set(["certification", "activation", "clients", "opportunities", "switch-requests", "schedule", "groups", "profile", "settings"]);

export default async function CoachSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ assignmentId?: string }>;
}) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  const { assignmentId } = await searchParams;
  return <CoachPortalPage section={section} scheduleAssignmentId={assignmentId} />;
}
