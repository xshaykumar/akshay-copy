import { and, eq, gt, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  coachAssignments,
  coachingGroupMembers,
  notifications,
  planPurchases,
  plans,
  users,
} from "@/db/schema";
import { requireGroupManager } from "@/lib/group-coaching";
import { assertSameOrigin, HttpError, jsonError, requestIdFrom } from "@/lib/http/errors";

const inputSchema = z.object({ assignmentId: z.uuid() });

async function contextValues(context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  return z.uuid().parse(groupId);
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const groupId = await contextValues(context);
    const { actor, group } = await requireGroupManager(groupId);
    const input = inputSchema.parse(await request.json());
    const [eligible] = await getDb().select({
      assignmentId: coachAssignments.id,
      clientUserId: coachAssignments.clientUserId,
      clientName: users.displayName,
    }).from(coachAssignments)
      .innerJoin(planPurchases, eq(planPurchases.id, coachAssignments.purchaseId))
      .innerJoin(plans, eq(plans.id, planPurchases.planId))
      .innerJoin(users, eq(users.id, coachAssignments.clientUserId))
      .where(and(
        eq(coachAssignments.id, input.assignmentId),
        eq(coachAssignments.coachUserId, group.coachUserId),
        eq(coachAssignments.status, "assigned"),
        eq(planPurchases.status, "active"),
        gt(planPurchases.expiresAt, new Date()),
        like(plans.code, "group-online-coaching-%"),
      )).limit(1);
    if (!eligible) {
      throw new HttpError(409, "client_not_eligible", "This client is not eligible for this group.");
    }

    try {
      await getDb().transaction(async (transaction) => {
        await transaction.insert(coachingGroupMembers).values({
          groupId,
          assignmentId: eligible.assignmentId,
          clientUserId: eligible.clientUserId,
        });
        await transaction.insert(auditLogs).values({
          actorUserId: actor.id,
          action: "coaching_group.member_added",
          targetType: "coaching_group",
          targetId: groupId,
          requestId,
          safeMetadata: { assignmentId: eligible.assignmentId, clientUserId: eligible.clientUserId },
        });
        await transaction.insert(notifications).values({
          userId: eligible.clientUserId,
          type: "coaching_group.joined",
          title: "Added to coaching group",
          body: `You were added to ${group.name}. New sessions will appear in your schedule.`,
          actionUrl: "/client/schedule",
          metadata: { groupId },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("more than 20")) {
        throw new HttpError(409, "group_full", "This group already has 20 members.");
      }
      if (message.includes("assignment_unique")) {
        throw new HttpError(409, "already_in_group", "This client is already in a coaching group.");
      }
      throw error;
    }
    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const groupId = await contextValues(context);
    const { actor, group } = await requireGroupManager(groupId);
    const input = inputSchema.parse(await request.json());
    const [removed] = await getDb().transaction(async (transaction) => {
      const rows = await transaction.delete(coachingGroupMembers).where(and(
        eq(coachingGroupMembers.groupId, groupId),
        eq(coachingGroupMembers.assignmentId, input.assignmentId),
      )).returning();
      if (rows[0]) {
        await transaction.insert(auditLogs).values({
          actorUserId: actor.id,
          action: "coaching_group.member_removed",
          targetType: "coaching_group",
          targetId: groupId,
          requestId,
          safeMetadata: { assignmentId: input.assignmentId, clientUserId: rows[0].clientUserId },
        });
        await transaction.insert(notifications).values({
          userId: rows[0].clientUserId,
          type: "coaching_group.left",
          title: "Removed from coaching group",
          body: `You are no longer a member of ${group.name}.`,
          actionUrl: "/client/schedule",
          metadata: { groupId },
        });
      }
      return rows;
    });
    if (!removed) throw new HttpError(404, "membership_not_found", "Group membership not found.");
    return NextResponse.json({ removed: true });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
