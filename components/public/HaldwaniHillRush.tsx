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

        {/* REAL PHOTO BACKGROUND */}
        <div className={styles.photoBackground} />

        {/* DARK OVERLAY FOR TEXT READABILITY */}
        <div className={styles.overlay} />

        {/* PARTNER LOGOS */}
        <div className={styles.partnerLogo}>
          <img
            src="/360-fc-logo.png"
            alt="360 Performance and Firstcry IntelliTots"
          />
        </div>

        {/* MAIN CONTENT */}
        <div className={styles.content}>

          <p className={styles.present}>
            360 PERFORMANCE PRESENTS
          </p>

          <h1>HALDWANI</h1>

          <h2>HILL RUSH</h2>

          <p className={styles.challenge}>
            CHALLENGE 2026
          </p>

          <p className={styles.tagline}>
            RUN THE HILLS. OWN THE RUSH.
          </p>

          <div className={styles.infoGrid}>

            <div>
              <strong>4 OCTOBER 2026</strong>
              <span>SUNDAY • 6:20 AM</span>
            </div>

            <div>
              <strong>₹299</strong>
              <span>EARLY BIRD • REGULAR ₹499</span>
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

            <p>
              MALE & FEMALE CATEGORIES
            </p>

          </div>

          <div
            className={styles.countdown}
            aria-label="Event countdown"
          >

            <div>
              <strong>{time.days}</strong>
              <span>DAYS</span>
            </div>

            <div>
              <strong>
                {String(time.hours).padStart(2, "0")}
              </strong>
              <span>HRS</span>
            </div>

            <div>
              <strong>
                {String(time.minutes).padStart(2, "0")}
              </strong>
              <span>MIN</span>
            </div>

            <div>
              <strong>
                {String(time.seconds).padStart(2, "0")}
              </strong>
              <span>SEC</span>
            </div>

          </div>

          <Link
            href={REGISTER_URL}
            className={styles.registerButton}
          >
            REGISTER NOW
            <span>→</span>
          </Link>

        </div>
      </div>

      {/* SPONSORS */}
      <div className={styles.sponsorSection}>

        <h2>OUR PARTNERS & SPONSORS</h2>

        <div className={styles.marquee}>
          <div className={styles.marqueeTrack}>

            {Array.from({ length: 8 }).map((_, index) => (
              <div
                className={styles.sponsorCard}
                key={index}
              >
                SPONSOR / PARTNER
              </div>
            ))}

          </div>
        </div>

      </div>
    </section>
  );
}
