import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function recoveryFailure(origin: string) {
  return NextResponse.redirect(
    new URL("/login?error=recovery-link-invalid", origin),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (error) return recoveryFailure(url.origin);
    return NextResponse.redirect(new URL("/update-password", url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return recoveryFailure(url.origin);
    return NextResponse.redirect(new URL("/update-password", url.origin));
  }

  return recoveryFailure(url.origin);
}
