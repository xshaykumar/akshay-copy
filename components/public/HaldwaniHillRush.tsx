"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./HaldwaniHillRush.module.css";

const EVENT_DATE = new Date("2026-10-04T06:20:00+05:30").getTime();
const REGISTER_URL = "https://rzp.io/rzp/CFg0yaFX";

function getCountdown() {
  const difference = Math.max(0, EVENT_DATE - Date.now());

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

export default function HaldwaniHillRush() {
  const [time, setTime] = useState(getCountdown);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(getCountdown());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      className={styles.eventSection}
      aria-label="Haldwani Hill Rush Challenge"
    >
      <div className={styles.hero}>
        <div className={styles.overlay} />

        <div className={styles.content}>
          <p className={styles.present}>360 PERFORMANCE PRESENTS</p>

          <h2>HALDWANI</h2>
          <h3>HILL RUSH</h3>

          <p className={styles.challenge}>CHALLENGE 2026</p>
          <p className={styles.tagline}>
            RUN THE HILLS. OWN THE RUSH.
          </p>

          <div className={styles.infoGrid}>
            <div>
              <strong>4 OCTOBER 2026</strong>
              <span>SUNDAY</span>
            </div>

            <div>
              <strong>₹299</strong>
              <span>EARLY BIRD</span>
            </div>

            <div>
              <strong>HALDWANI → KATHGODAM</strong>
              <span>RUNNING CHALLENGE</span>
            </div>
          </div>

          <div className={styles.categories}>
            <div>
              <strong>15 KM</strong>
              <span>18–35 YEARS</span>
            </div>

            <div>
              <strong>8 KM</strong>
              <span>35+ YEARS</span>
            </div>

            <p>MALE &amp; FEMALE CATEGORIES</p>
          </div>

          <div className={styles.countdown}>
            <span>
              <b>{time.days}</b> DAYS
            </span>

            <span>
              <b>{String(time.hours).padStart(2, "0")}</b> HRS
            </span>

            <span>
              <b>{String(time.minutes).padStart(2, "0")}</b> MIN
            </span>

            <span>
              <b>{String(time.seconds).padStart(2, "0")}</b> SEC
            </span>
          </div>

          <Link href={REGISTER_URL} className={styles.register}>
            REGISTER NOW
          </Link>
        </div>
      </div>

      <div className={styles.partners}>
        <p>OUR PARTNERS &amp; SPONSORS</p>

        <div className={styles.marquee}>
          <div className={styles.track}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div className={styles.sponsor} key={index}>
                SPONSOR
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
