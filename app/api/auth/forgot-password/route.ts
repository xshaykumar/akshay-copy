import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, jsonError, requestIdFrom } from "@/lib/http/errors";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env/server";

const inputSchema = z.object({ email: z.email().toLowerCase() });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const { email } = inputSchema.parse(await request.json());
    const supabase = await createClient();
    const applicationOrigin =
      getServerEnv().APP_URL ?? new URL(request.url).origin;
    const recoveryUrl = new URL("/auth/recovery", applicationOrigin);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryUrl.toString(),
    });
    return NextResponse.json({ accepted: true });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
