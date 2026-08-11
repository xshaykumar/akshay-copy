import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  coachProfiles,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
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
      scope: `admin-ban-coach:${targetUserId}`,
      key,
      requestHash: hashRequest({ targetUserId }),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT id FROM app.users WHERE id = ${targetUserId} FOR UPDATE`,
          );
          const [coach] = await transaction
            .select({ status: users.status })
            .from(users)
            .innerJoin(coachProfiles, eq(coachProfiles.userId, users.id))
            .where(eq(users.id, targetUserId))
            .limit(1);
          if (!coach) {
            throw new HttpError(404, "coach_not_found", "Coach account not found.");
          }
          if (coach.status === "closed") {
            throw new HttpError(409, "coach_account_closed", "The coach account is closed.");
          }
          if (coach.status === "suspended") {
            return { userId: targetUserId, status: "suspended" as const };
          }

          const [assignedClient] = await transaction
            .select({ id: coachAssignments.id })
            .from(coachAssignments)
            .where(
              and(
                eq(coachAssignments.coachUserId, targetUserId),
                eq(coachAssignments.status, "assigned"),
              ),
            )
            .limit(1);
          if (assignedClient) {
            throw new HttpError(
              409,
              "coach_has_assigned_clients",
              "This coach cannot be banned while they have an assigned client.",
            );
          }

          const changedAt = new Date();
          await transaction
            .update(users)
            .set({ status: "suspended", updatedAt: changedAt })
            .where(eq(users.id, targetUserId));
          await transaction
            .update(coachProfiles)
            .set({ acceptingClients: false, updatedAt: changedAt })
            .where(eq(coachProfiles.userId, targetUserId));
          await transaction.insert(auditLogs).values({
            actorUserId: admin.id,
            action: "admin.coach_banned",
            targetType: "user",
            targetId: targetUserId,
            requestId,
            safeMetadata: { previousStatus: coach.status },
          });
          return { userId: targetUserId, status: "suspended" as const };
        });
        return { reference: targetUserId, value };
      },
    });
    return NextResponse.json({
      account: result.value,
      replayed: result.replayed,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
