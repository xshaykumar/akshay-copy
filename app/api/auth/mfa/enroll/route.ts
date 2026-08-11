import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    if (!user || !user.roles.includes("admin")) {
      throw new HttpError(403, "admin_required", "Admin access is required.");
    }
    const supabase = await createClient();
    const { data: factors, error: listError } =
      await supabase.auth.mfa.listFactors();
    if (listError) {
      throw new HttpError(400, "mfa_list_failed", "MFA setup could not be loaded.");
    }
    const existing = factors.totp.find((factor) => factor.status === "verified");
    if (existing) {
      const challenge = await supabase.auth.mfa.challenge({
        factorId: existing.id,
      });
      if (challenge.error) {
        throw new HttpError(400, "mfa_challenge_failed", "MFA challenge failed.");
      }
      return NextResponse.json({
        factorId: existing.id,
        challengeId: challenge.data.id,
        enrolled: true,
      });
    }
    const enrollment = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "360 Performance admin",
    });
    if (enrollment.error) {
      throw new HttpError(400, "mfa_enrollment_failed", "MFA enrollment failed.");
    }
    return NextResponse.json({
      factorId: enrollment.data.id,
      qrCode: enrollment.data.totp.qr_code,
      secret: enrollment.data.totp.secret,
      enrolled: false,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
