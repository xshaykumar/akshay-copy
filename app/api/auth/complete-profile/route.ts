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
import { createClient } from "@/lib/supabase/server";
import { indianMobileSchema } from "@/lib/contact/mobile";

const profileBaseSchema = z.object({
  displayName: z.string().trim().min(2, "Full name must contain at least 2 characters.").max(80, "Full name must contain no more than 80 characters."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{2,29}$/, "Username must be 3-30 characters, start with a letter, and use only lowercase letters, numbers, or underscores."),
  mobile: indianMobileSchema,
});

const locationField = z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Enter no more than 80 characters.");

const profileSchema = z.discriminatedUnion("role", [
  profileBaseSchema.extend({
    role: z.literal("client"),
    state: locationField,
    city: locationField,
    district: locationField,
  }),
  profileBaseSchema.extend({
    role: z.literal("coach"),
  }),
]);

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);

  try {
    assertSameOrigin(request);
    const input = profileSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      throw new HttpError(401, "authentication_required", "Sign in is required.");
    }

    const db = getDb();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUser.id))
      .limit(1);

    if (existing.length > 0) {
      throw new HttpError(409, "profile_exists", "The profile already exists.");
    }

    await db.transaction(async (transaction) => {
      const [createdUser] = await transaction
        .insert(users)
        .values({
          authUserId: authUser.id,
          username: input.username,
          normalizedUsername: input.username,
          displayName: input.displayName,
          contactPhone: input.mobile,
          status: authUser.email_confirmed_at ? "active" : "pending_verification",
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

    return NextResponse.json({
      destination: input.role === "coach" ? "/coach" : "/client",
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
