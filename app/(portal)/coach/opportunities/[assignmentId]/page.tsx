import { and, eq, gt } from "drizzle-orm";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Panel, PanelHeader, StatusBadge } from "@/components/portal/PortalPrimitives";
import { PageIntro } from "@/components/portal/PortalShell";
import styles from "@/components/portal/portal.module.css";
import { getDb } from "@/db";
import {
  clientProfiles,
  coachAssignments,
  coachProfiles,
  coachSelectionRequests,
  planPurchases,
  plans,
  users,
} from "@/db/schema";
import { requirePageRole } from "@/lib/auth/session";
import { formatClientPreferredSlot } from "@/lib/assignments/client-availability";
import { coachAvailabilityDayLabels, isCoachProfileActive, type CoachAvailabilityDay } from "@/lib/coaches/activation";
import { coachHasCurrentServiceAccess } from "@/lib/coaches/service-access";
import { coachCanServePlan } from "@/lib/plans/coach-eligibility";
import { formatPlanDuration } from "@/lib/plans/duration";
import { getProfilePhotoUrl } from "@/lib/profiles/photo";

export default async function OpportunityClientOverviewPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const coach = await requirePageRole("coach");
  if (!(await coachHasCurrentServiceAccess(coach.id))) {
    redirect("/coach/activation?reason=service-access-expired");
  }
  const parsedId = z.uuid().safeParse((await params).assignmentId);
  if (!parsedId.success) notFound();
  const assignmentId = parsedId.data;
  const db = getDb();
  const [[profile], [assignment]] = await Promise.all([
    db.select().from(coachProfiles).where(eq(coachProfiles.userId, coach.id)).limit(1),
    db
      .select({
        id: coachAssignments.id,
        status: coachAssignments.status,
        clientUserId: coachAssignments.clientUserId,
        clientName: users.displayName,
        clientUsername: users.username,
        planCode: plans.code,
        planName: plans.name,
        planMode: plans.coachingMode,
        planDurationDays: plans.durationDays,
        purchaseStatus: planPurchases.status,
        selectionWindowEndsAt: coachAssignments.selectionWindowEndsAt,
        applicationWindowEndsAt: coachAssignments.applicationWindowEndsAt,
        cycleNumber: coachAssignments.cycleNumber,
        clientAvailableDays: coachAssignments.clientAvailableDays,
        clientPreferredTime: coachAssignments.clientPreferredTime,
        state: clientProfiles.locationState,
        city: clientProfiles.locationCity,
        district: clientProfiles.locationDistrict,
      })
      .from(coachAssignments)
      .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
      .innerJoin(planPurchases, eq(planPurchases.id, coachAssignments.purchaseId))
      .innerJoin(plans, eq(plans.id, planPurchases.planId))
      .leftJoin(clientProfiles, eq(clientProfiles.userId, coachAssignments.clientUserId))
      .where(eq(coachAssignments.id, assignmentId))
      .limit(1),
  ]);
  if (
    !profile ||
    !assignment ||
    !isCoachProfileActive(profile) ||
    !profile.acceptingClients ||
    assignment.purchaseStatus !== "paid" ||
    !coachCanServePlan(profile, {
      code: assignment.planCode,
      name: assignment.planName,
    })
  ) notFound();

  const now = new Date();
  let accessType: "direct" | "pool" | null = null;
  if (assignment.status === "selection") {
    const [request] = await db
      .select({ id: coachSelectionRequests.id })
      .from(coachSelectionRequests)
      .where(
        and(
          eq(coachSelectionRequests.assignmentId, assignment.id),
          eq(coachSelectionRequests.coachUserId, coach.id),
          eq(coachSelectionRequests.status, "pending"),
          gt(coachSelectionRequests.expiresAt, now),
        ),
      )
      .limit(1);
    if (request) accessType = "direct";
  } else if (
    assignment.status === "open_pool" &&
    (!assignment.applicationWindowEndsAt || assignment.applicationWindowEndsAt > now)
  ) {
    accessType = "pool";
  }
  if (!accessType) notFound();

  const photoUrl = await getProfilePhotoUrl(assignment.clientUserId);
  const deadline = accessType === "direct"
    ? assignment.selectionWindowEndsAt
    : assignment.applicationWindowEndsAt;

  return (
    <>
      <Link className={styles.backLink} href="/coach/opportunities">
        <ArrowLeft size={15} aria-hidden="true" /> Back to opportunities
      </Link>
      <PageIntro
        eyebrow={accessType === "direct" ? "Direct client request" : "Six-day client pool"}
        title={assignment.clientName}
        description="This limited overview supports matching. Health and private contact information remain hidden until assignment."
      />
      <section className={styles.clientProfileHero}>
        <div
          className={`${styles.clientProfileAvatar} ${photoUrl ? styles.clientProfileAvatarPhoto : ""}`}
          style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
          aria-hidden="true"
        >
          {photoUrl ? null : assignment.clientName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
        </div>
        <div>
          <span className={styles.eyebrow}>Client overview</span>
          <h2>{assignment.planName}</h2>
          <p>@{assignment.clientUsername} · {assignment.planMode} coaching · {formatPlanDuration(assignment.planDurationDays)}</p>
          <p>{[assignment.district, assignment.city, assignment.state].filter(Boolean).join(", ") || "Location not provided"}</p>
        </div>
        <div className={styles.clientProfileStatus}>
          <StatusBadge tone="warning">{accessType === "direct" ? "Awaiting response" : "Open pool"}</StatusBadge>
          <span>Round {assignment.cycleNumber}</span>
        </div>
      </section>
      <Panel>
        <PanelHeader title="Matching details" />
        <div className={styles.overviewDetails}>
          <p><strong>Client</strong><span>{assignment.clientName}</span></p>
          <p><strong>Plan</strong><span>{assignment.planName}</span></p>
          <p><strong>Delivery</strong><span>{assignment.planMode}</span></p>
          <p><strong>Plan length</strong><span>{formatPlanDuration(assignment.planDurationDays)}</span></p>
          <p><strong>Available days</strong><span>{assignment.clientAvailableDays.map((day) => coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day).join(", ") || "Not selected"}</span></p>
          <p><strong>Preferred slot</strong><span>{formatClientPreferredSlot(assignment.clientPreferredTime)}</span></p>
          <p><strong>Response deadline</strong><span>{deadline?.toLocaleString("en-IN") ?? "Not provided"}</span></p>
        </div>
        <div className={styles.healthPrivacyNote}>
          <ShieldCheck size={17} aria-hidden="true" />
          <p>Return to Coaching opportunities to accept, reject, or apply. Full health information is available only after the client is assigned to you.</p>
        </div>
      </Panel>
    </>
  );
}
