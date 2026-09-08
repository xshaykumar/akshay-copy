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

function HillRushArtwork() {
  return (
    <svg
      className={styles.artwork}
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fb8cc" />
          <stop offset="55%" stopColor="#dce7e4" />
          <stop offset="100%" stopColor="#f1c47d" />
        </linearGradient>

        <linearGradient id="mountain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60777d" />
          <stop offset="100%" stopColor="#182c30" />
        </linearGradient>

        <linearGradient id="road" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#30383a" />
          <stop offset="100%" stopColor="#101719" />
        </linearGradient>

        <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff5bf" />
          <stop offset="100%" stopColor="#d99b38" />
        </linearGradient>

        <filter id="glow">
          <feGaussianBlur stdDeviation="35" />
        </filter>
      </defs>

      {/* SKY */}
      <rect width="1600" height="900" fill="url(#sky)" />

      {/* SUN */}
      <circle
        cx="1260"
        cy="180"
        r="130"
        fill="#fff1bd"
        opacity="0.4"
        filter="url(#glow)"
      />

      <circle
        cx="1260"
        cy="180"
        r="62"
        fill="#fff8d7"
        opacity="0.9"
      />

      {/* DISTANT MOUNTAINS */}
      <path
        d="M0 500 L260 230 L390 370 L610 110 L820 365 L1045 160 L1330 420 L1600 230 L1600 610 L0 610Z"
        fill="#82969a"
        opacity="0.7"
      />

      {/* MAIN MOUNTAINS */}
      <path
        d="M0 570 L300 260 L470 460 L685 175 L900 455 L1115 210 L1390 480 L1600 295 L1600 670 L0 670Z"
        fill="url(#mountain)"
      />

      {/* SNOW CAPS */}
      <path
        d="M610 185 L685 175 L650 240 L610 270 L575 235Z"
        fill="#f5f8f6"
      />

      <path
        d="M1045 160 L1115 210 L1070 245 L1020 215Z"
        fill="#f5f8f6"
      />

      <path
        d="M300 260 L350 315 L315 350 L275 330Z"
        fill="#edf4f3"
      />

      {/* FOREST */}
      <path
        d="M0 585 Q250 535 475 600 T900 580 T1250 610 T1600 555 L1600 900 L0 900Z"
        fill="#29453c"
      />

      <path
        d="M0 650 Q330 580 610 650 T1120 625 T1600 600 L1600 900 L0 900Z"
        fill="#19362f"
      />

      {/* ROAD */}
      <path
        d="M0 900 C270 765 440 730 700 725 C980 720 1250 775 1600 650 L1600 900Z"
        fill="url(#road)"
      />

      {/* ROAD MARKING */}
      <path
        d="M805 900 C810 830 825 775 845 730"
        stroke="#e9c86b"
        strokeWidth="7"
        strokeDasharray="34 28"
        fill="none"
      />

      {/* TREES */}
      <g fill="#12372f">
        <path d="M100 680 L145 555 L190 680Z" />
        <path d="M160 680 L205 540 L250 680Z" />
        <path d="M1380 660 L1425 535 L1470 660Z" />
        <path d="M1460 670 L1510 520 L1560 670Z" />
      </g>

      {/* RUNNER 1 */}
      <g transform="translate(1040 625)">
        <circle cx="0" cy="-48" r="15" fill="#925d3b" />

        <path
          d="M-14 -58 Q0 -78 16 -58 L12 -48 L-13 -48Z"
          fill="#20272a"
        />

        <path
          d="M-18 -30 Q0 -45 18 -30 L12 30 L-14 30Z"
          fill="#d5a84f"
        />

        <path
          d="M-10 30 L-24 82"
          stroke="#20272a"
          strokeWidth="13"
          strokeLinecap="round"
        />

        <path
          d="M9 30 L28 78"
          stroke="#20272a"
          strokeWidth="13"
          strokeLinecap="round"
        />

        <path
          d="M-15 -22 L-55 14"
          stroke="#925d3b"
          strokeWidth="9"
          strokeLinecap="round"
        />

        <path
          d="M14 -22 L52 -5"
          stroke="#925d3b"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>

      {/* RUNNER 2 */}
      <g transform="translate(1170 665) scale(0.72)">
        <circle cx="0" cy="-48" r="15" fill="#70472f" />

        <path
          d="M-15 -55 Q0 -80 16 -55 L10 -46 L-14 -47Z"
          fill="#242a2d"
        />

        <path
          d="M-18 -30 Q0 -44 18 -30 L12 30 L-14 30Z"
          fill="#e7e3d5"
        />

        <path
          d="M-10 30 L-26 80"
          stroke="#262c30"
          strokeWidth="13"
          strokeLinecap="round"
        />

        <path
          d="M9 30 L26 78"
          stroke="#262c30"
          strokeWidth="13"
          strokeLinecap="round"
        />
      </g>

      {/* RUNNER 3 */}
      <g transform="translate(1320 700) scale(0.5)">
        <circle cx="0" cy="-48" r="15" fill="#8a5937" />

        <path
          d="M-18 -30 Q0 -45 18 -30 L12 30 L-14 30Z"
          fill="#b98945"
        />

        <path
          d="M-10 30 L-24 78"
          stroke="#222a2d"
          strokeWidth="13"
          strokeLinecap="round"
        />

        <path
          d="M9 30 L27 78"
          stroke="#222a2d"
          strokeWidth="13"
          strokeLinecap="round"
        />
      </g>

      {/* GOLDEN LIGHT */}
      <rect
        width="1600"
        height="900"
        fill="url(#sun)"
        opacity="0.08"
      />
    </svg>
  );
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

        
        <div className={styles.content}>    <div className={styles.eventLogo}>  
  <img src="/360-fc-logo.png.jpeg" alt="360 Performance Logo" />  
</div>    <p className={styles.present}>  
                  PRESENTS  
  </p>    <h2>HALDWANI</h2>    <h3>HILL RUSH</h3>

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

      <div className={styles.sponsorSection}>

        <h2>
          OUR PARTNERS & SPONSORS
        </h2>

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
