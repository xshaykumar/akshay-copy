import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { coachProfiles, coachSpecialties, users } from "@/db/schema";
import { PageHero, PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public.module.css";
import { getProfilePhotoUrls } from "@/lib/profiles/photo";
import { activeCoachConditions } from "@/lib/coaches/activation";

export const metadata: Metadata = {
  title: "Find a Coach | 360 Performance",
  description: "Browse verified, active coaches currently accepting clients.",
};

export const dynamic = "force-dynamic";

export default async function CoachesPage() {
  const db = getDb();
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      slug: coachProfiles.slug,
      yearsExperience: coachProfiles.yearsExperience,
      languages: coachProfiles.languages,
      coachingModes: coachProfiles.coachingModes,
      locationLabel: coachProfiles.locationLabel,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(
      and(
        activeCoachConditions(),
        eq(coachProfiles.acceptingClients, true),
        eq(users.status, "active"),
      ),
    )
    .orderBy(asc(users.displayName));
  const specialtyRows = await db.select().from(coachSpecialties);
  const photoUrls = await getProfilePhotoUrls(rows.map((coach) => coach.userId));
  return (
    <PublicShell>
      <PageHero eyebrow="Verified professionals" title="The right expertise. The right fit." copy="Only certified coaches with a valid 30-day activation who are currently accepting clients appear in this directory." aside="Verified and active" />
      <section className={styles.sectionMuted}>
        <div className={styles.sectionInner}>
          <div className={styles.resultsBar}><p>Showing <strong>{rows.length} available coaches</strong></p></div>
          {rows.length === 0 ? <div className={styles.directoryNote}><div><h2>No coaches are available yet.</h2><p>Create a coach account, complete its profile, approve it as admin, then enable availability.</p></div><Link href="/register?role=coach">Create coach account →</Link></div> : (
            <div className={styles.coachGrid}>{rows.map((coach) => {
              const specialties = specialtyRows.filter((row) => row.coachUserId === coach.userId).map((row) => row.specialty);
              const photoUrl = photoUrls.get(coach.userId);
              return <article className={styles.coachCard} key={coach.userId}><Link className={styles.coachImageLink} href={`/coaches/${coach.slug}`}>{photoUrl ? <Image src={photoUrl} alt={`${coach.displayName} profile`} fill sizes="(max-width: 800px) 100vw, 33vw" unoptimized /> : <span className={styles.coachImagePlaceholder}>{coach.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>}<span className={styles.availablePill}>Available</span></Link><div className={styles.coachCardBody}><h2>{coach.displayName}</h2><div className={styles.chipRow}>{specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div><p>{coach.yearsExperience ?? 0} years · {coach.languages.join(", ")} · {coach.coachingModes.join(" & ")}</p><Link className={styles.primaryButton} href={`/coaches/${coach.slug}`}>View profile</Link></div></article>;
            })}</div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
