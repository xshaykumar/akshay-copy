"use client";

import { useEffect, useState } from "react";
import {
  HeartPulse,
  CupSoda,
  Shirt,
  Timer,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import styles from "./HaldwaniHillRush.module.css";

const REGISTER_URL = "https://rzp.io/rzp/CFg0yaFX";

const REGISTRATION_CLOSES = new Date(
  "2026-10-02T23:00:00+05:30"
).getTime();

const EVENT_STARTS = new Date(
  "2026-10-04T06:00:00+05:30"
).getTime();

const CATEGORIES = [
  "Kids",
  "Junior",
  "Adults",
  "Masters",
];

const PERKS = [
  {
    title: "Medical Support",
    description: "Medical assistance on route",
    icon: HeartPulse,
  },
  {
    title: "Refreshments",
    description: "Hydration points on route",
    icon: CupSoda,
  },
  {
    title: "Official Tank",
    description: "Participant tank top included",
    icon: Shirt,
  },
  {
    title: "Timed Event",
    description: "Accurate race timing",
    icon: Timer,
  },
  {
    title: "Secure Route",
    description: "Route support throughout",
    icon: ShieldCheck,
  },
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
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  return {
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
  };
}

function CountdownRow({
  timeLeft,
}: {
  timeLeft: TimeLeft;
}) {
  const units = [
    {
      value: timeLeft.days,
      label: "Days",
    },
    {
      value: timeLeft.hours,
      label: "Hours",
    },
    {
      value: timeLeft.minutes,
      label: "Minutes",
    },
    {
      value: timeLeft.seconds,
      label: "Seconds",
    },
  ];

  return (
    <div className={styles.countdown}>
      {units.map((unit) => (
        <div
          className={styles.countUnit}
          key={unit.label}
        >
          <strong>
            {String(unit.value).padStart(2, "0")}
          </strong>

          <span>{unit.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function HaldwaniHillRush() {
  const [regTimeLeft, setRegTimeLeft] =
    useState<TimeLeft>({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });

  const [eventTimeLeft, setEventTimeLeft] =
    useState<TimeLeft>({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });

  useEffect(() => {
    const updateCountdowns = () => {
      setRegTimeLeft(
        getTimeLeft(REGISTRATION_CLOSES)
      );

      setEventTimeLeft(
        getTimeLeft(EVENT_STARTS)
      );
    };

    updateCountdowns();

    const interval = window.setInterval(
      updateCountdowns,
      1000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section
      className={styles.eventSection}
      aria-label="Haldwani Hill Rush Challenge 2026"
    >
      <div className={styles.hero}>

        {/* =====================================================
            BACKGROUND
        ===================================================== */}

        <div
          className={styles.background}
          aria-hidden="true"
        />

        <div
          className={styles.overlay}
          aria-hidden="true"
        />

        <div
          className={styles.lightSweep}
          aria-hidden="true"
        />

        <div
          className={styles.grain}
          aria-hidden="true"
        />


        {/* =====================================================
            CONTENT
        ===================================================== */}

        <div className={styles.content}>

          {/* HERO LABEL */}

          <div className={styles.heroIntro}>

            <div className={styles.brandLine}>
              <span
                className={styles.brandLineMark}
              />

              <span>
                360 PERFORMANCE
              </span>

              <span
                className={styles.brandLineMark}
              />
            </div>

            <p className={styles.kicker}>
              PRESENTS
            </p>

          </div>


          {/* =================================================
              TITLE
          ================================================= */}

          <div className={styles.titleBlock}>

            <h1>
              HALDWANI
            </h1>

            <h2>
              HILL RUSH
            </h2>

            <div
              className={styles.titleRule}
              aria-hidden="true"
            >
              <span />
              <i />
              <span />
            </div>

            <div className={styles.challenge}>
              <span>
                CHALLENGE
              </span>

              <strong>
                2026
              </strong>
            </div>

          </div>


          {/* =================================================
              PRIMARY EVENT INFORMATION
          ================================================= */}

          <div className={styles.mainInfo}>

            <div className={styles.infoItem}>

              <span className={styles.infoLabel}>
                DATE & TIME
              </span>

              <strong>
                04 OCTOBER 2026
              </strong>

              <small>
                SUNDAY · 6:00 AM
              </small>

            </div>


            <div className={styles.infoItem}>

              <span className={styles.infoLabel}>
                ENTRY
              </span>

              <strong
                className={styles.price}
              >
                ₹199
              </strong>

              <small>
                REGISTRATION
              </small>

            </div>


            <div className={styles.infoItem}>

              <span className={styles.infoLabel}>
                ROUTE
              </span>

              <strong>
                HALDWANI → KATHGODAM
              </strong>

              <small>
                AND BACK
              </small>

            </div>

          </div>


          {/* =================================================
              VENUE
          ================================================= */}

          <div className={styles.venue}>

            <span className={styles.venueLabel}>
              VENUE
            </span>

            <strong>
              HALDWANI STADIUM
            </strong>

            <span className={styles.venueLocation}>
              NEAR BUS STATION
            </span>

          </div>


          {/* =================================================
              CATEGORIES
          ================================================= */}

          <div
            className={styles.categories}
            aria-label="Race categories"
          >

            {CATEGORIES.map(
              (category, index) => (
                <div
                  className={styles.category}
                  key={category}
                >

                  <span
                    className={
                      styles.categoryNumber
                    }
                  >
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <strong>
                    {category}
                  </strong>

                </div>
              )
            )}

          </div>


          {/* =================================================
              EVENT FEATURES
          ================================================= */}

          <div className={styles.perks}>

            {PERKS.map((perk) => {
              const Icon = perk.icon;

              return (
                <div
                  className={styles.perk}
                  key={perk.title}
                >

                  <div
                    className={styles.perkIcon}
                  >
                    <Icon
                      size={19}
                      strokeWidth={1.6}
                    />
                  </div>

                  <div
                    className={styles.perkText}
                  >

                    <strong>
                      {perk.title}
                    </strong>

                    <span>
                      {perk.description}
                    </span>

                  </div>

                </div>
              );
            })}

          </div>


          {/* =================================================
              COUNTDOWN
          ================================================= */}

          <div
            className={styles.countdownGroup}
          >

            <div
              className={styles.countdownBlock}
            >

              <div
                className={
                  styles.countdownHeader
                }
              >

                <span>
                  REGISTRATION CLOSES
                </span>

                <strong>
                  02 OCT · 11:00 PM
                </strong>

              </div>

              <CountdownRow
                timeLeft={regTimeLeft}
              />

            </div>


            <div
              className={styles.countdownDivider}
              aria-hidden="true"
            />


            <div
              className={styles.countdownBlock}
            >

              <div
                className={
                  styles.countdownHeader
                }
              >

                <span>
                  EVENT STARTS
                </span>

                <strong>
                  04 OCT · 6:00 AM
                </strong>

              </div>

              <CountdownRow
                timeLeft={eventTimeLeft}
              />

            </div>

          </div>


          {/* =================================================
              CTA
          ================================================= */}

          <div className={styles.ctaArea}>

            <a
              href={REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={
                styles.registerButton
              }
            >

              <span>
                REGISTER NOW
              </span>

              <span
                className={styles.buttonArrow}
              >
                <ArrowUpRight
                  size={19}
                  strokeWidth={1.9}
                />
              </span>

            </a>

            <p className={styles.ctaNote}>
              SECURE YOUR BIB · LIMITED REGISTRATIONS
            </p>

          </div>

        </div>
      </div>
    </section>
  );
}
