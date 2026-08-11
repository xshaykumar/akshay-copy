import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Panel, PanelHeader, StatusBadge } from "@/components/portal/PortalPrimitives";
import { PageIntro } from "@/components/portal/PortalShell";
import styles from "@/components/portal/portal.module.css";
import { getDb } from "@/db";
import {
  assessments,
  clientProfiles,
  coachAssignments,
  planPurchases,
  plans,
  users,
} from "@/db/schema";
import { hasClientAvailability } from "@/lib/assessments/pre-coaching";
import { requirePageRole } from "@/lib/auth/session";
import { formatPlanDuration } from "@/lib/plans/duration";
import { createAdminClient } from "@/lib/supabase/admin";

function dateTime(value: Date | null) {
  return value
    ? value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Not available";
}

export default async function AdminClientProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requirePageRole("admin");
  const parsedId = z.uuid().safeParse((await params).userId);
  if (!parsedId.success) notFound();
  const userId = parsedId.data;
  const db = getDb();

  const [client] = await db
    .select({
      id: users.id,
      authUserId: users.authUserId,
      displayName: users.displayName,
      username: users.username,
      contactPhone: users.contactPhone,
      accountStatus: users.status,
      createdAt: users.createdAt,
      timezone: clientProfiles.timezone,
      state: clientProfiles.locationState,
      city: clientProfiles.locationCity,
      district: clientProfiles.locationDistrict,
    })
    .from(clientProfiles)
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(eq(clientProfiles.userId, userId))
    .limit(1);
  if (!client) notFound();

  const [purchases, assignments, latestAssessment, authResult] =
    await Promise.all([
      db
        .select({
          id: planPurchases.id,
          status: planPurchases.status,
          amountPaise: planPurchases.amountPaise,
          purchasedAt: planPurchases.purchasedAt,
          activatedAt: planPurchases.activatedAt,
          expiresAt: planPurchases.expiresAt,
          planName: plans.name,
          durationDays: plans.durationDays,
        })
        .from(planPurchases)
        .innerJoin(plans, eq(plans.id, planPurchases.planId))
        .where(eq(planPurchases.clientUserId, userId))
        .orderBy(desc(planPurchases.createdAt)),
      db
        .select({
          id: coachAssignments.id,
          status: coachAssignments.status,
          assignedAt: coachAssignments.assignedAt,
          coachName: users.displayName,
        })
        .from(coachAssignments)
        .leftJoin(users, eq(users.id, coachAssignments.coachUserId))
        .where(eq(coachAssignments.clientUserId, userId))
        .orderBy(desc(coachAssignments.createdAt)),
      db
        .select({
          status: assessments.status,
          version: assessments.version,
          responses: assessments.responses,
          submittedAt: assessments.submittedAt,
        })
        .from(assessments)
        .where(eq(assessments.clientUserId, userId))
        .orderBy(desc(assessments.version))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      createAdminClient().auth.admin.getUserById(client.authUserId),
    ]);
  const assessmentAvailability = latestAssessment
    ? hasClientAvailability(latestAssessment.responses)
    : false;

  return (
    <>
      <Link className={styles.backLink} href="/admin/users">
        <ArrowLeft size={15} aria-hidden="true" /> Back to clients
      </Link>
      <PageIntro
        eyebrow="Administrator client profile"
        title={client.displayName}
        description={`@${client.username} · registered ${client.createdAt.toLocaleDateString("en-IN")}`}
      />
      <section className={styles.dashboardTwoColumn}>
        <Panel>
          <PanelHeader title="Account and contact" />
          <div className={styles.overviewDetails}>
            <p><strong>Account</strong><StatusBadge tone={client.accountStatus === "active" ? "success" : "warning"}>{client.accountStatus}</StatusBadge></p>
            <p><strong>Email</strong><span>{authResult.data.user?.email ?? "Not provided"}</span></p>
            <p><strong>Mobile</strong><span>{client.contactPhone ?? "Not provided"}</span></p>
            <p><strong>Location</strong><span>{[client.district, client.city, client.state].filter(Boolean).join(", ") || "Not provided"}</span></p>
            <p><strong>Timezone</strong><span>{client.timezone}</span></p>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Assessment status" />
          <div className={styles.overviewDetails}>
            <p><strong>Latest version</strong><span>{latestAssessment ? `Version ${latestAssessment.version}` : "Not started"}</span></p>
            <p><strong>Status</strong><span>{latestAssessment?.status ?? "Not started"}</span></p>
            <p><strong>Availability</strong><StatusBadge tone={assessmentAvailability ? "success" : "warning"}>{assessmentAvailability ? "Complete" : "Missing"}</StatusBadge></p>
            <p><strong>Submitted</strong><span>{dateTime(latestAssessment?.submittedAt ?? null)}</span></p>
          </div>
        </Panel>
      </section>
      <Panel>
        <PanelHeader title="Plans" description={`${purchases.length} purchase record${purchases.length === 1 ? "" : "s"}`} />
        {purchases.length === 0 ? <p>No plan has been purchased.</p> : (
          <div className={styles.sessionList}>
            {purchases.map((purchase) => (
              <article className={styles.attentionRow} key={purchase.id}>
                <div>
                  <h3>{purchase.planName}</h3>
                  <p>{formatPlanDuration(purchase.durationDays)} · ₹{(purchase.amountPaise / 100).toLocaleString("en-IN")}</p>
                  <p>Purchased {dateTime(purchase.purchasedAt)} · activated {dateTime(purchase.activatedAt)} · expires {dateTime(purchase.expiresAt)}</p>
                </div>
                <StatusBadge tone={purchase.status === "active" || purchase.status === "paid" ? "success" : "neutral"}>{purchase.status}</StatusBadge>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <Panel>
        <PanelHeader title="Coach assignments" description={`${assignments.length} assignment record${assignments.length === 1 ? "" : "s"}`} />
        {assignments.length === 0 ? <p>No coach assignment exists.</p> : (
          <div className={styles.sessionList}>
            {assignments.map((assignment) => (
              <article className={styles.attentionRow} key={assignment.id}>
                <div><h3>{assignment.coachName ?? "Coach not selected"}</h3><p>Assigned {dateTime(assignment.assignedAt)}</p></div>
                <StatusBadge tone={assignment.status === "assigned" ? "success" : "warning"}>{assignment.status.replace("_", " ")}</StatusBadge>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
