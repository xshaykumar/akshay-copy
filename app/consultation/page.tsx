import type { Metadata } from "next";
import { Check, MessageCircle } from "lucide-react";
import { ConsultationForm } from "@/components/public/ConsultationForm";
import { PageHero, PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public.module.css";

export const metadata: Metadata = {
  title: "Book a Consultation | 360 Performance",
  description:
    "Book a free coaching consultation before choosing a 360 Performance plan.",
};

export default function ConsultationPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Start with a conversation"
        title="Not sure where to begin? Let’s make it clear."
        copy="A focused consultation helps you clarify your goal, understand the right coaching format, and move forward with confidence before purchasing a plan."
        aside="Your consultation is completely free"
      />
      <section className={styles.sectionMuted}>
        <div className={styles.sectionInner}>
          <div className={styles.consultGrid}>
            <div className={styles.consultStory}>
              <span className={styles.sectionLabel}>Your consultation</span>
              <h2>Thirty minutes of focused direction.</h2>
              <p>
                Share what you want to change, what has held you back, and what
                kind of support feels realistic. This is not a sales script—it is
                a practical first step toward the right plan and coach. After
                submitting your details, one of our mentors will contact you on
                your mobile number.
              </p>
              <div className={styles.consultPrice}>
                <div>
                  <strong>Free</strong>
                  <span>No consultation fee</span>
                </div>
                <MessageCircle size={30} strokeWidth={1.4} aria-hidden="true" />
              </div>
              <ul className={styles.consultBenefits}>
                <li><Check size={16} aria-hidden="true" /> Discuss your goals and current challenges</li>
                <li><Check size={16} aria-hidden="true" /> Understand online and offline options</li>
                <li><Check size={16} aria-hidden="true" /> Get guidance on the right plan level</li>
                <li><Check size={16} aria-hidden="true" /> Receive call details directly from your mentor</li>
              </ul>
            </div>

            <ConsultationForm />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
