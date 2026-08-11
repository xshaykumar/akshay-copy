import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  assessmentReports,
  assessments,
  notifications,
} from "@/db/schema";
import {
  preCoachingDraftResponsesSchema,
  preCoachingResponsesSchema,
} from "@/lib/assessments/pre-coaching";
import { requireRole } from "@/lib/auth/session";
import {
  assertSameOrigin,
  HttpError,
  jsonError,
  requestIdFrom,
} from "@/lib/http/errors";

const assessmentSchema = z.object({
  status: z.enum(["draft", "submitted"]),
  responses: z.unknown(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await requireRole("client");
    const rows = await getDb()
      .select()
      .from(assessments)
      .where(eq(assessments.clientUserId, user.id))
      .orderBy(desc(assessments.createdAt));
    return NextResponse.json({ assessments: rows });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireRole("client");
    const input = assessmentSchema.parse(await request.json());
    const responses =
      input.status === "submitted"
        ? preCoachingResponsesSchema.parse(input.responses)
        : preCoachingDraftResponsesSchema.parse(input.responses);
    if (Buffer.byteLength(JSON.stringify(responses), "utf8") > 64 * 1024) {
      throw new HttpError(
        413,
        "assessment_payload_too_large",
        "The assessment response is too large.",
      );
    }
    const result = await getDb().transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`,
      );
      const [current] = await transaction
        .select()
        .from(assessments)
        .where(eq(assessments.clientUserId, user.id))
        .orderBy(desc(assessments.version))
        .limit(1);

      if (
        input.status === "submitted" &&
        responses.hasMedicalCondition &&
        !responses.medicalDetails?.trim()
      ) {
        const [report] = current?.status === "draft"
          ? await transaction
              .select({ id: assessmentReports.id })
              .from(assessmentReports)
              .where(eq(assessmentReports.assessmentId, current.id))
              .limit(1)
          : [];
        if (!report) {
          throw new HttpError(
            400,
            "medical_context_required",
            "Describe your medical condition or upload a report before submitting.",
          );
        }
      }

      if (current?.status === "draft") {
        const [updated] = await transaction
          .update(assessments)
          .set({
            status: input.status,
            responses,
            submittedAt: input.status === "submitted" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(assessments.id, current.id))
          .returning({
            id: assessments.id,
            status: assessments.status,
            createdAt: assessments.createdAt,
          });
        if (input.status === "submitted") {
          await transaction.insert(notifications).values({
            userId: user.id,
            type: "assessment.submitted",
            title: "Health assessment saved",
            body: "Your assessment is saved. You can review your plans or update the assessment at any time.",
            actionUrl: "/client/plan#available-plans",
            metadata: { assessmentId: updated.id },
          });
        }
        return { assessment: updated, created: false };
      }
      const [created] = await transaction
        .insert(assessments)
        .values({
          clientUserId: user.id,
          version: (current?.version ?? 0) + 1,
          status: input.status,
          responses,
          submittedAt: input.status === "submitted" ? new Date() : null,
        })
        .returning({
          id: assessments.id,
          status: assessments.status,
          createdAt: assessments.createdAt,
        });
      if (input.status === "submitted") {
        await transaction.insert(notifications).values({
          userId: user.id,
          type: "assessment.submitted",
          title: "Health assessment saved",
          body: "Your assessment is saved. You can review your plans or update the assessment at any time.",
          actionUrl: "/client/plan#available-plans",
          metadata: { assessmentId: created.id },
        });
      }
      return { assessment: created, created: true };
    });
    return NextResponse.json(
      { assessment: result.assessment },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
