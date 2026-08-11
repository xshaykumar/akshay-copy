import { asc, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Panel, PanelHeader, SecondaryLink, StatusBadge } from "@/components/portal/PortalPrimitives";
import { PageIntro } from "@/components/portal/PortalShell";
import styles from "@/components/portal/portal.module.css";
import { getDb } from "@/db";
import {
  coachActivationPayments,
  coachAssignments,
  coachCertifications,
  coachProfiles,
  coachSpecialties,
  planPurchases,
  plans,
  users,
} from "@/db/schema";
import { requirePageRole } from "@/lib/auth/session";
import {
  coachAvailabilityDayLabels,
  coachAvailabilityTimeSlotLabels,
  hasCoachAvailability,
  isCoachProfileActive,
  type CoachAvailabilityDay,
  type CoachAvailabilityTimeSlot,
} from "@/lib/coaches/activation";
import { coachQualificationDisplayName, type CoachQualificationType } from "@/lib/coaches/certifications";
import { createAdminClient } from "@/lib/supabase/admin";

function dateTime(value: Date | null) {
  return value
    ? value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Not available";
}

export default async function AdminCoachProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requirePageRole("admin");
  const parsedId = z.uuid().safeParse((await params).userId);
  if (!parsedId.success) notFound();
  const userId = parsedId.data;
  const db = getDb();

  const [coach] = await db
    .select({
      authUserId: users.authUserId,
      displayName: users.displayName,
      username: users.username,
      contactPhone: users.contactPhone,
      accountStatus: users.status,
      createdAt: users.createdAt,
      slug: coachProfiles.slug,
      yearsExperience: coachProfiles.yearsExperience,
      languages: coachProfiles.languages,
      coachingModes: coachProfiles.coachingModes,
      acceptingClients: coachProfiles.acceptingClients,
      approvalStatus: coachProfiles.approvalStatus,
      approvedAt: coachProfiles.approvedAt,
      certificationWaivedAt: coachProfiles.certificationWaivedAt,
      athleteExecutiveEligible: coachProfiles.athleteExecutiveEligible,
      availableDays: coachProfiles.availableDays,
      availableTimeSlots: coachProfiles.availableTimeSlots,
      activationExpiresAt: coachProfiles.activationExpiresAt,
      state: coachProfiles.locationState,
      city: coachProfiles.locationCity,
      district: coachProfiles.locationDistrict,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(eq(coachProfiles.userId, userId))
    .limit(1);
  if (!coach) notFound();

  const [specialties, certifications, assignments, payments, authResult] =
    await Promise.all([
      db.select().from(coachSpecialties).where(eq(coachSpecialties.coachUserId, userId)),
      db.select().from(coachCertifications).where(eq(coachCertifications.coachUserId, userId)).orderBy(asc(coachCertifications.createdAt)),
      db
        .select({
          id: coachAssignments.id,
          status: coachAssignments.status,
          assignedAt: coachAssignments.assignedAt,
          clientName: users.displayName,
          clientUserId: users.id,
          planName: plans.name,
        })
        .from(coachAssignments)
        .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
        .innerJoin(planPurchases, eq(planPurchases.id, coachAssignments.purchaseId))
        .innerJoin(plans, eq(plans.id, planPurchases.planId))
        .where(eq(coachAssignments.coachUserId, userId))
        .orderBy(desc(coachAssignments.createdAt)),
      db
        .select()
        .from(coachActivationPayments)
        .where(eq(coachActivationPayments.coachUserId, userId))
        .orderBy(desc(coachActivationPayments.createdAt)),
      createAdminClient().auth.admin.getUserById(coach.authUserId),
    ]);
  const profileActive = coach.accountStatus === "active" && isCoachProfileActive(coach);
  const availabilityComplete = hasCoachAvailability(coach);

  return (
    <>
      <Link className={styles.backLink} href="/admin/coaches">
        <ArrowLeft size={15} aria-hidden="true" /> Back to coaches
      </Link>
      <PageIntro
        eyebrow="Administrator coach profile"
        title={coach.displayName}
        description={`@${coach.username} · registered ${coach.createdAt.toLocaleDateString("en-IN")}`}
        action={<SecondaryLink href={`/coaches/${coach.slug}`}>Open public profile</SecondaryLink>}
      />
      <section className={styles.dashboardTwoColumn}>
        <Panel>
          <PanelHeader title="Account and activation" />
          <div className={styles.overviewDetails}>
            <p><strong>Account</strong><StatusBadge tone={coach.accountStatus === "active" ? "success" : "danger"}>{coach.accountStatus}</StatusBadge></p>
            <p><strong>Profile access</strong><StatusBadge tone={profileActive ? "success" : "warning"}>{profileActive ? "Active" : "Inactive"}</StatusBadge></p>
            <p><strong>Activation expires</strong><span>{dateTime(coach.activationExpiresAt)}</span></p>
            <p><strong>Certification</strong><span>{coach.certificationWaivedAt ? "Waived by admin" : coach.approvalStatus}</span></p>
            <p><strong>Accepting clients</strong><StatusBadge tone={coach.acceptingClients ? "success" : "warning"}>{coach.acceptingClients ? "Yes" : "No"}</StatusBadge></p>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Contact and availability" />
          <div className={styles.overviewDetails}>
            <p><strong>Email</strong><span>{authResult.data.user?.email ?? "Not provided"}</span></p>
            <p><strong>Mobile</strong><span>{coach.contactPhone ?? "Not provided"}</span></p>
            <p><strong>Location</strong><span>{[coach.district, coach.city, coach.state].filter(Boolean).join(", ") || "Not provided"}</span></p>
            <p><strong>Availability</strong><StatusBadge tone={availabilityComplete ? "success" : "warning"}>{availabilityComplete ? "Complete" : "Missing"}</StatusBadge></p>
            <p><strong>Days</strong><span>{coach.availableDays.map((day) => coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day).join(", ") || "None"}</span></p>
            <p><strong>Time slots</strong><span>{coach.availableTimeSlots.map((slot) => coachAvailabilityTimeSlotLabels[slot as CoachAvailabilityTimeSlot] ?? slot).join(", ") || "None"}</span></p>
          </div>
        </Panel>
      </section>
      <Panel>
        <PanelHeader title="Public coaching profile" />
        <div className={styles.overviewDetails}>
          <p><strong>Experience</strong><span>{coach.yearsExperience === null ? "Not completed" : `${coach.yearsExperience} years`}</span></p>
          <p><strong>Languages</strong><span>{coach.languages.join(", ") || "Not completed"}</span></p>
          <p><strong>Modes</strong><span>{coach.coachingModes.join(", ") || "Not completed"}</span></p>
          <p><strong>Specialties</strong><span>{specialties.map((row) => row.specialty).join(", ") || "Not completed"}</span></p>
          <p><strong>Athlete/Executive</strong><span>{coach.athleteExecutiveEligible ? "Eligible" : "Not eligible"}</span></p>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Qualifications" description={`${certifications.length} uploaded`} />
        {certifications.length === 0 ? <p>No qualification has been uploaded.</p> : (
          <div className={styles.sessionList}>
            {certifications.map((certification) => (
              <article className={styles.attentionRow} key={certification.id}>
                <div><h3>{coachQualificationDisplayName(certification.qualificationType as CoachQualificationType, certification.qualificationTitle)}</h3><p>{certification.originalFilename}</p></div>
                <StatusBadge tone={certification.verificationStatus === "approved" ? "success" : certification.verificationStatus === "rejected" ? "danger" : "warning"}>{certification.verificationStatus}</StatusBadge>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <Panel>
        <PanelHeader title="Assigned clients" description={`${assignments.length} assignment record${assignments.length === 1 ? "" : "s"}`} />
        {assignments.length === 0 ? <p>No client has been assigned.</p> : (
          <div className={styles.sessionList}>
            {assignments.map((assignment) => (
              <article className={styles.attentionRow} key={assignment.id}>
                <div><h3><Link className={styles.textLink} href={`/admin/clients/${assignment.clientUserId}`}>{assignment.clientName}</Link></h3><p>{assignment.planName} · assigned {dateTime(assignment.assignedAt)}</p></div>
                <StatusBadge tone={assignment.status === "assigned" ? "success" : "neutral"}>{assignment.status}</StatusBadge>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <Panel>
        <PanelHeader title="Activation payments" description={`${payments.length} payment record${payments.length === 1 ? "" : "s"}`} />
        {payments.length === 0 ? <p>No paid activation exists. Current access may have been granted manually.</p> : (
          <div className={styles.sessionList}>
            {payments.map((payment) => (
              <article className={styles.attentionRow} key={payment.id}>
                <div><h3>{payment.durationDays} days · ₹{(payment.amountPaise / 100).toLocaleString("en-IN")}</h3><p>{dateTime(payment.periodStartsAt)} to {dateTime(payment.periodEndsAt)}</p></div>
                <StatusBadge tone={payment.status === "captured" ? "success" : "warning"}>{payment.status}</StatusBadge>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
