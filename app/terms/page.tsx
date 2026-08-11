import type { Metadata } from "next";
import { PageHero, PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public.module.css";

export const metadata: Metadata = {
  title: "Terms of Service | 360 Performance",
};

const sections = [
  {
    id: "accounts",
    title: "Platform accounts",
    body: "Users register as either a client or a coach and are responsible for accurate details and secure credentials. Suspended or banned accounts may not access the platform.",
  },
  {
    id: "coaching",
    title: "Coaching services",
    body: "360 Performance facilitates coaching services delivered by approved coaches. Clients must provide accurate health and injury information and seek qualified medical advice where appropriate before starting exercise.",
  },
  {
    id: "plans",
    title: "Plans and activation",
    body: "Client plans are purchased upfront for fixed 3, 6, or 12-month periods lasting 90, 180, or 365 days. Service is organized into 30-day cycles, with the final annual cycle covering the remaining five days.",
  },
  {
    id: "switching",
    title: "Coach switching",
    body: "A coach remains responsible for the full active 30-day cycle. A switch accepted by the selected coach takes effect only when the next service cycle begins; rejected and expired requests do not change the assignment.",
  },
  {
    id: "refunds",
    title: "Refund requests",
    body: "Refunds are not automatic. If no coach is assigned during the initial 24-hour selection window and the following six-day coach pool, the client may submit a full-refund request from My plan. The request stops the related coach-matching process and is reviewed and processed manually by the administrator.",
  },
  {
    id: "payments",
    title: "Platform fee and coach compensation",
    body: "360 Performance retains a platform fee equal to twenty percent of eligible coaching revenue. The remaining eighty percent forms the basis for coach compensation, subject to applicable taxes and the governing coach arrangement. Coach compensation is handled manually outside the website; the platform does not initiate automatic payouts or transfers to coaches.",
  },
  {
    id: "conduct",
    title: "Platform conduct",
    body: "Off-platform transactions, harassment, misuse of private information, misrepresentation of qualifications, and attempts to bypass platform safeguards are prohibited.",
  },
  {
    id: "medical",
    title: "Health disclaimer",
    body: "Fitness and nutrition coaching does not replace diagnosis or treatment from a licensed medical professional. Users experiencing pain, illness, or a significant health change should seek appropriate care and inform their coach.",
  },
];

export default function TermsPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Platform agreement"
        title="Clear expectations. Better coaching."
        copy="These terms summarize the standards that help clients, coaches, and the platform work together with clarity and trust."
        aside="Last updated July 2026"
      />
      <section className={styles.section}>
        <div className={`${styles.sectionInner} ${styles.legalLayout}`}>
          <nav className={styles.legalNav} aria-label="Terms of service sections">
            <strong>On this page</strong>
            {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
          </nav>
          <div className={styles.legalContent}>
            <div className={styles.legalCallout}>
              <p>Please read these terms before creating an account or purchasing a coaching plan.</p>
            </div>
            {sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
