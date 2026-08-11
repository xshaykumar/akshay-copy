import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import {
  assertSameOrigin,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { reconcileRazorpayCheckout } from "@/lib/payments/abandonment";

const inputSchema = z.object({
  orderId: z.string().trim().min(8).max(100),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = inputSchema.parse(await request.json());
    const status = await reconcileRazorpayCheckout({
      userId: user.id,
      orderId: input.orderId,
      requestId,
    });
    return NextResponse.json({ status });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
