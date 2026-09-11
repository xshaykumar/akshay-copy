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

const REGISTRATION_CLOSES = new Date("2026-10-02T23:00:00+05:30").getTime();
const EVENT_STARTS = new Date("2026-10-04T06:00:00+05:30").getTime();

const PARTNERS = [
  { name: "360 Performance", src: "/360-fc-logo.png.jpeg" },
  { name: "FirstCry Intellitots", src: "/intellitots-logo.png" },
  { name: "Jonty's Pizzeria", src: "/jontys-pizzeria-logo.png" },
  { name: "People Places Purpose", src: "/people-places-purpose-logo.png" },
];

const CATEGORIES = [
  { label: "Kids", dist: "3 KM", tone: "tagKids" as const },
  { label: "Junior", dist: "7 KM", tone: "tagJunior" as const },
  { label: "Adults", dist: "15 KM", tone: "tagAdults" as const },
  { label: "Masters", dist: "7 KM", tone: "tagMasters" as const },
];

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(target: number): TimeLeft {
  const difference = target - Date.now();
  if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
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
  const [regTimeLeft, setRegTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [eventTimeLeft, setEventTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

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
    <section className={styles.eventSection} aria-label="Haldwani Hill Rush Challenge 2026">
      <div className={styles.hero}>
        <div className={styles.background} />
        <div className={styles.overlay} />

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
          <div className={styles.brushAccent} />

          <div className={styles.challenge}>CHALLENGE 2026</div>

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

          <div className={styles.venue}>
            <strong>VENUE</strong>
            <span>HALDWANI STADIUM</span>
            <small>Near Bus Station</small>
          </div>

          {/* CATEGORY TAGS — colored pills instead of boxy grid */}
          <div className={styles.categories}>
            {CATEGORIES.map((cat) => (
              <div key={cat.label} className={`${styles.categoryTag} ${styles[cat.tone]}`}>
                <span className={styles.dot} />
                {cat.label}
                <span className={styles.dist}>{cat.dist}</span>
              </div>
            ))}
          </div>

          <div className={styles.perks}>
            <div className={styles.perk}>
              <div className={styles.perkIcon}><HeartPulse size={22} strokeWidth={2.2} /></div>
              <div className={styles.perkText}>
                <strong>MEDICAL</strong>
                <span>MEDICAL SUPPORT</span>
              </div>
            </div>
            <div className={styles.perk}>
              <div className={styles.perkIcon}><CupSoda size={22} strokeWidth={2.2} /></div>
              <div className={styles.perkText}>
                <strong>REFRESHMENTS</strong>
                <span>ON ROUTE</span>
              </div>
            </div>
            <div className={styles.perk}>
              <div className={styles.perkIcon}><Shirt size={22} strokeWidth={2.2} /></div>
              <div className={styles.perkText}>
                <strong>TANK TOP</strong>
                <span>FOR PARTICIPANTS</span>
              </div>
            </div>
            <div className={styles.perk}>
              <div className={styles.perkIcon}><Timer size={22} strokeWidth={2.2} /></div>
              <div className={styles.perkText}>
                <strong>TIMED EVENT</strong>
                <span>ACCURATE TIMING</span>
              </div>
            </div>
            <div className={styles.perk}>
              <div className={styles.perkIcon}><ShieldCheck size={22} strokeWidth={2.2} /></div>
              <div className={styles.perkText}>
                <strong>SECURE ROUTE</strong>
                <span>ROUTE SUPPORT</span>
              </div>
            </div>
          </div>

          <div className={styles.countdownGroup}>
            <div className={styles.countdownBlock}>
              <div className={styles.countdownTitle}>REGISTRATION CLOSES — 2 OCT, 11:00 PM</div>
              <CountdownRow timeLeft={regTimeLeft} />
            </div>
            <div className={styles.countdownBlock}>
              <div className={styles.countdownTitle}>EVENT STARTS — 4 OCT, 6:00 AM</div>
              <CountdownRow timeLeft={eventTimeLeft} />
            </div>
          </div>

          <a href={REGISTER_URL} target="_blank" rel="noopener noreferrer" className={styles.registerButton}>
            REGISTER NOW
            <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
import styles from "./SponsorTicker.module.css";

type Logo = { name: string; src: string };

const DEFAULT_LOGOS: Logo[] = [
  { name: "360 Performance", src: "/360-fc-logo.png.jpeg" },
  { name: "FirstCry Intellitots", src: "/intellitots-logo.png" },
  { name: "Jonty's Pizzeria", src: "/jontys-pizzeria-logo.png" },
  { name: "People Places Purpose", src: "/people-places-purpose-logo.png" },
];

export default function SponsorTicker({ logos = DEFAULT_LOGOS }: { logos?: Logo[] }) {
  // Render the logo list twice back-to-back. The CSS animation
  // translates exactly -50% (half the track's total width), so
  // by the time the first copy has fully scrolled off, the second
  // copy is in the exact start position — no visible seam or jump.
  const track = [...logos, ...logos];

  return (
    <section className={styles.tickerSection} aria-label="Our partners and sponsors">
      <div className={styles.tickerViewport}>
        <div className={styles.tickerTrack}>
          {track.map((logo, i) => (
            <div className={styles.tickerLogo} key={`${logo.name}-${i}`}>
              <img src={logo.src} alt={logo.name} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
