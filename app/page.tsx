import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  Apple,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ClipboardCheck,
  Dumbbell,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public.module.css";
import founderImage from "@/founder.png";

export const metadata: Metadata = {
  title: "360 Performance | Strength, Rehabilitation & Performance Coaching",
  description:
    "India's premium strength, rehabilitation and performance coaching platform connecting clients with highly qualified coaches.",
};

type Feature = {
  title: string;
  copy: string;
  icon: LucideIcon;
};

const reasons: Feature[] = [
  {
    title: "Evidence-based coaching",
    copy: "Training decisions are shaped by proven principles, movement quality, and real progress—not trends.",
    icon: Activity,
  },
  {
    title: "Certified professionals only",
    copy: "Coach identities, qualifications, and specialist eligibility are reviewed before profiles go live.",
    icon: BadgeCheck,
  },
  {
    title: "Personalized workouts",
    copy: "Programming adapts to your goals, experience, movement ability, schedule, and recovery needs.",
    icon: Dumbbell,
  },
  {
    title: "Personalized nutrition",
    copy: "Practical nutrition guidance is designed around your lifestyle, preferences, and training demands.",
    icon: Apple,
  },
  {
    title: "Weekly progress tracking",
    copy: "Regular check-ins keep the plan accountable, measurable, and responsive to your progress.",
    icon: ClipboardCheck,
  },
  {
    title: "Live coaching sessions",
    copy: "Train with direct feedback, technique review, and meaningful contact with your assigned coach.",
    icon: Video,
  },
  {
    title: "Performance analytics",
    copy: "Clear performance signals help your coach make better adjustments at the right time.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Online & offline coaching",
    copy: "Choose remote flexibility or work with an eligible nearby coach for in-person training.",
    icon: MapPin,
  },
  {
    title: "Athlete development",
    copy: "Specialist coaches support strength, conditioning, recovery, and competition preparation.",
    icon: Trophy,
  },
  {
    title: "Rehabilitation & correction",
    copy: "Move with greater confidence through thoughtful rehabilitation and corrective exercise support.",
    icon: HeartPulse,
  },
];

const landingServices: Array<Feature & { number: string }> = [
  {
    number: "01",
    title: "Online Coaching",
    copy: "Personalized training, nutrition guidance, live sessions, technique feedback, and progress reviews from anywhere.",
    icon: Video,
  },
  {
    number: "02",
    title: "Offline Personal Training",
    copy: "One-to-one gym or home coaching with nearby qualified professionals and hands-on performance support.",
    icon: MapPin,
  },
  {
    number: "03",
    title: "Group Coaching",
    copy: "Structured live sessions, community accountability, nutrition guidance, and shared momentum.",
    icon: UsersRound,
  },
  {
    number: "04",
    title: "Athlete Performance",
    copy: "Strength, conditioning, recovery, analysis, and competition preparation for serious athletic goals.",
    icon: Trophy,
  },
  {
    number: "05",
    title: "Executive Coaching",
    copy: "High-touch performance and lifestyle support built around demanding schedules and ambitious outcomes.",
    icon: BriefcaseBusiness,
  },
  {
    number: "06",
    title: "Rehabilitation",
    copy: "Progressive corrective exercise and mobility support designed around injury history and movement limitations.",
    icon: HeartPulse,
  },
  {
    number: "07",
    title: "Sports Nutrition",
    copy: "Personalized nutrition strategies that support performance, recovery, body composition, and consistency.",
    icon: Apple,
  },
];

const process = [
  {
    title: "Choose your plan",
    copy: "Select a fixed 3, 6, or 12-month online, offline, group, or performance coaching plan.",
  },
  {
    title: "Share your goals",
    copy: "Complete your fitness and health profile so your coaching experience starts with useful context.",
  },
  {
    title: "Choose your coach",
    copy: "Compare active verified professionals and select your preferred coach within the 24-hour window.",
  },
  {
    title: "Begin your program",
    copy: "Your subscription begins when your coach is assigned, with planning, sessions, and progress in one place.",
  },
];

export default function Home() {
  return (
    <PublicShell>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.heroKicker}>
              Elite hybrid fitness platform
            </span>
            <h1 className={styles.display}>
              <span>Redefine</span>
              <span className={styles.rotatingWords} aria-hidden="true">
                <span className={styles.rotatingWord}>Recovery</span>
                <span className={styles.rotatingWord}>Strength</span>
                <span className={styles.rotatingWord}>Performance</span>
              </span>
              <span className="sr-only">
                Recovery, strength and performance
              </span>
            </h1>
            <p className={styles.heroLead}>
              Personalized coaching for fat loss, muscle gain, strength,
              rehabilitation and performance. Delivered by expert coaches.
              Built on science.
            </p>
            <div className={styles.heroActions}>
              <Link href="/register" className={styles.primaryButton}>
                Start your journey <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.heroProof} aria-label="Platform standards">
              <span>
                <BadgeCheck size={17} aria-hidden="true" /> Certified coaches
              </span>
              <span>
                <Activity size={17} aria-hidden="true" /> Evidence-based
              </span>
              <span>
                <ShieldCheck size={17} aria-hidden="true" /> Secure &amp; safe
              </span>
            </div>
          </div>
        </div>
      </section>

         {/* HALDWANI HILL RUSH CHALLENGE 2026 */}

