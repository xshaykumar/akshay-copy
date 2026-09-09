"use client";

import { useEffect, useState } from "react";
import styles from "./HaldwaniHillRush.module.css";

const REGISTER_URL = "https://rzp.io/rzp/CFg0yaFX";

export default function HaldwaniHillRush() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const target = new Date("2026-10-04T06:20:00+05:30").getTime();

    const update = () => {
      const difference = target - Date.now();

      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        });
        return;
      }

      setTimeLeft({
        days: Math.floor(
          difference / (1000 * 60 * 60 * 24)
        ),
        hours: Math.floor(
          (difference / (1000 * 60 * 60)) % 24
        ),
        minutes: Math.floor(
          (difference / (1000 * 60)) % 60
        ),
        seconds: Math.floor(
          (difference / 1000) % 60
        ),
      });
    };

    update();

    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className={styles.eventSection}>

      {/* =================================
          HERO
      ================================= */}

      <div className={styles.hero}>

        {/* CSS ONLY BACKGROUND */}
        <div className={styles.background} />

        {/* DARK OVERLAY */}
        <div className={styles.overlay} />

        {/* =================================
            TOP 4 PARTNERS
        ================================= */}

        <div className={styles.topPartners}>

          <div className={styles.topPartner}>
            <span>LOGO</span>
          </div>

          <div className={styles.topPartner}>
            <span>LOGO</span>
          </div>

          <div className={styles.topPartner}>
            <span>LOGO</span>
          </div>

          <div className={styles.topPartner}>
            <span>LOGO</span>
          </div>

        </div>

        {/* =================================
            MAIN CONTENT
        ================================= */}

        <div className={styles.content}>

          <div className={styles.presents}>
            PRESENTS
          </div>

          <h1>HALDWANI</h1>

          <h2>HILL RUSH</h2>

          <div className={styles.challenge}>
            CHALLENGE 2026
          </div>

          {/* EVENT DETAILS */}

          <div className={styles.eventDetails}>

            <div className={styles.detail}>
              <strong>4 OCTOBER 2026</strong>
              <small>SUNDAY</small>
            </div>

            <div className={styles.detail}>
              <strong>₹199</strong>
              <small>REGISTRATION</small>
            </div>

            <div className={styles.detail}>
              <strong>HALDWANI → KATHGODAM</strong>
              <small>AND BACK</small>
            </div>

          </div>

          {/* VENUE */}

          <div className={styles.venue}>
            <span>VENUE</span>
            <strong>HALDWANI STADIUM</strong>
            <small>Near Bus Station</small>
          </div>

          {/* CATEGORIES */}

          <div className={styles.categories}>

            <div className={styles.category}>
              <strong>3 KM</strong>
              <span>KIDS</span>
            </div>

            <div className={styles.category}>
              <strong>15 KM</strong>
              <span>JUNIOR & ADULT</span>
            </div>

            <div className={styles.category}>
              <strong>7 KM</strong>
              <span>35+ YEARS</span>
            </div>

          </div>

          {/* EVENT PERKS */}

          <div className={styles.perks}>

            <div>
              <strong>✚</strong>
              <span>MEDICAL</span>
            </div>

            <div>
              <strong>♢</strong>
              <span>REFRESHMENTS</span>
            </div>

            <div>
              <strong>♙</strong>
              <span>FREE TANK TOP</span>
            </div>

            <div>
              <strong>◷</strong>
              <span>TIMED EVENT</span>
            </div>

            <div>
              <strong>◇</strong>
              <span>SECURE ROUTE</span>
            </div>

          </div>

          {/* COUNTDOWN */}

          <div className={styles.countdownTitle}>
            REGISTRATION IS OPEN
          </div>

          <div className={styles.countdown}>

            <div>
              <strong>
                {String(timeLeft.days).padStart(2, "0")}
              </strong>
              <span>DAYS</span>
            </div>

            <div>
              <strong>
                {String(timeLeft.hours).padStart(2, "0")}
              </strong>
              <span>HOURS</span>
            </div>

            <div>
              <strong>
                {String(timeLeft.minutes).padStart(2, "0")}
              </strong>
              <span>MINUTES</span>
            </div>

            <div>
              <strong>
                {String(timeLeft.seconds).padStart(2, "0")}
              </strong>
              <span>SECONDS</span>
            </div>

          </div>

          {/* REGISTER BUTTON */}

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

      {/* =================================
          PARTNERS & SPONSORS
      ================================= */}

      <section className={styles.partners}>

        <p>OUR PARTNERS & SPONSORS</p>

        <div className={styles.marquee}>

          <div className={styles.marqueeTrack}>

            <div className={styles.partnerLogo}>
              LOGO
            </div>

            <div className={styles.partnerLogo}>
              LOGO
            </div>

            <div className={styles.partnerLogo}>
              LOGO
            </div>

            <div className={styles.partnerLogo}>
              LOGO
            </div>

            <div className={styles.partnerLogo}>
              LOGO
            </div>

            <div className={styles.partnerLogo}>
              LOGO
            </div>

            <div className={styles.partnerLogo}>
              LOGO
            </div>

            <div className={styles.partnerLogo}>
              LOGO
            </div>

          </div>

        </div>

      </section>

    </section>
  );
}
