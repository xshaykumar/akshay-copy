import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { jsonError, requestIdFrom } from "@/lib/http/errors";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const rows = await getDb()
      .select({
        id: plans.id,
        code: plans.code,
        name: plans.name,
        description: plans.description,
        coachingMode: plans.coachingMode,
        durationDays: plans.durationDays,
        pricePaise: plans.pricePaise,
        currency: plans.currency,
        features: plans.features,
      })
      .from(plans)
      .where(eq(plans.active, true))
      .orderBy(asc(plans.pricePaise));
    return NextResponse.json({ plans: rows });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
