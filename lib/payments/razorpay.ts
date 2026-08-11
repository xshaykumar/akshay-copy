import "server-only";

import Razorpay from "razorpay";
import { getServerEnv } from "@/lib/env/server";

let razorpayClient: Razorpay | undefined;

export function getRazorpayClient() {
  const environment = getServerEnv();
  if (
    environment.PAYMENTS_MODE !== "provider" ||
    !environment.RAZORPAY_KEY_ID ||
    !environment.RAZORPAY_KEY_SECRET
  ) {
    throw new Error("Razorpay provider payments are not configured.");
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: environment.RAZORPAY_KEY_ID,
      key_secret: environment.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

export function getRazorpayCheckoutKeyId() {
  const environment = getServerEnv();
  if (environment.PAYMENTS_MODE !== "provider" || !environment.RAZORPAY_KEY_ID) {
    throw new Error("Razorpay provider payments are not configured.");
  }
  return environment.RAZORPAY_KEY_ID;
}

export function getRazorpayKeySecret() {
  const environment = getServerEnv();
  if (
    environment.PAYMENTS_MODE !== "provider" ||
    !environment.RAZORPAY_KEY_SECRET
  ) {
    throw new Error("Razorpay provider payments are not configured.");
  }
  return environment.RAZORPAY_KEY_SECRET;
}

export function getRazorpayWebhookSecret() {
  const environment = getServerEnv();
  if (
    environment.PAYMENTS_MODE !== "provider" ||
    !environment.RAZORPAY_WEBHOOK_SECRET
  ) {
    throw new Error("The Razorpay webhook secret is not configured.");
  }
  return environment.RAZORPAY_WEBHOOK_SECRET;
}
