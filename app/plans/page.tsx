import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { PageHero, PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public.module.css";
import {
  publicPlanCurrency,
  publicPlanDurations,
  publicPlans,
  publicPlanTotal,
} from "@/lib/plans/public-catalog";
import { formatPlanDuration } from "@/lib/plans/duration";

export const metadata: Metadata = {
  title: "Coaching Plans & Pricing | 360 Performance",
  description:
    "Compare 360 Performance coaching plans for fixed 3, 6, and 12-month commitments.",
};

export default function PlansPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Plans & pricing"
        title="Choose the support that fits your goal."
        copy="Compare fixed 3, 6, and 12-month coaching plans: 90, 180, or 365 days."
        aside="Online, offline & specialist coaching"
      />
      <section className={styles.sectionMuted}>
        <div className={styles.sectionInner}>
          <div className={styles.landingPlanGrid}>
            {publicPlans.map((plan) => (
              <article
                className={styles.landingPlanCard}
                id={plan.slug}
                key={plan.slug}
              >
                <div className={styles.landingPlanHeading}>
                  <span>{plan.mode} coaching</span>
                  <h2>{plan.name}</h2>
                </div>
                <ul className={styles.landingPlanFeatures}>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <BadgeCheck
                        size={15}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.clientProvides ? (
                  <p className={styles.landingPlanNote}>
                    <strong>Client provides:</strong> {plan.clientProvides}.
                  </p>
                ) : null}
                <div className={styles.landingPlanDurations}>
                  {publicPlanDurations.map((durationDays) => (
                    <div className={styles.landingPlanPrice} key={durationDays}>
                      <span>{formatPlanDuration(durationDays)}</span>
                      <strong>
                        {publicPlanCurrency.format(
                          publicPlanTotal(plan, durationDays),
                        )}
                      </strong>
                      <small>
                        {plan.discounts[durationDays]}% saving included
                      </small>
                    </div>
                  ))}
                </div>
                <Link href="/register" className={styles.landingPlanCta}>
                  Get started <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
