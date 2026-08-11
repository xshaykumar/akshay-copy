import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userRoles, users } from "@/db/schema";
import { HttpError } from "@/lib/http/errors";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "client" | "coach" | "admin";

export type AuthenticatedAppUser = {
  id: string;
  authUserId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  username: string;
  status: "pending_verification" | "active" | "suspended" | "closed";
  roles: AppRole[];
  aal: "aal1" | "aal2" | null;
};

export async function getCurrentAppUser(): Promise<AuthenticatedAppUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    return null;
  }

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      authUserId: users.authUserId,
      displayName: users.displayName,
      contactPhone: users.contactPhone,
      username: users.username,
      status: users.status,
      role: userRoles.role,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .where(
      and(eq(users.authUserId, authUser.id), isNull(users.deletedAt)),
    );

  if (rows.length === 0) {
    return null;
  }

  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const first = rows[0];
  const currentLevel = assurance?.currentLevel;
  const aal: "aal1" | "aal2" | null =
    currentLevel === "aal1" || currentLevel === "aal2"
      ? (currentLevel as "aal1" | "aal2")
      : null;

  return {
    id: first.id,
    authUserId: first.authUserId,
    email: authUser.email ?? null,
    phone: first.contactPhone ?? authUser.phone ?? null,
    displayName: first.displayName,
    username: first.username,
    status: first.status,
    roles: rows.flatMap((row) => (row.role ? [row.role] : [])),
    aal,
  };
}

export async function requireUser() {
  const user = await getCurrentAppUser();

  if (!user) {
    throw new HttpError(401, "authentication_required", "Sign in is required.");
  }

  if (user.status !== "active") {
    throw new HttpError(403, "account_inactive", "This account is not active.");
  }

  return user;
}

export async function requireRole(role: AppRole) {
  const user = await requireUser();

  if (!user.roles.includes(role)) {
    throw new HttpError(403, "insufficient_permission", "Access is not allowed.");
  }

  if (role === "admin" && user.aal !== "aal2") {
    throw new HttpError(403, "mfa_required", "Multi-factor authentication is required.");
  }

  return user;
}

export async function requirePageRole(role: AppRole) {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect(`/login?next=/${role}`);
  }

  if (user.status !== "active") {
    redirect("/login?error=account-inactive");
  }

  if (!user.roles.includes(role)) {
    const destination = user.roles.includes("admin")
      ? "/admin"
      : user.roles.includes("coach")
        ? "/coach"
        : "/client";
    redirect(destination);
  }

  if (role === "admin" && user.aal !== "aal2") {
    redirect("/mfa");
  }

  return user;
}
