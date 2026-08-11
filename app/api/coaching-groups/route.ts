import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs, coachingGroups } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { requireCurrentCoachServiceAccess } from "@/lib/coaches/service-access";
import { assertSameOrigin, jsonError, requestIdFrom } from "@/lib/http/errors";

const createSchema = z.object({ name: z.string().trim().min(2).max(80) });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const coach = await requireRole("coach");
    await requireCurrentCoachServiceAccess(coach.id);
    const input = createSchema.parse(await request.json());
    const created = await getDb().transaction(async (transaction) => {
      const [group] = await transaction.insert(coachingGroups).values({
        coachUserId: coach.id,
        name: input.name,
      }).returning();
      await transaction.insert(auditLogs).values({
        actorUserId: coach.id,
        action: "coaching_group.created",
        targetType: "coaching_group",
        targetId: group.id,
        requestId,
      });
      return group;
    });
    return NextResponse.json({ group: created }, { status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
