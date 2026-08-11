import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  consultations,
  notifications,
  userRoles,
} from "@/db/schema";
import {
  assertSameOrigin,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";
import {
  hashRequest,
  requireIdempotencyKey,
  runIdempotent,
} from "@/lib/idempotency";

const indianMobileSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .refine(
    (value) => /^(?:\+91|91)?[6-9]\d{9}$/.test(value),
    "Enter a valid Indian mobile number.",
  )
  .transform((value) => `+91${value.slice(-10)}`);

const consultationSchema = z.object({
  contactName: z.string().trim().min(2).max(80),
  contactPhone: indianMobileSchema,
  goalCategory: z.string().trim().min(2).max(500),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const input = consultationSchema.parse(await request.json());
    const key = requireIdempotencyKey(request);
    const result = await runIdempotent({
      scope: `consultation:${input.contactPhone}`,
      key,
      requestHash: hashRequest(input),
      operation: async () => {
        const value = await getDb().transaction(async (transaction) => {
          const [consultation] = await transaction
            .insert(consultations)
            .values(input)
            .returning({
              id: consultations.id,
              status: consultations.status,
            });
          const admins = await transaction
            .select({ userId: userRoles.userId })
            .from(userRoles)
            .where(eq(userRoles.role, "admin"));
          if (admins.length > 0) {
            await transaction.insert(notifications).values(
              admins.map((admin) => ({
                userId: admin.userId,
                type: "admin.consultation_requested",
                title: "New consultation request",
                body: `${input.contactName} requested a free consultation. Contact ${input.contactPhone}.`,
                actionUrl: "/admin/consultations",
                metadata: {
                  consultationId: consultation.id,
                },
              })),
            );
          }
          return {
            consultation,
          };
        });
        return { reference: value.consultation.id, value };
      },
    });
    const [consultation] = await getDb()
      .select({
        id: consultations.id,
        status: consultations.status,
      })
      .from(consultations)
      .where(eq(consultations.id, result.reference))
      .limit(1);
    return NextResponse.json(
      {
        consultation,
        replayed: result.replayed,
        message:
          "Thank you. Your free consultation request has been submitted. A 360 Performance mentor will contact you shortly on your mobile number.",
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
