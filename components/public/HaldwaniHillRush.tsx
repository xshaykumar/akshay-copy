"use client";

import { useEffect, useState } from "react";
import {
  HeartPulse,
  CupSoda,
  Shirt,
  Timer,
  ShieldCheck,
} from "lucide-react";
import styles from "./HaldwaniHillRush.module.css";

const REGISTER_URL = "https://rzp.io/rzp/CFg0yaFX";

// Two separate targets: registration closing, and the event itself
const REGISTRATION_CLOSES = new Date("2026-10-02T23:00:00+05:30").getTime();
const EVENT_STARTS = new Date("2026-10-04T06:00:00+05:30").getTime();

const PARTNERS = [
  { name: "360 Performance", src: "/360-fc-logo.png.jpeg" },
  { name: "FirstCry Intellitots", src: "/intellitots-logo.png" },
  { name: "Jonty's Pizzeria", src: "/jontys-pizzeria-logo.png" },
  { name: "People Places Purpose", src: "/people-places-purpose-logo.png" },
];

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getTimeLeft(target: number): TimeLeft {
  const difference = target - Date.now();

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

function CountdownRow({ timeLeft }: { timeLeft: TimeLeft }) {
  return (
    <div className={styles.countdown}>
      <div className={styles.countBox}>
        <strong>{String(timeLeft.days).padStart(2, "0")}</strong>
        <span>DAYS</span>
      </div>
      <div className={styles.countBox}>
        <strong>{String(timeLeft.hours).padStart(2, "0")}</strong>
        <span>HOURS</span>
      </div>
      <div className={styles.countBox}>
        <strong>{String(timeLeft.minutes).padStart(2, "0")}</strong>
        <span>MINUTES</span>
      </div>
      <div className={styles.countBox}>
        <strong>{String(timeLeft.seconds).padStart(2, "0")}</strong>
        <span>SECONDS</span>
      </div>
    </div>
  );
}

export default function HaldwaniHillRush() {
  const [regTimeLeft, setRegTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [eventTimeLeft, setEventTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const update = () => {
      setRegTimeLeft(getTimeLeft(REGISTRATION_CLOSES));
      setEventTimeLeft(getTimeLeft(EVENT_STARTS));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      className={styles.eventSection}
      aria-label="Haldwani Hill Rush Challenge 2026"
    >
      {/* ================= HERO ================= */}

      <div className={styles.hero}>
        <div className={styles.background} />
        <div className={styles.overlay} />

        {/* TOP PARTNER STRIP */}
        <div className={styles.topPartners}>
          {PARTNERS.map((partner) => (
            <div className={styles.topPartner} key={partner.name}>
              <img src={partner.src} alt={partner.name} loading="eager" />
            </div>
          ))}
        </div>

        <div className={styles.content}>
          <p className={styles.kicker}>PRESENTS</p>

          <h1>HALDWANI</h1>

          <h2>HILL RUSH</h2>

          <div className={styles.challenge}>CHALLENGE 2026</div>

          {/* EVENT INFORMATION */}
          <div className={styles.mainInfo}>
            <div className={styles.infoItem}>
              <strong>4 OCTOBER 2026</strong>
              <span>SUNDAY • 6:00 AM</span>
            </div>

            <div className={styles.infoItem}>
              <strong>₹199</strong>
              <span>REGISTRATION</span>
            </div>

            <div className={styles.infoItem}>
              <strong>HALDWANI → KATHGODAM</strong>
              <span>AND BACK</span>
            </div>
          </div>

          {/* VENUE */}
          <div className={styles.venue}>
            <strong>VENUE</strong>
            <span>HALDWANI STADIUM</span>
            <small>Near Bus Station</small>
          </div>

          {/* EVENT FEATURES / PERKS */}
          <div className={styles.perks}>
            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <HeartPulse size={22} strokeWidth={2.2} />
              </div>
              <div className={styles.perkText}>
                <strong>MEDICAL</strong>
                <span>MEDICAL SUPPORT</span>
              </div>
            </div>

            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <CupSoda size={22} strokeWidth={2.2} />
              </div>
              <div className={styles.perkText}>
                <strong>REFRESHMENTS</strong>
                <span>ON ROUTE</span>
              </div>
            </div>

            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <Shirt size={22} strokeWidth={2.2} />
              </div>
              <div className={styles.perkText}>
                <strong>FREE TANK TOP</strong>
                <span>FOR PARTICIPANTS</span>
              </div>
            </div>

            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <Timer size={22} strokeWidth={2.2} />
              </div>
              <div className={styles.perkText}>
                <strong>TIMED EVENT</strong>
                <span>ACCURATE TIMING</span>
              </div>
            </div>

            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <ShieldCheck size={22} strokeWidth={2.2} />
              </div>
              <div className={styles.perkText}>
                <strong>SECURE ROUTE</strong>
                <span>ROUTE SUPPORT</span>
              </div>
            </div>
          </div>

          {/* DUAL COUNTDOWN: registration close + event start */}
          <div className={styles.countdownGroup}>
            <div className={styles.countdownBlock}>
              <div className={styles.countdownTitle}>
                REGISTRATION CLOSES — 2 OCT, 11:00 PM
              </div>
              <CountdownRow timeLeft={regTimeLeft} />
            </div>

            <div className={styles.countdownBlock}>
              <div className={styles.countdownTitle}>
                EVENT STARTS — 4 OCT, 6:00 AM
              </div>
              <CountdownRow timeLeft={eventTimeLeft} />
            </div>
          </div>

          {/* REGISTER */}
          <a
            href={REGISTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.registerButton}
          >
            REGISTER NOW
            <span>→</span>
          </a>
        </div>
      </div>

      {/* ================= PARTNERS / SPONSORS ================= */}

      <section className={styles.partners}>
        <div className={styles.partnerLine} />

        <p className={styles.partnerKicker}>
          TOGETHER FOR A STRONGER TOMORROW
        </p>

        <h3>OUR PARTNERS & SPONSORS</h3>

        <div className={styles.marquee}>
          <div className={styles.marqueeTrack}>
            {[...PARTNERS, ...PARTNERS].map((partner, i) => (
              <div className={styles.partnerLogo} key={`${partner.name}-${i}`}>
                <img src={partner.src} alt={partner.name} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
