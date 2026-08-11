import "server-only";

import { and, eq, gt, like } from "drizzle-orm";
import { getDb } from "@/db";
import {
  coachAssignments,
  coachingGroupMembers,
  coachingGroups,
  planPurchases,
  plans,
} from "@/db/schema";
import { requireRole, requireUser } from "@/lib/auth/session";
import { requireCurrentCoachServiceAccess } from "@/lib/coaches/service-access";
import { HttpError } from "@/lib/http/errors";

export const GROUP_PLAN_CODE_PREFIX = "group-online-coaching-";

export async function requireGroupManager(groupId: string) {
  const actor = await requireUser();
  if (actor.roles.includes("admin")) {
    await requireRole("admin");
  } else if (!actor.roles.includes("coach")) {
    throw new HttpError(403, "role_required", "Coach or administrator access is required.");
  } else {
    await requireCurrentCoachServiceAccess(actor.id);
  }

  const [group] = await getDb()
    .select()
    .from(coachingGroups)
    .where(eq(coachingGroups.id, groupId))
    .limit(1);
  if (!group || (!actor.roles.includes("admin") && group.coachUserId !== actor.id)) {
    throw new HttpError(404, "group_not_found", "Coaching group not found.");
  }
  return { actor, group, isAdmin: actor.roles.includes("admin") };
}

export async function getEligibleGroupMembers(groupId: string) {
  const now = new Date();
  return getDb()
    .select({
      assignmentId: coachingGroupMembers.assignmentId,
      clientUserId: coachingGroupMembers.clientUserId,
      purchaseExpiresAt: planPurchases.expiresAt,
    })
    .from(coachingGroupMembers)
    .innerJoin(coachingGroups, eq(coachingGroups.id, coachingGroupMembers.groupId))
    .innerJoin(coachAssignments, and(
      eq(coachAssignments.id, coachingGroupMembers.assignmentId),
      eq(coachAssignments.clientUserId, coachingGroupMembers.clientUserId),
      eq(coachAssignments.coachUserId, coachingGroups.coachUserId),
      eq(coachAssignments.status, "assigned"),
    ))
    .innerJoin(planPurchases, and(
      eq(planPurchases.id, coachAssignments.purchaseId),
      eq(planPurchases.clientUserId, coachingGroupMembers.clientUserId),
      eq(planPurchases.status, "active"),
      gt(planPurchases.expiresAt, now),
    ))
    .innerJoin(plans, and(
      eq(plans.id, planPurchases.planId),
      like(plans.code, `${GROUP_PLAN_CODE_PREFIX}%`),
    ))
    .where(eq(coachingGroupMembers.groupId, groupId));
}
