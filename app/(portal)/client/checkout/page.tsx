import { CheckoutPanel } from "@/components/portal/CheckoutPanel";
import { requirePageRole } from "@/lib/auth/session";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  await requirePageRole("client");
  return (
    <CheckoutPanel
      requestedPlan={plan}
      paymentMode={
        process.env.PAYMENTS_MODE === "provider"
          ? "provider"
          : process.env.APP_ENV !== "production" &&
              process.env.PAYMENTS_MODE === "mock"
            ? "mock"
            : "unavailable"
      }
    />
  );
}
