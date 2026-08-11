import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "../lib/payments/signatures";

describe("Razorpay signatures", () => {
  it("verifies the checkout order and payment signature exactly", () => {
    const secret = "checkout-secret-value";
    const orderId = "order_Performance123";
    const paymentId = "pay_Performance456";
    const signature = createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(
      verifyRazorpayCheckoutSignature({
        orderId,
        paymentId,
        signature,
        secret,
      }),
    ).toBe(true);
    expect(
      verifyRazorpayCheckoutSignature({
        orderId,
        paymentId: `${paymentId}-changed`,
        signature,
        secret,
      }),
    ).toBe(false);
  });

  it("verifies the webhook against the unmodified raw request body", () => {
    const secret = "separate-webhook-secret";
    const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
    const signature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    expect(
      verifyRazorpayWebhookSignature({ rawBody, signature, secret }),
    ).toBe(true);
    expect(
      verifyRazorpayWebhookSignature({
        rawBody: `${rawBody} `,
        signature,
        secret,
      }),
    ).toBe(false);
  });
});
