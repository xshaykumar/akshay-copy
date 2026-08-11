import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { ClientPortalPage } from "@/components/portal/ClientPortal";

const sections = new Set(["assessment", "coaches", "plan", "schedule", "replacement", "settings"]);

export default async function ClientSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{
    availableDays?: string | string[];
    preferredTime?: string;
    mode?: string;
    state?: string;
    city?: string;
    district?: string;
  }>;
}) {
  const { section } = await params;
  if (section === "payments") redirect("/client/plan");
  if (!sections.has(section)) notFound();
  return <ClientPortalPage section={section} filters={await searchParams} />;
}
