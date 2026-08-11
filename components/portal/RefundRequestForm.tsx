"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./portal.module.css";

type ApiResult = { error?: { message?: string } };

export function RefundRequestForm({
  paymentOrderId,
  defaultEmail,
  defaultPhone,
}: {
  paymentOrderId: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    const values = new FormData(event.currentTarget);
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/refunds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          paymentOrderId,
          reasonCode: "coach_unavailable",
          contactEmail: values.get("contactEmail"),
          contactPhone: values.get("contactPhone"),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;
      if (!response.ok) {
        throw new Error(
          result.error?.message ?? "The refund request could not be submitted.",
        );
      }
      setMessage("Refund request submitted for administrator review.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The refund request could not be submitted.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className={styles.formGrid} onSubmit={submit}>
      <label>
        <span>Email</span>
        <input
          name="contactEmail"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail ?? ""}
          required
        />
      </label>
      <label>
        <span>Mobile number</span>
        <input
          name="contactPhone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          defaultValue={defaultPhone ?? ""}
          maxLength={16}
          required
        />
      </label>
      <div className={styles.formActions}>
        <button className={styles.secondaryButton} type="submit" disabled={working}>
          {working ? "Submitting…" : "Request refund"}
        </button>
        {message ? <p className={styles.formStatus} role="status">{message}</p> : null}
      </div>
    </form>
  );
}
