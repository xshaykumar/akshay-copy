import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  ChartNoAxesCombined,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { BrandMark } from "./PublicShell";
import styles from "./public.module.css";

export function AuthFrame({
  eyebrow,
  title,
  copy,
  storyVariant = "default",
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  storyVariant?: "default" | "coach";
  children: React.ReactNode;
}) {
  return (
    <main className={styles.authPage}>
      <aside className={styles.authStory} data-variant={storyVariant}>
        <div className={styles.authStoryTop}>
          <BrandMark />
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to website
          </Link>
        </div>
        {storyVariant === "coach" ? (
          <div className={styles.authCoachStoryContent}>
            <span className={styles.authCoachLabel}>For coaches</span>
            <h2>Build your coaching career inside a professional ecosystem.</h2>
            <p>
              Create a verified profile, manage your availability, connect with
              committed clients, and deliver coaching through one trusted platform.
            </p>
            <div className={styles.authCoachBenefits}>
              <span>
                <BadgeCheck size={18} aria-hidden="true" /> Verified professional profile
              </span>
              <span>
                <UsersRound size={18} aria-hidden="true" /> Qualified client opportunities
              </span>
              <span>
                <ChartNoAxesCombined size={18} aria-hidden="true" /> Tools to manage your work
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.authStoryContent}>
              <span className={styles.authQuoteMark}>“</span>
              <blockquote>
                Great coaching is not a template. It is a relationship built on
                evidence, attention, and trust.
              </blockquote>
              <p>360 Performance coaching philosophy</p>
            </div>
            <div className={styles.authTrustRow}>
              <span>
                <BadgeCheck size={18} aria-hidden="true" /> Verified coaches
              </span>
              <span>
                <ShieldCheck size={18} aria-hidden="true" /> Secure platform
              </span>
            </div>
          </>
        )}
      </aside>
      <section className={styles.authFormPanel}>
        <div className={styles.authFormWrap}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p className={styles.authIntro}>{copy}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
