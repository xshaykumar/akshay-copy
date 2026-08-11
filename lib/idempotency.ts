import "server-only";

import { createHash } from "node:crypto";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { HttpError } from "@/lib/http/errors";

export function hashRequest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function runIdempotent<T>(options: {
  scope: string;
  key: string;
  requestHash: string;
  operation: () => Promise<{ reference: string; value: T }>;
}): Promise<{ replayed: boolean; value?: T; reference: string }> {
  const db = getDb();
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + 30_000);
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [claim] = await db
    .insert(idempotencyKeys)
    .values({
      scope: options.scope,
      key: options.key,
      requestHash: options.requestHash,
      lockedUntil,
      expiresAt,
    })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (!claim) {
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.scope, options.scope),
          eq(idempotencyKeys.key, options.key),
        ),
      )
      .limit(1);

    if (!existing || existing.requestHash !== options.requestHash) {
      throw new HttpError(
        409,
        "idempotency_conflict",
        "The idempotency key was used for another request.",
      );
    }

    if (existing.completedAt && existing.responseReference) {
      return {
        replayed: true,
        reference: existing.responseReference,
      };
    }

    if (existing.lockedUntil && existing.lockedUntil > now) {
      throw new HttpError(
        409,
        "request_in_progress",
        "An identical request is already in progress.",
      );
    }

    const [reclaimed] = await db
      .update(idempotencyKeys)
      .set({ lockedUntil })
      .where(
        and(
          eq(idempotencyKeys.scope, options.scope),
          eq(idempotencyKeys.key, options.key),
          gt(idempotencyKeys.expiresAt, now),
          or(
            isNull(idempotencyKeys.lockedUntil),
            lte(idempotencyKeys.lockedUntil, now),
          ),
        ),
      )
      .returning({ key: idempotencyKeys.key });

    if (!reclaimed) {
      throw new HttpError(
        409,
        "idempotency_expired",
        "Use a new idempotency key.",
      );
    }
  }

  try {
    const result = await options.operation();
    await db
      .update(idempotencyKeys)
      .set({
        responseCode: "200",
        responseReference: result.reference,
        completedAt: new Date(),
        lockedUntil: null,
      })
      .where(
        and(
          eq(idempotencyKeys.scope, options.scope),
          eq(idempotencyKeys.key, options.key),
        ),
      );

    return { replayed: false, ...result };
  } catch (error) {
    await db
      .update(idempotencyKeys)
      .set({ lockedUntil: new Date(0) })
      .where(
        and(
          eq(idempotencyKeys.scope, options.scope),
          eq(idempotencyKeys.key, options.key),
        ),
      );
    throw error;
  }
}

export function requireIdempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[a-zA-Z0-9._:-]{8,128}$/.test(key)) {
    throw new HttpError(
      400,
      "idempotency_key_required",
      "A valid Idempotency-Key header is required.",
    );
  }
  return key;
}
