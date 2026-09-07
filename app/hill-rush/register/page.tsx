"use client";

import { useState } from "react";

export default function HillRushRegistration() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.title}>Registration Started</h1>
          <p style={styles.text}>
            Your registration details have been received.
          </p>
          <p style={styles.text}>
            Continue with payment to complete your registration.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.badge}>4 OCTOBER 2026</div>

          <h1 style={styles.title}>
            HALDWANI
            <br />
            <span style={styles.gold}>HILL RUSH</span>
          </h1>

          <p style={styles.subtitle}>CHALLENGE 2026</p>

          <div style={styles.price}>₹299</div>
          <p style={styles.priceText}>REGISTRATION FEE</p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Participant Details</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <label style={styles.label}>Full Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Enter your full name"
              required
            />

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Age</label>
                <input
                  style={styles.input}
                  type="number"
                  min="18"
                  placeholder="18+"
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Gender</label>
                <select style={styles.input} required defaultValue="">
                  <option value="" disabled>
                    Select
                  </option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <label style={styles.label}>Location</label>
            <input
              style={styles.input}
              type="text"
              placeholder="City / Area"
              required
            />

            <label style={styles.label}>WhatsApp Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="10-digit WhatsApp number"
              required
            />

            <label style={styles.label}>Emergency Contact</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="Emergency contact number"
              required
            />

            <label style={styles.label}>Running Experience</label>
            <select style={styles.input} required defaultValue="">
              <option value="" disabled>
                Select experience
              </option>
              <option>Beginner</option>
              <option>Occasionally Run</option>
              <option>Regular Runner</option>
              <option>Competitive Runner</option>
            </select>

            <label style={styles.consent}>
              <input type="checkbox" required />
              <span>
                I confirm that I am 18 years or older and agree to participate
                in the Haldwani Hill Rush Challenge 2026 at my own
                responsibility.
              </span>
            </label>

            <button type="submit" style={styles.button}>
              CONTINUE TO PAYMENT — ₹299
            </button>
          </form>
        </div>

        <div style={styles.notice}>
          <strong>18+ ONLY</strong> • Registration fee ₹299
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, #252525 0%, #0b0b0b 45%, #050505 100%)",
    color: "#fff",
    padding: "30px 16px 60px",
    fontFamily: "Arial, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "680px",
    margin: "0 auto",
  },

  header: {
    textAlign: "center",
    padding: "20px 10px 30px",
  },

  badge: {
    display: "inline-block",
    padding: "8px 16px",
    border: "1px solid #c9a45c",
    borderRadius: "30px",
    color: "#d8b56a",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "2px",
  },

  title: {
    margin: "20px 0 4px",
    fontSize: "clamp(38px, 10vw, 68px)",
    lineHeight: 0.95,
    fontWeight: 900,
    letterSpacing: "-2px",
  },

  gold: {
    color: "#d6ae5b",
  },

  subtitle: {
    margin: "12px 0 20px",
    color: "#aaa",
    fontSize: "16px",
    letterSpacing: "5px",
    fontWeight: 700,
  },

  price: {
    fontSize: "32px",
    fontWeight: 800,
    color: "#fff",
  },

  priceText: {
    margin: "3px 0 0",
    color: "#888",
    fontSize: "11px",
    letterSpacing: "2px",
  },

  card: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(214,174,91,0.3)",
    borderRadius: "20px",
    padding: "26px",
    backdropFilter: "blur(12px)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },

  sectionTitle: {
    fontSize: "20px",
    margin: "0 0 20px",
    color: "#d6ae5b",
  },

  label: {
    display: "block",
    fontSize: "13px",
    color: "#cfcfcf",
    marginBottom: "7px",
    marginTop: "16px",
    fontWeight: 600,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#111",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    outline: "none",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },

  field: {
    minWidth: 0,
  },

  consent: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    marginTop: "22px",
    color: "#bbb",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  button: {
    width: "100%",
    marginTop: "25px",
    padding: "16px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #e1bd6b, #a77a2f)",
    color: "#080808",
    fontWeight: 900,
    fontSize: "15px",
    letterSpacing: "0.5px",
    cursor: "pointer",
  },

  notice: {
    textAlign: "center",
    color: "#777",
    fontSize: "12px",
    lineHeight: 1.5,
    marginTop: "20px",
  },

  successIcon: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "#d6ae5b",
    color: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "32px",
    fontWeight: 900,
    margin: "0 auto 20px",
  },

  text: {
    color: "#aaa",
    textAlign: "center",
    lineHeight: 1.6,
  },
};
