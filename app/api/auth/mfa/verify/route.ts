import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  factorId: z.string().min(1),
  challengeId: z.string().min(1).optional(),
  code: z.string().regex(/^[0-9]{6}$/),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    if (!user || !user.roles.includes("admin")) {
      throw new HttpError(403, "admin_required", "Admin access is required.");
    }
    const input = inputSchema.parse(await request.json());
    const supabase = await createClient();
    let challengeId = input.challengeId;
    if (!challengeId) {
      const challenge = await supabase.auth.mfa.challenge({
        factorId: input.factorId,
      });
      if (challenge.error) {
        throw new HttpError(400, "mfa_challenge_failed", "MFA challenge failed.");
      }
      challengeId = challenge.data.id;
    }
    const verification = await supabase.auth.mfa.verify({
      factorId: input.factorId,
      challengeId,
      code: input.code,
    });
    if (verification.error) {
      throw new HttpError(400, "mfa_invalid_code", "The verification code is invalid.");
    }
    return NextResponse.json({ destination: "/admin" });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
