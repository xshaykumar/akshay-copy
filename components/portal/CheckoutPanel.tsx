"use client";

import { Check, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatPlanDuration } from "@/lib/plans/duration";
import {
  abandonRazorpayCheckout,
  openRazorpayCheckout,
  RazorpayCheckoutInterruption,
} from "./razorpay-checkout";
import styles from "./portal.module.css";

type Plan = {
  code: string;
  name: string;
  description: string;
  coachingMode: string;
  pricePaise: number;
  currency: string;
  durationDays: number;
  features: string[];
};

export type PaymentInterfaceMode = "mock" | "provider" | "unavailable";

type ApiError = { error?: { message?: string } };

async function responseBody<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T & ApiError;
}

export function CheckoutPanel({
  requestedPlan,
  paymentMode,
}: {
  requestedPlan?: string;
  paymentMode: PaymentInterfaceMode;
}) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Record<string, string>>(
    {},
  );
  const [message, setMessage] = useState("");
  const [messagePlanCode, setMessagePlanCode] = useState<string | null>(null);
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plans")
      .then(async (response) => {
        const body = (await response.json()) as { plans?: Plan[] } & ApiError;
        if (!response.ok) {
          throw new Error(body.error?.message ?? "Plans could not be loaded.");
        }
        const availablePlans = body.plans ?? [];
        setPlans(availablePlans);
        const requested = availablePlans.find(
          (plan) => plan.code === requestedPlan,
        );
        const initialSelections: Record<string, string> = {};
        for (const plan of availablePlans) {
          if (plan.pricePaise <= 0) continue;
          const selected = initialSelections[plan.name];
          if (
            !selected ||
            plan.durationDays === 90 ||
            requested?.name === plan.name && requested.code === plan.code
          ) {
            initialSelections[plan.name] = plan.code;
          }
        }
        setSelectedCodes(initialSelections);
      })
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Plans could not be loaded.",
        ),
      );
  }, [requestedPlan]);

  const commercialGroups = useMemo(() => {
    const grouped = new Map<string, Plan[]>();
    for (const plan of plans) {
      if (plan.pricePaise <= 0) continue;
      grouped.set(plan.name, [...(grouped.get(plan.name) ?? []), plan]);
    }
    return [...grouped.entries()].map(([name, options]) => ({
      name,
      options: options.sort((left, right) => left.durationDays - right.durationDays),
      representative: options[0],
    }));
  }, [plans]);
  async function purchaseWithMockProvider(plan: Plan) {
    const response = await fetch("/api/payments/mock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ planCode: plan.code }),
    });
    const body = await responseBody<{
      purchase?: { purchaseId?: string };
    }>(response);
    if (!response.ok) {
      throw new Error(
        body.error?.message ?? "The plan purchase could not be completed.",
      );
    }
    setMessage(
      "Plan purchase confirmed. Your 24-hour coach-selection window is open.",
    );
    router.push("/client/coaches");
    router.refresh();
  }

  async function purchaseWithRazorpay(plan: Plan) {
    const orderResponse = await fetch("/api/payments/razorpay/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        purpose: "plan_purchase",
        planCode: plan.code,
      }),
    });
    const orderBody = await responseBody<{
      checkout?: {
        keyId: string;
        orderId: string;
        amountPaise: number;
        currency: string;
        description: string;
        prefill: { name: string; email: string; contact: string };
      };
    }>(orderResponse);
    if (!orderResponse.ok || !orderBody.checkout) {
      throw new Error(
        orderBody.error?.message ?? "The payment order could not be created.",
      );
    }
    let checkoutResult;
    try {
      checkoutResult = await openRazorpayCheckout(orderBody.checkout);
    } catch (error) {
      if (!(error instanceof RazorpayCheckoutInterruption)) throw error;
      const status = await abandonRazorpayCheckout(orderBody.checkout.orderId);
      if (status === "completed") {
        setMessage("Payment completed. Your plan details are being refreshed.");
        router.refresh();
        return;
      }
      if (status === "processing") {
        setMessage(
          "Payment is processing. Do not start another checkout until its status updates.",
        );
        router.refresh();
        return;
      }
      throw new Error(
        error.reason === "dismissed"
          ? "Payment window closed. No payment was taken, and you can choose another plan."
          : "Payment was not completed. You can try this plan again or choose another plan.",
      );
    }
    setMessage("Verifying payment…");
    const verificationResponse = await fetch(
      "/api/payments/razorpay/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutResult),
      },
    );
    const verification = await responseBody<{
      status?: "captured" | "processing";
      destination?: string;
      message?: string;
    }>(verificationResponse);
    if (!verificationResponse.ok && verificationResponse.status !== 202) {
      throw new Error(
        verification.error?.message ?? "Payment verification failed.",
      );
    }
    if (verification.status === "processing") {
      setMessage(
        verification.message ??
          "Payment is processing. Your plan will update automatically after capture.",
      );
      router.refresh();
      return;
    }
    setMessage("Payment captured. Your coach-selection window is open.");
    router.push(verification.destination ?? "/client/coaches");
    router.refresh();
  }

  async function purchase(plan: Plan) {
    if (submittingPlan) return;
    setSubmittingPlan(plan.code);
    setMessagePlanCode(plan.code);
    setMessage("");
    try {
      if (paymentMode === "mock") {
        await purchaseWithMockProvider(plan);
      } else if (paymentMode === "provider") {
        await purchaseWithRazorpay(plan);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The plan purchase could not be completed.",
      );
    } finally {
      setSubmittingPlan(null);
    }
  }

  return (
    <section className={styles.checkoutCatalogue}>
      <div className={styles.checkoutHeading}>
        <div>
          <span>Choose your coaching level</span>
          <h2>Available plans</h2>
          <p>
            Compare the same plans and 3, 6, and 12-month prices shown on the
            public website. Select a duration inside the plan you want.
          </p>
        </div>
      </div>

      <div className={styles.checkoutPlanGrid}>
        {commercialGroups.map((group) => {
          const plan =
            group.options.find(
              (option) => option.code === selectedCodes[group.name],
            ) ?? group.options[0];
          const unavailable = paymentMode === "unavailable";
          return (
            <article className={styles.checkoutPlanCard} key={group.name}>
              <div className={styles.checkoutPlanTopline}>
                <span>{group.representative.coachingMode} coaching</span>
              </div>
              <h3>{group.name}</h3>
              <p>{group.representative.description}</p>
              <ul>
                {group.representative.features.map((feature) => (
                  <li key={feature}>
                    <Check size={14} aria-hidden="true" /> {feature}
                  </li>
                ))}
              </ul>
              <div
                className={styles.checkoutDurationGrid}
                aria-label={`${group.name} duration`}
              >
                {group.options.map((option) => {
                  const selected = option.code === plan.code;
                  return (
                    <button
                      className={
                        selected ? styles.checkoutDurationSelected : ""
                      }
                      key={option.code}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedCodes((current) => ({
                          ...current,
                          [group.name]: option.code,
                        }))
                      }
                    >
                      <span>{formatPlanDuration(option.durationDays)}</span>
                      <strong>
                        ₹{(option.pricePaise / 100).toLocaleString("en-IN")}
                      </strong>
                    </button>
                  );
                })}
              </div>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={Boolean(submittingPlan) || unavailable}
                onClick={() => purchase(plan)}
              >
                {submittingPlan === plan.code
                  ? "Opening secure payment…"
                  : `Choose ${formatPlanDuration(plan.durationDays)} plan`}
              </button>
              {unavailable ? (
                <small>Online payment is temporarily unavailable.</small>
              ) : null}
              {message && messagePlanCode === plan.code ? (
                <p
                  className={styles.checkoutMessage}
                  role="status"
                  aria-live="polite"
                >
                  {message}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className={styles.checkoutTrustNote}>
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          Paid checkout is handled by Razorpay. Card, CVV, bank and OTP details
          are entered with Razorpay and are never stored by 360 Performance.
        </p>
      </div>
      {message && !messagePlanCode ? (
        <p className={styles.checkoutMessage} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
