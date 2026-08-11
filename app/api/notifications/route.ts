import { and, count, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { createDueNotificationsForUser } from "@/lib/notifications/due";
import {
  assertSameOrigin,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), notificationId: z.uuid() }),
  z.object({ action: z.literal("read_all") }),
]);

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await requireUser();
    await createDueNotificationsForUser(user.id);
    const [rows, [unread]] = await Promise.all([
      getDb()
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50),
      getDb()
        .select({ value: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, user.id),
            isNull(notifications.readAt),
          ),
        ),
    ]);
    return NextResponse.json({
      notifications: rows,
      unreadCount: unread.value,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = updateSchema.parse(await request.json());
    const readAt = new Date();
    if (input.action === "read_all") {
      await getDb()
        .update(notifications)
        .set({ readAt })
        .where(
          and(
            eq(notifications.userId, user.id),
            isNull(notifications.readAt),
          ),
        );
    } else {
      await getDb()
        .update(notifications)
        .set({ readAt })
        .where(
          and(
            eq(notifications.id, input.notificationId),
            eq(notifications.userId, user.id),
            isNull(notifications.readAt),
          ),
        );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
