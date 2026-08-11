import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);

  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ destination: "/" });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
