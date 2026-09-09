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
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      });
    };

    update();

    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className={styles.eventSection}>
      <div className={styles.hero}>
        <div className={styles.background} />
        <div className={styles.overlay} />

        {/* FOUR PARTNER LOGOS */}
        <div className={styles.topPartners}>
          <div className={styles.topPartner}>LOGO</div>
          <div className={styles.topPartner}>LOGO</div>
          <div className={styles.topPartner}>LOGO</div>
          <div className={styles.topPartner}>LOGO</div>
        </div>

        <div className={styles.content}>
          <div className={styles.kicker}>PRESENTS</div>

          <h1>HALDWANI</h1>
          <h2>HILL RUSH</h2>

          <div className={styles.challenge}>
            CHALLENGE 2026
          </div>

          <div className={styles.mainInfo}>
            <div>
              <strong>4 OCTOBER 2026</strong>
              <span>SUNDAY</span>
            </div>

            <div>
              <strong>₹199</strong>
              <span>REGISTRATION</span>
            </div>

            <div>
              <strong>HALDWANI → KATHGODAM</strong>
              <span>AND BACK</span>
            </div>
          </div>

          <div className={styles.venue}>
            <strong>VENUE</strong>
            <span>HALDWANI STADIUM</span>
            <small>Near Bus Station</small>
          </div>

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

          <div className={styles.perks}>
            <span>MEDICAL</span>
            <span>REFRESHMENTS</span>
            <span>FREE TANK TOP</span>
            <span>TIMED EVENT</span>
            <span>SECURE ROUTE</span>
          </div>

          <div className={styles.countdownTitle}>
            EVENT STARTS IN
          </div>

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

          <a
            href={REGISTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.registerButton}
          >
            REGISTER NOW <span>→</span>
          </a>
        </div>
      </div>

      {/* PARTNERS & SPONSORS */}
      <section className={styles.partners}>
        <p>OUR PARTNERS & SPONSORS</p>

        <div className={styles.marquee}>
          <div className={styles.marqueeTrack}>
            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>

            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>
          </div>
        </div>
      </section>
    </section>
  );
}
