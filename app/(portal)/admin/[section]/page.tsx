import { notFound, redirect } from "next/navigation";
import { AdminPortalPage } from "@/components/portal/AdminPortal";

const sections = new Set(["consultations", "refunds", "verification", "coaches", "users", "groups", "settings"]);

export default async function AdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{
    coachStatus?: string;
    clientPayment?: string;
  }>;
}) {
  const { section } = await params;
  if (section === "analytics") redirect("/admin");
  if (!sections.has(section)) notFound();
  return <AdminPortalPage section={section} filters={await searchParams} />;
}
