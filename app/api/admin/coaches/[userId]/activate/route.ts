import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachProfiles,
  notifications,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import {
  addActivationPeriod,
  hasCoachAvailability,
  isCoachProfileActive,
} from "@/lib/coaches/activation";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import {
  hashRequest,
  requireIdempotencyKey,
  runIdempotent,
} from "@/lib/idempotency";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const admin = await requireRole("admin");
    const { userId } = await context.params;
    const targetUserId = z.uuid().parse(userId);
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `admin-activate-coach:${targetUserId}`,
      key,
      requestHash: hashRequest({ targetUserId }),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT user_id FROM app.coach_profiles WHERE user_id = ${targetUserId} FOR UPDATE`,
          );
          const [coach] = await transaction
            .select({
              accountStatus: users.status,
              approvedAt: coachProfiles.approvedAt,
              certificationWaivedAt: coachProfiles.certificationWaivedAt,
              availableDays: coachProfiles.availableDays,
              availableTimeSlots: coachProfiles.availableTimeSlots,
              activationExpiresAt: coachProfiles.activationExpiresAt,
            })
            .from(coachProfiles)
            .innerJoin(users, eq(users.id, coachProfiles.userId))
            .where(eq(coachProfiles.userId, targetUserId))
            .limit(1);
          if (!coach) {
            throw new HttpError(
              404,
              "coach_not_found",
              "Coach account not found.",
            );
          }
          if (coach.accountStatus === "closed") {
            throw new HttpError(
              409,
              "coach_account_closed",
              "A closed coach account cannot be activated.",
            );
          }
          if (coach.accountStatus === "suspended") {
            throw new HttpError(
              409,
              "coach_account_banned",
              "A banned coach account cannot be activated.",
            );
          }
          if (!hasCoachAvailability(coach)) {
            throw new HttpError(
              409,
              "coach_availability_required",
              "The coach must save at least one available day and time before activation.",
            );
          }

          const activatedAt = new Date();
          const periodEndsAt =
            coach.activationExpiresAt &&
            coach.activationExpiresAt > activatedAt
              ? coach.activationExpiresAt
              : addActivationPeriod(activatedAt);
          const certificationWaivedAt =
            coach.certificationWaivedAt ?? activatedAt;
          await transaction
            .update(coachProfiles)
            .set({
              activationExpiresAt: periodEndsAt,
              certificationWaivedAt,
              certificationWaivedByUserId: admin.id,
              updatedAt: activatedAt,
            })
            .where(eq(coachProfiles.userId, targetUserId));

          const active = isCoachProfileActive(
            {
              approvedAt: coach.approvedAt,
              certificationWaivedAt,
              activationExpiresAt: periodEndsAt,
            },
            activatedAt,
          );
          await transaction.insert(notifications).values({
            userId: targetUserId,
            type: "coach.activation_granted_by_admin",
            title: "Your profile is active",
            body: `An administrator activated your profile through ${periodEndsAt.toLocaleDateString("en-IN")} and waived the certification requirement. No activation fee was required.`,
            actionUrl: "/coach/activation",
            metadata: { periodEndsAt: periodEndsAt.toISOString() },
          });
          await transaction.insert(auditLogs).values({
            actorUserId: admin.id,
            action: "admin.coach_activated",
            targetType: "user",
            targetId: targetUserId,
            requestId,
            safeMetadata: {
              previousActivationExpiresAt:
                coach.activationExpiresAt?.toISOString() ?? null,
              periodEndsAt: periodEndsAt.toISOString(),
              feeRequired: false,
              certificationWaived: true,
            },
          });
          return { userId: targetUserId, periodEndsAt, active };
        });
        return { reference: targetUserId, value };
      },
    });
    return NextResponse.json({
      activation: result.value,
      replayed: result.replayed,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
