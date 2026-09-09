"use client";

import styles from "./HaldwaniHillRush.module.css";

const REGISTER_URL = "https://rzp.io/rzp/CFg0yaFX";

export default function HaldwaniHillRush() {
  return (
    <section
      className={styles.eventSection}
      aria-label="Haldwani Hill Rush Challenge 2026"
    >
      <div className={styles.hero}>

        {/* Background */}
        <div className={styles.background} />

        {/* Dark overlay */}
        <div className={styles.overlay} />

        {/* Top logos */}
        <div className={styles.logos}>
          <div className={styles.logoSpace}>
            LOGO
          </div>

          <div className={styles.logoDivider} />

          <div className={styles.logoSpace}>
            LOGO
          </div>
        </div>

        {/* Main content */}
        <div className={styles.content}>

          <p className={styles.kicker}>
            PRESENTS
          </p>

          <h1>
            HALDWANI
          </h1>

          <h2>
            HILL RUSH
          </h2>

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

          {/* Categories */}
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

          {/* Event perks */}
          <div className={styles.perks}>

            <span>MEDICAL</span>
            <span>REFRESHMENTS</span>
            <span>FREE TANK TOP</span>
            <span>TIMED EVENT</span>
            <span>SECURE ROUTE</span>

          </div>

          {/* Register */}
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

      {/* Partners */}
      <div className={styles.partners}>
        <h3>OUR PARTNERS & SPONSORS</h3>

        <div className={styles.partnerLogos}>
          <div>LOGO</div>
          <div>LOGO</div>
          <div>LOGO</div>
          <div>LOGO</div>
        </div>
      </div>
    </section>
  );
}
