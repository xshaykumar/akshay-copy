type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailure = {
  error?: { description?: string; reason?: string };
};

export class RazorpayCheckoutInterruption extends Error {
  constructor(
    public readonly reason: "dismissed" | "payment_failed",
    message: string,
  ) {
    super(message);
    this.name = "RazorpayCheckoutInterruption";
  }
}

export async function abandonRazorpayCheckout(orderId: string) {
  const response = await fetch("/api/payments/razorpay/abandon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    status?: "abandoned" | "processing" | "completed";
    error?: { message?: string };
  };
  if (!response.ok || !body.status) {
    throw new Error(
      body.error?.message ??
        "Payment status could not be confirmed. Try again shortly.",
    );
  }
  return body.status;
}

type RazorpayInstance = {
  open(): void;
  on(event: "payment.failed", handler: (failure: RazorpayFailure) => void): void;
};

type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (success: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
}) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let checkoutScriptPromise: Promise<void> | undefined;

function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScriptPromise) return checkoutScriptPromise;
  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-performance-razorpay="checkout"]',
    );
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.performanceRazorpay = "checkout";
      document.body.appendChild(script);
    }
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Razorpay Checkout could not be loaded.")),
      { once: true },
    );
  });
  return checkoutScriptPromise;
}

export async function openRazorpayCheckout(options: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
}) {
  await loadCheckoutScript();
  if (!window.Razorpay) {
    throw new Error("Razorpay Checkout is unavailable.");
  }
  return new Promise<RazorpaySuccess>((resolve, reject) => {
    let settled = false;
    const succeed = (result: RazorpaySuccess) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const checkout = new window.Razorpay!({
      key: options.keyId,
      amount: options.amountPaise,
      currency: options.currency,
      order_id: options.orderId,
      name: "360 Performance",
      description: options.description,
      prefill: options.prefill,
      theme: { color: "#98663a" },
      handler: succeed,
      modal: {
        ondismiss: () =>
          fail(
            new RazorpayCheckoutInterruption(
              "dismissed",
              "Payment window closed.",
            ),
          ),
      },
    });
    checkout.on("payment.failed", (failure) => {
      fail(
        new RazorpayCheckoutInterruption(
          "payment_failed",
          failure.error?.description ??
            failure.error?.reason ??
            "Razorpay could not complete the payment.",
        ),
      );
    });
    checkout.open();
  });
}
