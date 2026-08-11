import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { coachProfiles, coachSpecialties, users } from "@/db/schema";
import { PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public.module.css";
import { getProfilePhotoUrl } from "@/lib/profiles/photo";
import { activeCoachConditions } from "@/lib/coaches/activation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [coach] = await getDb()
    .select({ displayName: users.displayName })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(eq(coachProfiles.slug, slug))
    .limit(1);
  return { title: coach ? `${coach.displayName} | 360 Performance Coach` : "Coach | 360 Performance", description: coach ? `View ${coach.displayName}'s coaching specialties, experience, and delivery modes.` : undefined };
}

export default async function CoachProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [coach] = await getDb()
    .select({
      userId: users.id,
      displayName: users.displayName,
      yearsExperience: coachProfiles.yearsExperience,
      languages: coachProfiles.languages,
      coachingModes: coachProfiles.coachingModes,
      locationLabel: coachProfiles.locationLabel,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(and(eq(coachProfiles.slug, slug), activeCoachConditions(), eq(coachProfiles.acceptingClients, true), eq(users.status, "active")))
    .limit(1);
  if (!coach) notFound();
  const [specialties, photoUrl] = await Promise.all([
    getDb().select({ specialty: coachSpecialties.specialty }).from(coachSpecialties).where(eq(coachSpecialties.coachUserId, coach.userId)),
    getProfilePhotoUrl(coach.userId),
  ]);
  return (
    <PublicShell>
      <section className={styles.sectionMuted}>
        <div className={styles.profileBody}>
          <div className={styles.profileContent}>
            <section className={styles.profileSection}><div className={styles.publicProfileHeading}>{photoUrl ? <Image src={photoUrl} alt={`${coach.displayName} profile`} width={150} height={150} unoptimized /> : <span>{coach.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>}<div><span className={styles.eyebrow}>Verified active coach</span><h1>{coach.displayName}</h1></div></div></section>
            <section className={styles.profileSection}><h2>Specialties</h2><div className={styles.chipRow}>{specialties.map(({ specialty }) => <span key={specialty}>{specialty}</span>)}</div></section>
            <section className={styles.profileSection}><h2>Experience and delivery</h2><p>{coach.yearsExperience ?? 0} years of experience · {coach.languages.join(", ")} · {coach.coachingModes.join(" & ")} coaching{coach.locationLabel ? ` · ${coach.locationLabel}` : ""}</p></section>
          </div>
          <aside className={styles.profileSidebar}><span className={styles.eyebrow}>Current availability</span><h2>Accepting clients</h2><p>Purchase a plan first, then select this coach from your client portal.</p><Link href="/plans" className={styles.primaryButton}>Choose a plan</Link></aside>
        </div>
      </section>
    </PublicShell>
  );
}
