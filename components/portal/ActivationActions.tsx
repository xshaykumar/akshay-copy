"use client";

import { CalendarClock, IndianRupee, MapPin, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import formStyles from "@/components/public/public.module.css";
import {
  coachAvailabilityDayLabels,
  coachAvailabilityDays,
  coachAvailabilityTimeSlotLabels,
  coachAvailabilityTimeSlots,
  coachActivationOptions,
  type CoachActivationDuration,
  type CoachAvailabilityDay,
  type CoachAvailabilityTimeSlot,
} from "@/lib/coaches/activation";
import type { PaymentInterfaceMode } from "./CheckoutPanel";
import {
  abandonRazorpayCheckout,
  openRazorpayCheckout,
  RazorpayCheckoutInterruption,
} from "./razorpay-checkout";
import styles from "./portal.module.css";

async function requestJson<T = Record<string, unknown>>(
  url: string,
  options: RequestInit,
) {
  const response = await fetch(url, options);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
    requestId?: string;
  };
  if (!response.ok) {
    const message = body.error?.message ?? "The action could not be completed.";
    throw new Error(
      body.requestId ? `${message} Reference: ${body.requestId}` : message,
    );
  }
  return { body, response };
}

export function CoachActivationManager({
  certificationVerified,
  certificationWaived,
  active,
  activationPeriodCurrent,
  activationExpiresAt,
  availableDays,
  availableTimeSlots,
  locationState,
  locationCity,
  locationDistrict,
  paymentMode,
}: {
  certificationVerified: boolean;
  certificationWaived: boolean;
  active: boolean;
  activationPeriodCurrent: boolean;
  activationExpiresAt: string | null;
  availableDays: string[];
  availableTimeSlots: string[];
  locationState: string | null;
  locationCity: string | null;
  locationDistrict: string | null;
  paymentMode: PaymentInterfaceMode;
}) {
  const router = useRouter();
  const [working, setWorking] = useState<"availability" | "payment" | null>(
    null,
  );
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [processingDuration, setProcessingDuration] =
    useState<CoachActivationDuration | null>(null);

  async function saveAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    const values = new FormData(event.currentTarget);
    const selectedDays = values.getAll("availableDays");
    const selectedTimeSlots = values.getAll("availableTimeSlots");
    const locationState = String(values.get("locationState") ?? "").trim();
    const locationCity = String(values.get("locationCity") ?? "").trim();
    const locationDistrict = String(values.get("locationDistrict") ?? "").trim();
    if (selectedDays.length === 0) {
      setAvailabilityMessage("Select at least one available day.");
      return;
    }
    if (selectedTimeSlots.length === 0) {
      setAvailabilityMessage("Select at least one available time slot.");
      return;
    }
    if (
      locationState.length < 2 ||
      locationCity.length < 2 ||
      locationDistrict.length < 2
    ) {
      setAvailabilityMessage(
        "Enter your state, city and district using at least two characters each.",
      );
      return;
    }
    setWorking("availability");
    setAvailabilityMessage("");
    try {
      await requestJson("/api/coach/activation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availableDays: selectedDays,
          availableTimeSlots: selectedTimeSlots,
          locationState,
          locationCity,
          locationDistrict,
        }),
      });
      setAvailabilityMessage("Availability and location saved.");
      router.refresh();
    } catch (error) {
      setAvailabilityMessage(
        error instanceof Error
          ? error.message
          : "Availability could not be saved.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function submitFee(durationDays: CoachActivationDuration) {
    if (working) return;
    const option = coachActivationOptions.find(
      (candidate) => candidate.durationDays === durationDays,
    );
    if (!option) return;
    setWorking("payment");
    setProcessingDuration(durationDays);
    setPaymentMessage("");
    try {
      if (paymentMode === "provider") {
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
          body: JSON.stringify({ purpose: "coach_activation", durationDays }),
        });
        if (!order.checkout) {
          throw new Error("The payment order could not be created.");
        }
        let checkoutResult;
        try {
          checkoutResult = await openRazorpayCheckout(order.checkout);
        } catch (error) {
          if (!(error instanceof RazorpayCheckoutInterruption)) throw error;
          const status = await abandonRazorpayCheckout(order.checkout.orderId);
          if (status === "completed") {
            setPaymentMessage(
              "Payment completed. Your activation details are being refreshed.",
            );
            router.refresh();
            return;
          }
          if (status === "processing") {
            setPaymentMessage(
              "Payment is processing. Do not start another activation checkout until its status updates.",
            );
            router.refresh();
            return;
          }
          throw new Error(
            error.reason === "dismissed"
              ? "Payment window closed. No payment was taken, and you can choose another activation period."
              : "Payment was not completed. You can try again.",
          );
        }
        setPaymentMessage("Verifying payment…");
        const { body: verification, response } = await requestJson<{
          status?: "captured" | "processing";
          message?: string;
        }>("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkoutResult),
        });
        setPaymentMessage(
          response.status === 202 || verification.status === "processing"
            ? (verification.message ??
                "Payment is processing. Activation will update automatically after capture.")
            : `Your ₹${option.amountPaise / 100} payment was confirmed. The ${durationDays}-day activation period has been added.`,
        );
      } else {
        await requestJson("/api/coach/activation/pay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ durationDays }),
        });
        setPaymentMessage(
          `Your ₹${option.amountPaise / 100} payment was confirmed. The ${durationDays}-day activation period has been added.`,
        );
      }
      router.refresh();
    } catch (error) {
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : "The activation fee could not be recorded.",
      );
    } finally {
      setWorking(null);
      setProcessingDuration(null);
    }
  }

  return (
    <div className={styles.activationManager}>
      <div className={styles.activationRecommendation}>
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>
            {certificationWaived
              ? "Certification gate waived by administrator"
              : "Complete certification first"}
          </strong>
          <p>
            {certificationWaived
              ? "Your profile can remain active without certificate approval while its 30-day activation period is current."
              : "We recommend submitting your certificates before activation. Your profile will not become active until the administrator accepts at least one submitted certification, unless an administrator grants a certification waiver."}
          </p>
        </div>
      </div>

      <div
        className={`${styles.activationBanner} ${
          active ? styles.activationApproved : styles.activationRejected
        }`}
      >
        <div>
          <span>Profile Activation Status</span>
          <strong>{active ? "Active" : "Inactive"}</strong>
        </div>
        <p>
          {active
            ? `Your profile is active until ${new Date(
                activationExpiresAt as string,
              ).toLocaleDateString("en-IN")}.`
            : activationPeriodCurrent
              ? `Your 30-day activation is valid until ${new Date(
                  activationExpiresAt as string,
                ).toLocaleDateString("en-IN")}. Certification approval or an administrator waiver is still required before your profile becomes public.`
            : certificationVerified
              ? "Your certificates are accepted. Submit the 30-day fee to activate your profile."
              : "Certification acceptance (or an administrator waiver) and a valid 30-day activation period are required."}
        </p>
      </div>

      <section className={styles.activationSection}>
        <div className={styles.activationSectionHeading}>
          <CalendarClock size={20} aria-hidden="true" />
          <div>
            <h2>Availability</h2>
            <p>
              Select every day and one-hour slot when clients may book you.
              You can change these details whenever you want.
            </p>
          </div>
        </div>
        <form className={formStyles.authForm} onSubmit={saveAvailability} noValidate>
          <fieldset className={styles.activationFieldset}>
            <legend>Available days</legend>
            <div className={styles.activationChoiceGrid}>
              {coachAvailabilityDays.map((day) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    name="availableDays"
                    value={day}
                    defaultChecked={availableDays.includes(day)}
                  />
                  {coachAvailabilityDayLabels[day as CoachAvailabilityDay]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.activationFieldset}>
            <legend>Available time slots</legend>
            <div className={styles.activationChoiceGrid}>
              {coachAvailabilityTimeSlots.map((slot) => (
                <label key={slot}>
                  <input
                    type="checkbox"
                    name="availableTimeSlots"
                    value={slot}
                    defaultChecked={availableTimeSlots.includes(slot)}
                  />
                  {
                    coachAvailabilityTimeSlotLabels[
                      slot as CoachAvailabilityTimeSlot
                    ]
                  }
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.locationFields}>
            <div className={formStyles.formGroup}>
              <label htmlFor="activation-state">State</label>
              <input
                className={formStyles.formControl}
                id="activation-state"
                name="locationState"
                defaultValue={locationState ?? ""}
                minLength={2}
                maxLength={100}
                required
              />
            </div>
            <div className={formStyles.formGroup}>
              <label htmlFor="activation-city">City</label>
              <input
                className={formStyles.formControl}
                id="activation-city"
                name="locationCity"
                defaultValue={locationCity ?? ""}
                minLength={2}
                maxLength={100}
                required
              />
            </div>
            <div className={formStyles.formGroup}>
              <label htmlFor="activation-district">District</label>
              <input
                className={formStyles.formControl}
                id="activation-district"
                name="locationDistrict"
                defaultValue={locationDistrict ?? ""}
                minLength={2}
                maxLength={100}
                required
              />
            </div>
          </div>
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={working !== null}
          >
            {working === "availability" ? "Saving…" : "Save availability"}
          </button>
          {availabilityMessage ? (
            <p className={styles.formStatus} role="status" aria-live="polite">
              <MapPin size={14} aria-hidden="true" /> {availabilityMessage}
            </p>
          ) : null}
        </form>
      </section>

      <section className={styles.activationSection}>
        <div className={styles.activationSectionHeading}>
          <IndianRupee size={20} aria-hidden="true" />
          <div>
            <h2>Coach activation plans</h2>
            <p>
              Choose 30, 90, or 365 elapsed days. A renewal begins after your
              current active period ends.
            </p>
          </div>
        </div>
        <div className={styles.activationOptionGrid}>
          {coachActivationOptions.map((option) => (
            <div
              className={styles.activationPaymentCard}
              key={option.durationDays}
            >
              <div>
                <span>{option.durationDays}-day activation</span>
                <strong>
                  ₹{(option.amountPaise / 100).toLocaleString("en-IN")}
                </strong>
                <small>
                  Activates or renews your public coach profile for{" "}
                  {option.durationDays} elapsed days.
                </small>
              </div>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={working !== null || paymentMode === "unavailable"}
                onClick={() => submitFee(option.durationDays)}
              >
                {working === "payment" &&
                processingDuration === option.durationDays
                  ? "Processing…"
                  : activationPeriodCurrent
                    ? `Renew for ${option.durationDays} days`
                    : `Pay ₹${(option.amountPaise / 100).toLocaleString("en-IN")}`}
              </button>
            </div>
          ))}
        </div>
        <div>
          {paymentMode === "unavailable" ? (
            <p>
              Online payment is temporarily unavailable. An administrator may
              still grant a 30-day activation after your availability is saved.
            </p>
          ) : null}
          {paymentMessage ? (
            <p className={styles.formStatus} role="status" aria-live="polite">
              {paymentMessage}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
