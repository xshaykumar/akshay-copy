import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { userRoles, users } from "@/db/schema";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email address or username.")
    .max(254, "Email address or username is too long.")
    .transform((value) => value.toLowerCase())
    .refine(
      (value) =>
        z.email().safeParse(value).success ||
        /^[a-z][a-z0-9_]{2,29}$/.test(value),
      "Enter a valid email address or username.",
    ),
  password: z.string().min(1, "Enter your password.").max(128, "Password must contain no more than 128 characters."),
});

function invalidCredentials() {
  return new HttpError(
    401,
    "invalid_credentials",
    "The email address, username, or password is incorrect.",
  );
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);

  try {
    assertSameOrigin(request);
    const input = loginSchema.parse(await request.json());
    const db = getDb();
    let email = input.identifier;

    if (!input.identifier.includes("@")) {
      const [account] = await db
        .select({ authUserId: users.authUserId })
        .from(users)
        .where(eq(users.normalizedUsername, input.identifier))
        .limit(1);

      if (!account) {
        throw invalidCredentials();
      }

      const { data: authAccount, error: lookupError } =
        await createAdminClient().auth.admin.getUserById(account.authUserId);
      email = authAccount.user?.email ?? "";

      if (lookupError || !email) {
        throw invalidCredentials();
      }
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });

    if (error || !data.user) {
      throw invalidCredentials();
    }

    if (data.user.email_confirmed_at) {
      await db
        .update(users)
        .set({ status: "active", updatedAt: new Date() })
        .where(
          and(
            eq(users.authUserId, data.user.id),
            eq(users.status, "pending_verification"),
          ),
        );
    }

    const roles = await db
      .select({ role: userRoles.role, status: users.status })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(users.authUserId, data.user.id));

    if (roles.length === 0) {
      return NextResponse.json({ destination: "/onboarding" });
    }
    if (roles[0]?.status !== "active") {
      await supabase.auth.signOut();
      throw new HttpError(
        403,
        "account_unavailable",
        "This account is not currently active.",
      );
    }

    const roleNames = roles.map(({ role }) => role);
    const destination = roleNames.includes("admin")
      ? "/mfa"
      : roleNames.includes("coach")
        ? "/coach"
        : "/client";

    return NextResponse.json({ destination });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
