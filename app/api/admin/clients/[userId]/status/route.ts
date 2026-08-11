import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  assessments,
  auditLogs,
  clientProfiles,
  notifications,
  users,
} from "@/db/schema";
import { hasClientAvailability } from "@/lib/assessments/pre-coaching";
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

const statusSchema = z.object({
  decision: z.enum(["activate", "deactivate"]),
});

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
    const input = statusSchema.parse(await request.json());
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `admin-client-status:${targetUserId}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          await transaction.execute(
            sql`SELECT id FROM app.users WHERE id = ${targetUserId} FOR UPDATE`,
          );
          const [client] = await transaction
            .select({ status: users.status })
            .from(users)
            .innerJoin(clientProfiles, eq(clientProfiles.userId, users.id))
            .where(eq(users.id, targetUserId))
            .limit(1);
          if (!client) {
            throw new HttpError(404, "client_not_found", "Client account not found.");
          }

          if (input.decision === "activate") {
            const [latestAssessment] = await transaction
              .select({ responses: assessments.responses })
              .from(assessments)
              .where(eq(assessments.clientUserId, targetUserId))
              .orderBy(desc(assessments.version))
              .limit(1);
            if (!hasClientAvailability(latestAssessment?.responses)) {
              throw new HttpError(
                409,
                "client_availability_required",
                "The client must enter training days and a preferred training time before activation.",
              );
            }
          }

          const nextStatus =
            input.decision === "activate" ? "active" : "suspended";
          if (client.status === nextStatus) {
            return { userId: targetUserId, status: nextStatus };
          }
          if (client.status === "closed") {
            throw new HttpError(
              409,
              "client_account_closed",
              "A closed client account cannot be reactivated.",
            );
          }

          await transaction
            .update(users)
            .set({ status: nextStatus, updatedAt: new Date() })
            .where(eq(users.id, targetUserId));
          if (nextStatus === "active") {
            await transaction.insert(notifications).values({
              userId: targetUserId,
              type: "account.activated_by_admin",
              title: "Your account is active",
              body: "An administrator activated your account.",
              actionUrl: "/client",
              metadata: {},
            });
          }
          await transaction.insert(auditLogs).values({
            actorUserId: admin.id,
            action: `admin.client_${input.decision}d`,
            targetType: "user",
            targetId: targetUserId,
            requestId,
            safeMetadata: {
              previousStatus: client.status,
              nextStatus,
            },
          });
          return { userId: targetUserId, status: nextStatus };
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
