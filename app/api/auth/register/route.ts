import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  clientProfiles,
  coachProfiles,
  notifications,
  userRoles,
  users,
} from "@/db/schema";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { appLogger } from "@/lib/logging/logger";
import { getServerEnv } from "@/lib/env/server";
import { indianMobileSchema } from "@/lib/contact/mobile";

const registrationBaseSchema = z.object({
  displayName: z.string().trim().min(2, "Full name must contain at least 2 characters.").max(80, "Full name must contain no more than 80 characters."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{2,29}$/, "Username must be 3-30 characters, start with a letter, and use only lowercase letters, numbers, or underscores."),
  email: z.email().toLowerCase(),
  mobile: indianMobileSchema,
  password: z.string().min(6, "Password must contain at least 6 characters.").max(128, "Password must contain no more than 128 characters."),
  acceptedTerms: z.literal(true),
});

const locationField = z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Enter no more than 80 characters.");

const registrationSchema = z.discriminatedUnion("role", [
  registrationBaseSchema.extend({
    role: z.literal("client"),
    state: locationField,
    city: locationField,
    district: locationField,
  }),
  registrationBaseSchema.extend({
    role: z.literal("coach"),
  }),
]);

function registrationAuthFailure(code: string | undefined) {
  switch (code) {
    case "weak_password":
      return new HttpError(
        400,
        "weak_password",
        "Choose a stronger password with a mix of letters, numbers, and symbols.",
      );
    case "email_address_invalid":
    case "validation_failed":
      return new HttpError(
        400,
        "invalid_email",
        "Enter a valid email address.",
      );
    case "user_already_exists":
    case "email_exists":
      return new HttpError(
        409,
        "account_exists",
        "An account already exists for this email address. Try signing in instead.",
      );
    case "over_email_send_rate_limit":
      return new HttpError(
        429,
        "email_rate_limited",
        "Too many verification emails were requested. Please wait and try again.",
      );
    case "over_request_rate_limit":
      return new HttpError(
        429,
        "registration_rate_limited",
        "Too many registration attempts were made. Please wait a few minutes and try again.",
      );
    case "email_address_not_authorized":
      return new HttpError(
        503,
        "email_delivery_unavailable",
        "Verification email delivery is not configured for this address yet.",
      );
    case "signup_disabled":
      return new HttpError(
        503,
        "signup_disabled",
        "New account registration is currently disabled.",
      );
    default:
      return new HttpError(
        400,
        "registration_failed",
        "The account could not be created. Check your details and try again.",
      );
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);

  try {
    assertSameOrigin(request);
    const input = registrationSchema.parse(await request.json());
    const environment = getServerEnv();
    const applicationOrigin =
      environment.APP_URL ?? new URL(request.url).origin;
    const confirmationUrl = new URL("/auth/callback", applicationOrigin);
    const db = getDb();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.normalizedUsername, input.username))
      .limit(1);

    if (existing.length > 0) {
      throw new HttpError(409, "username_unavailable", "That username is unavailable.");
    }

    const supabase = await createClient();
    const admin = createAdminClient();
    const userMetadata = {
      display_name: input.displayName,
      username: input.username,
      requested_role: input.role,
      contact_phone: input.mobile ?? null,
    };
    const authResult = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: confirmationUrl.toString(),
        data: userMetadata,
      },
    });
    const authUser = authResult.data.user;

    if (authResult.error || !authUser) {
      appLogger.warn("registration_auth_rejected", {
        requestId,
        errorCode: authResult.error?.code ?? "missing_auth_user",
      });
      throw registrationAuthFailure(authResult.error?.code);
    }
    if (Array.isArray(authUser.identities) && authUser.identities.length === 0) {
      throw registrationAuthFailure("user_already_exists");
    }
    const hasSession = Boolean(authResult.data.session);

    try {
      await db.transaction(async (transaction) => {
        const [createdUser] = await transaction
          .insert(users)
          .values({
            authUserId: authUser.id,
            username: input.username,
            normalizedUsername: input.username,
            displayName: input.displayName,
            contactPhone: input.mobile,
            status: authUser.email_confirmed_at
              ? "active"
              : "pending_verification",
          })
          .returning({ id: users.id });

        await transaction.insert(userRoles).values({
          userId: createdUser.id,
          role: input.role,
        });

        if (input.role === "client") {
          await transaction.insert(clientProfiles).values({
            userId: createdUser.id,
            locationState: input.state,
            locationCity: input.city,
            locationDistrict: input.district,
          });
        } else {
          await transaction.insert(coachProfiles).values({
            userId: createdUser.id,
            slug: input.username,
          });
        }
        await transaction.insert(notifications).values({
          userId: createdUser.id,
          type: "account.created",
          title: "Your account has been created",
          body:
            input.role === "coach"
              ? "Welcome to 360 Performance. Add your certifications and activation details to make your profile active."
              : "Welcome to 360 Performance. You can complete your health assessment now or later.",
          actionUrl:
            input.role === "coach"
              ? "/coach/certification"
              : "/client/assessment",
          metadata: { role: input.role },
        });
      });
    } catch {
      await admin.auth.admin.deleteUser(authUser.id);
      throw new HttpError(
        409,
        "registration_conflict",
        "The account details conflict with an existing account.",
      );
    }

    return NextResponse.json(
      {
        requiresEmailConfirmation:
          !hasSession && !authUser.email_confirmed_at,
        destination: input.role === "coach" ? "/coach" : "/client",
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
