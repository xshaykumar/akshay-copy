import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, requestIdFrom } from "@/lib/http/errors";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);

  try {
    const user = await requireUser();
    return NextResponse.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        roles: user.roles,
        mfaVerified: user.aal === "aal2",
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
