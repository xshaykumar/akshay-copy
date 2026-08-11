import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Panel, PanelHeader, StatusBadge } from "@/components/portal/PortalPrimitives";
import { PageIntro } from "@/components/portal/PortalShell";
import styles from "@/components/portal/portal.module.css";
import { getDb } from "@/db";
import { coachAssignments, coachProfiles, coachSpecialties, users } from "@/db/schema";
import { requirePageRole } from "@/lib/auth/session";
import {
  coachAvailabilityDayLabels,
  coachAvailabilityTimeSlotLabels,
  isCoachProfileActive,
  type CoachAvailabilityDay,
  type CoachAvailabilityTimeSlot,
} from "@/lib/coaches/activation";
import { getProfilePhotoUrl } from "@/lib/profiles/photo";

export default async function ClientCoachOverviewPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  const client = await requirePageRole("client");
  const parsedId = z.uuid().safeParse((await params).coachId);
  if (!parsedId.success) notFound();
  const coachId = parsedId.data;
  const db = getDb();
  const [[coach], [assignedRelationship]] = await Promise.all([
    db
    .select({
      displayName: users.displayName,
      username: users.username,
      yearsExperience: coachProfiles.yearsExperience,
      languages: coachProfiles.languages,
      coachingModes: coachProfiles.coachingModes,
      locationState: coachProfiles.locationState,
      locationCity: coachProfiles.locationCity,
      locationDistrict: coachProfiles.locationDistrict,
      availableDays: coachProfiles.availableDays,
      availableTimeSlots: coachProfiles.availableTimeSlots,
      acceptingClients: coachProfiles.acceptingClients,
      accountStatus: users.status,
      approvedAt: coachProfiles.approvedAt,
      certificationWaivedAt: coachProfiles.certificationWaivedAt,
      activationExpiresAt: coachProfiles.activationExpiresAt,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(eq(coachProfiles.userId, coachId))
    .limit(1),
    db
      .select({ id: coachAssignments.id })
      .from(coachAssignments)
      .where(
      and(
          eq(coachAssignments.clientUserId, client.id),
          eq(coachAssignments.coachUserId, coachId),
          eq(coachAssignments.status, "assigned"),
      ),
      )
      .limit(1),
  ]);
  const isAssignedCoach = Boolean(assignedRelationship);
  const isDiscoverable = Boolean(
    coach &&
      coach.accountStatus === "active" &&
      coach.acceptingClients &&
      isCoachProfileActive(coach),
  );
  if (!coach || (!isAssignedCoach && !isDiscoverable)) notFound();

  const [specialties, photoUrl] = await Promise.all([
    db
      .select({ specialty: coachSpecialties.specialty })
      .from(coachSpecialties)
      .where(eq(coachSpecialties.coachUserId, coachId))
      .orderBy(asc(coachSpecialties.specialty)),
    getProfilePhotoUrl(coachId),
  ]);

  return (
    <>
      <Link className={styles.backLink} href="/client/coaches">
        <ArrowLeft size={15} aria-hidden="true" /> Back to coaches
      </Link>
      <PageIntro
        eyebrow="Coach overview"
        title={coach.displayName}
        description="Review this coach's experience, specialties and current availability before sending a request."
      />
      <section className={styles.clientProfileHero}>
        <div
          className={`${styles.clientProfileAvatar} ${photoUrl ? styles.clientProfileAvatarPhoto : ""}`}
          style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
          aria-hidden="true"
        >
          {photoUrl ? null : coach.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
        </div>
        <div>
          <span className={styles.eyebrow}>360 Performance coach</span>
          <h2>@{coach.username}</h2>
          <p>{coach.yearsExperience ?? 0} years of experience</p>
          <p>{[coach.locationDistrict, coach.locationCity, coach.locationState].filter(Boolean).join(", ") || "Location not provided"}</p>
        </div>
        <div className={styles.clientProfileStatus}>
          <StatusBadge tone="success">{isAssignedCoach ? "Your assigned coach" : "Accepting clients"}</StatusBadge>
        </div>
      </section>
      <section className={styles.dashboardTwoColumn}>
        <Panel>
          <PanelHeader title="Coaching details" />
          <div className={styles.overviewDetails}>
            <p><strong>Languages</strong><span>{coach.languages.join(", ") || "Not provided"}</span></p>
            <p><strong>Coaching modes</strong><span>{coach.coachingModes.join(", ") || "Not provided"}</span></p>
            <p><strong>Specialties</strong><span>{specialties.map((row) => row.specialty).join(", ") || "Not provided"}</span></p>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Current availability" description="Availability may change before assignment." />
          <h3 className={styles.availabilityHeading}>Available days</h3>
          <div className={styles.availabilityTags}>{coach.availableDays.map((day) => <span key={day}>{coachAvailabilityDayLabels[day as CoachAvailabilityDay] ?? day}</span>)}</div>
          <h3 className={styles.availabilityHeading}>Available time slots</h3>
          <div className={styles.availabilityTags}>{coach.availableTimeSlots.map((slot) => <span key={slot}>{coachAvailabilityTimeSlotLabels[slot as CoachAvailabilityTimeSlot] ?? slot}</span>)}</div>
        </Panel>
      </section>
    </>
  );
}
