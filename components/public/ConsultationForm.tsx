"use client";

import { useState, type FormEvent } from "react";
import { CalendarCheck2, CircleCheckBig } from "lucide-react";
import styles from "./public.module.css";

export function ConsultationForm() {
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setMessage("");
    const values = new FormData(form);
    const response = await fetch("/api/consultations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        contactName: values.get("contactName"),
        contactPhone: values.get("contactPhone"),
        goalCategory: values.get("goalCategory"),
      }),
    });
    const body = (await response.json()) as {
      message?: string;
      error?: { message?: string };
    };
    setSubmitting(false);
    if (!response.ok) {
      setMessage(
        body.error?.message ??
          "The consultation could not be booked. Check the details and try again.",
      );
      return;
    }
    form.reset();
    setSubmitted(true);
    setMessage(
      body.message ??
        "Thank you. A 360 Performance mentor will contact you shortly.",
    );
  }

  return (
    <form className={styles.formCard} onSubmit={submit}>
      {submitted ? (
        <div className={styles.consultationSuccess} role="status">
          <CircleCheckBig size={42} aria-hidden="true" />
          <span>Request submitted</span>
          <h2>Thank you for contacting 360 Performance.</h2>
          <p>{message}</p>
        </div>
      ) : (
        <>
          <h2>Book your consultation</h2>
          <p>
            Tell us who you are and what you want to achieve. The consultation
            is completely free.
          </p>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="consult-name">Full name</label>
              <input
                className={styles.formControl}
                id="consult-name"
                name="contactName"
                autoComplete="name"
                maxLength={80}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="consult-phone">Mobile number</label>
              <input
                className={styles.formControl}
                id="consult-phone"
                name="contactPhone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={16}
                required
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label htmlFor="consult-goal">Your goal</label>
              <textarea
                className={styles.formTextArea}
                id="consult-goal"
                name="goalCategory"
                rows={4}
                maxLength={500}
                placeholder="Tell us what you would like to achieve"
                required
              />
            </div>
          </div>
          <button
            className={`${styles.primaryButton} ${styles.formSubmit}`}
            type="submit"
            disabled={submitting}
          >
            <CalendarCheck2 size={17} aria-hidden="true" />
            {submitting ? "Submitting…" : "Submit consultation request"}
          </button>
          <p className={styles.formNotice} role="status">
            {message ||
              "There is no charge. Our team will contact you on your mobile number."}
          </p>
        </>
      )}
    </form>
  );
}
