"use client";

import { ArrowUpRight, CalendarClock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PaymentInterfaceMode } from "./CheckoutPanel";
import {
  abandonRazorpayCheckout,
  openRazorpayCheckout,
  RazorpayCheckoutInterruption,
} from "./razorpay-checkout";
import styles from "./portal.module.css";

async function requestJson<T>(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
    requestId?: string;
  };
  if (!response.ok) {
    const message = body.error?.message ?? "The upgrade could not be completed.";
    throw new Error(
      body.requestId ? `${message} Reference: ${body.requestId}` : message,
    );
  }
  return { body, response };
}

export function PlanUpgradePanel({
  amountPaise,
  applicableCycles,
  currentCycleNumber,
  totalCycles,
  effectiveAt,
  requestedOnCycleDayOne,
  paymentMode,
}: {
  amountPaise: number;
  applicableCycles: number;
  currentCycleNumber: number;
  totalCycles: number;
  effectiveAt: string;
  requestedOnCycleDayOne: boolean;
  paymentMode: PaymentInterfaceMode;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const effective = new Date(effectiveAt);

  async function upgrade() {
    if (working || paymentMode === "unavailable") return;
    setWorking(true);
    setMessage("");
    try {
      if (paymentMode === "mock") {
        await requestJson("/api/payments/mock/plan-upgrade", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
        });
        setMessage("Test payment confirmed. Your Online Elite upgrade is scheduled.");
        router.refresh();
        return;
      }
      const { body: order } = await requestJson<{
        checkout?: {
          keyId: string;
          orderId: string;
          amountPaise: number;
          currency: string;
          description: string;
          prefill: { name: string; email: string; contact: string };
        };
      }>("/api/payments/razorpay/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ purpose: "plan_upgrade" }),
      });
      if (!order.checkout) throw new Error("The upgrade checkout is unavailable.");

      let checkoutResult;
      try {
        checkoutResult = await openRazorpayCheckout(order.checkout);
      } catch (error) {
        if (!(error instanceof RazorpayCheckoutInterruption)) throw error;
        const status = await abandonRazorpayCheckout(order.checkout.orderId);
        if (status === "completed") {
          setMessage("Payment completed. Refreshing your upgrade status.");
          router.refresh();
          return;
        }
        if (status === "processing") {
          setMessage("Payment is processing. Do not start another checkout yet.");
          router.refresh();
          return;
        }
        throw new Error(
          error.reason === "dismissed"
            ? "Payment window closed. No payment was taken; you can try again."
            : "Payment was not completed. You can try again.",
        );
      }

      const { body: verification, response } = await requestJson<{
        status?: "captured" | "processing";
        message?: string;
      }>("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutResult),
      });
      if (response.status === 202 || verification.status === "processing") {
        setMessage(
          verification.message ??
            "Payment is processing. The upgrade will be scheduled after capture.",
        );
        router.refresh();
        return;
      }
      setMessage("Payment confirmed. Your Online Elite upgrade is scheduled.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The upgrade could not be completed.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className={styles.planUpgradePanel}>
      <div className={styles.planUpgradeHeading}>
        <span><ArrowUpRight size={17} aria-hidden="true" /> Plan upgrade</span>
        <h2>Upgrade Online Basic to Online Elite</h2>
        <p>
          Get live coaching six days every week, unlimited workout adjustments,
          personalized nutrition and advanced performance programming.
        </p>
      </div>
      <div className={styles.planUpgradeDetails}>
        <div><span>Upgrade fee</span><strong>₹{(amountPaise / 100).toLocaleString("en-IN")}</strong></div>
        <div><span>Effective from</span><strong suppressHydrationWarning>{effective.toLocaleString("en-IN")}</strong></div>
        <div><span>Cycles covered</span><strong>{applicableCycles} of {totalCycles}</strong></div>
        <div><span>Current cycle</span><strong>{currentCycleNumber}</strong></div>
      </div>
      <div className={styles.planUpgradeRule}>
        <CalendarClock size={18} aria-hidden="true" />
        <p>
          {requestedOnCycleDayOne
            ? "You are upgrading on day 1, so Online Elite begins on day 2 of this cycle."
            : "Online Elite begins on day 1 of your next 30-day service cycle."}
          {" "}Your current expiry date does not change. Upgrade pricing is based on full applicable cycles, not individual days.
        </p>
      </div>
      <button
        className={styles.primaryButton}
        type="button"
        disabled={working || paymentMode === "unavailable"}
        onClick={upgrade}
      >
        {working ? "Opening secure payment…" : `Pay ₹${(amountPaise / 100).toLocaleString("en-IN")} and upgrade`}
      </button>
      {paymentMode === "unavailable" ? (
        <p className={styles.checkoutMessage}>Online upgrade payment is currently unavailable.</p>
      ) : null}
      <div className={styles.planUpgradeTrust}>
        <ShieldCheck size={16} aria-hidden="true" /> Payment is handled securely by Razorpay.
      </div>
      {message ? <p className={styles.checkoutMessage} role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}
