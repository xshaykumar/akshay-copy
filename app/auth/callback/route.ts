import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next");
  const safeRequested =
    requested?.startsWith("/") && !requested.startsWith("//")
      ? requested
      : null;
  const destination = new URL("/onboarding", url.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser?.email_confirmed_at) {
        await getDb()
          .update(users)
          .set({ status: "active", updatedAt: new Date() })
          .where(
            and(
              eq(users.authUserId, authUser.id),
              eq(users.status, "pending_verification"),
            ),
          );
      }
      const appUser = await getCurrentAppUser();
      if (!appUser) return NextResponse.redirect(destination);
      const appDestination = appUser.roles.includes("admin")
        ? "/mfa"
        : appUser.roles.includes("coach")
          ? "/coach"
          : "/client";
      return NextResponse.redirect(
        new URL(safeRequested ?? appDestination, url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
}
