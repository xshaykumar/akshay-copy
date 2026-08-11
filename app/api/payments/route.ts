import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { paymentOrders } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { jsonError, requestIdFrom } from "@/lib/http/errors";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const client = await requireRole("client");
    const rows = await getDb()
      .select({
        id: paymentOrders.id,
        amountPaise: paymentOrders.amountPaise,
        currency: paymentOrders.currency,
        provider: paymentOrders.provider,
        status: paymentOrders.status,
        createdAt: paymentOrders.createdAt,
      })
      .from(paymentOrders)
      .where(eq(paymentOrders.userId, client.id))
      .orderBy(desc(paymentOrders.createdAt));
    return NextResponse.json({ payments: rows });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
