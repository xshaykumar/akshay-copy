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

    const updateCountdown = () => {
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

    updateCountdown();

    const timer = setInterval(updateCountdown, 1000);

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

        {/* LOGOS */}
        <div className={styles.logos}>
          <div className={styles.logoSpace}>LOGO</div>

          <div className={styles.logoDivider} />

          <div className={styles.logoSpace}>LOGO</div>
        </div>

        {/* MAIN CONTENT */}
        <div className={styles.content}>

          <p className={styles.kicker}>
            PRESENTS
          </p>

          <h1>HALDWANI</h1>

          <h2>HILL RUSH</h2>

          <div className={styles.challenge}>
            CHALLENGE 2026
          </div>

          {/* EVENT INFORMATION */}
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

          {/* VENUE */}
          <div className={styles.venue}>
            <strong>VENUE</strong>
            <span>HALDWANI STADIUM</span>
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

            <span>MEDICAL</span>
            <span>REFRESHMENTS</span>
            <span>FREE TANK TOP</span>
            <span>TIMED EVENT</span>
            <span>SECURE ROUTE</span>

          </div>

          {/* COUNTDOWN - ABOVE REGISTER BUTTON */}
          <div className={styles.countdownTitle}>
            EVENT STARTS IN
          </div>

          <div className={styles.countdown}>

            <div className={styles.countBox}>
              <strong>
                {String(timeLeft.days).padStart(2, "0")}
              </strong>
              <span>DAYS</span>
            </div>

            <div className={styles.countBox}>
              <strong>
                {String(timeLeft.hours).padStart(2, "0")}
              </strong>
              <span>HOURS</span>
            </div>

            <div className={styles.countBox}>
              <strong>
                {String(timeLeft.minutes).padStart(2, "0")}
              </strong>
              <span>MINUTES</span>
            </div>

            <div className={styles.countBox}>
              <strong>
                {String(timeLeft.seconds).padStart(2, "0")}
              </strong>
              <span>SECONDS</span>
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

      {/* ================= PARTNERS ================= */}

      <section className={styles.partners}>

        <p className={styles.partnerKicker}>
          TOGETHER FOR A STRONGER TOMORROW
        </p>

        <h3>OUR PARTNERS & SPONSORS</h3>

        <div className={styles.marquee}>
          <div className={styles.marqueeTrack}>

            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>
            <div className={styles.partnerLogo}>LOGO</div>

            {/* Duplicate set for seamless movement */}
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