<section className={styles.hillRushSection}>
  <div className={styles.hillRushPoster}>

    <picture>
      <source
        media="(min-width: 769px)"
        srcSet="/hill-rush-desktop.jpg"
      />

      <img
        src="/hill-rush-mobile.jpg"
        alt="Haldwani Hill Rush Challenge 2026"
        className={styles.hillRushImage}
      />
    </picture>

    <a
      href="https://docs.google.com/forms/d/e/1FAIpQLSe-_qJQvzlcwW4WNSwvnWrUKW9aHDUW76nMMPLBAtm78jS5YA/viewform?usp=header"
      target="_blank"
      rel="noopener noreferrer"
      className={styles.hillRushRegister}
    >
      REGISTER NOW
    </a>

  </div>
</section>   
      <section className={styles.darkSection}>
        <div className={styles.sectionInner}>
          <div className={styles.premiumGrid}>
            <div className={styles.premiumCopy}>
              <span className={styles.sectionLabel}>
                Athlete / Executive Performance
              </span>
              <h2 className={styles.sectionTitle}>
                Specialist coaching for goals where <em>ordinary is not enough.</em>
              </h2>
              <p>
                A dedicated performance relationship for athletes and executives
                who need intelligent programming, flexible daily support,
                recovery planning, and uncompromising professional standards.
              </p>
              <div className={styles.premiumFeatureGrid}>
                <span>
                  <Target size={17} aria-hidden="true" /> Performance analysis
                </span>
                <span>
                  <Video size={17} aria-hidden="true" /> Flexible live coaching
                </span>
                <span>
                  <HeartPulse size={17} aria-hidden="true" /> Recovery planning
                </span>
                <span>
                  <Sparkles size={17} aria-hidden="true" /> Lifestyle management
                </span>
              </div>
              <Link href="/register" className={styles.darkButton}>
                Register now <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.premiumVisual}>
              <Image
                src="/athlete-executive.jpg"
                alt="Athlete building power with battle ropes"
                fill
                sizes="(max-width: 900px) calc(100vw - 40px), 48vw"
              />
              <div className={styles.premiumVisualCard}>
                <span>Specialist-only category</span>
                <strong>Credentials before status.</strong>
                <p>
                  Only appropriately qualified and verified performance,
                  sports-science, and physiotherapy professionals are eligible.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.sectionMuted}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.sectionLabel}>How it works</span>
              <h2 className={styles.sectionTitle}>
                A clear path from plan to <em>progress.</em>
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Choose your level of support, share the context that matters, and
              begin with one dedicated coach in a structured professional environment.
            </p>
          </div>
          <div className={styles.processGrid}>
            {process.map((step, index) => (
              <article className={styles.processStep} key={step.title}>
                <span className={styles.processStepNumber}>0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.coachGateway}>
            <div className={styles.coachGatewayCopy}>
              <span className={styles.sectionLabel}>Verified expertise</span>
              <h2 className={styles.sectionTitle}>
                The right expertise for the <em>right goal.</em>
              </h2>
              <p>
                After signing in, compare active coaches by qualifications,
                specialization, language, rating, location, and availability.
                Every client works with one dedicated coach per plan.
              </p>
              <Link href="/login?next=/coaches" className={styles.primaryButton}>
                Sign in to browse coaches <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.coachGatewayList}>
              <article>
                <Dumbbell size={21} aria-hidden="true" />
                <div>
                  <span>Strength & conditioning</span>
                  <small>Body composition · General fitness · Strength</small>
                </div>
              </article>
              <article>
                <HeartPulse size={21} aria-hidden="true" />
                <div>
                  <span>Rehabilitation & corrective exercise</span>
                  <small>Movement quality · Mobility · Injury support</small>
                </div>
              </article>
              <article>
                <Trophy size={21} aria-hidden="true" />
                <div>
                  <span>Athlete & executive performance</span>
                  <small>Restricted to appropriately qualified specialists</small>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner}>
          <h2>
            Your next level starts with the <em>right coach.</em>
          </h2>
          <div className={styles.finalCtaActions}>
            <Link href="/register" className={styles.smallCta}>
              Get started <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/consultation" className={styles.outlineButton}>
              Book free consultation
            </Link>
          </div>
        </div>
      </section>

    </PublicShell>
  );
}
