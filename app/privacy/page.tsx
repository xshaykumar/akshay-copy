import type { Metadata } from "next";
import { PageHero, PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | 360 Performance",
};

const sections = [
  {
    id: "information",
    title: "Information we collect",
    body: "We may collect account details, contact information, coaching preferences, health and fitness assessment responses, plan and session activity, and communications required to provide the platform experience.",
  },
  {
    id: "use",
    title: "How information is used",
    body: "Information is used to operate accounts, match clients with eligible coaches, personalize coaching, manage sessions, communicate service updates, maintain platform safety, and improve the experience.",
  },
  {
    id: "coach-access",
    title: "Coach access",
    body: "An assigned coach may access the client information reasonably required to deliver the purchased coaching service. Access is limited by the active coaching relationship and platform permissions.",
  },
  {
    id: "storage",
    title: "Storage and security",
    body: "We use reasonable administrative and technical safeguards to protect personal information. No digital system can guarantee absolute security, and users should protect their account credentials.",
  },
  {
    id: "rights",
    title: "Your choices",
    body: "Users may update editable profile information, notification preferences, and coaching availability from their account. Certain identity, transaction, and compliance records may be retained as required for legitimate business or legal purposes.",
  },
  {
    id: "contact",
    title: "Contact us",
    body: "For privacy questions, contact support@360performance.in or write to 360 Performance, Rampur Road, Haldwani, Uttarakhand 263139, India.",
  },
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Legal information"
        title="Privacy, explained clearly."
        copy="This policy outlines how 360 Performance handles account, coaching, and health-related information across the platform."
        aside="Last updated July 2026"
      />
      <section className={styles.section}>
        <div className={`${styles.sectionInner} ${styles.legalLayout}`}>
          <nav className={styles.legalNav} aria-label="Privacy policy sections">
            <strong>On this page</strong>
            {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
          </nav>
          <div className={styles.legalContent}>
            <div className={styles.legalCallout}>
              <p>Please review this policy to understand how platform information is collected, used, and protected.</p>
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
