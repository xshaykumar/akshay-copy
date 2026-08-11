import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { appLogger } from "@/lib/logging/logger";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "invalid_origin", "Request origin is not allowed.");
  }
}

export function jsonError(error: unknown, requestId: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message }, requestId },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fields[field]) {
        fields[field] = issue.message;
      }
    }
    const details = Object.entries(fields)
      .slice(0, 4)
      .map(([field, message]) => {
        const label = field
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/^./, (character) => character.toUpperCase());
        return `${label}: ${message}`;
      })
      .join(" ");
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: details
            ? `Please correct the following fields. ${details}`
            : "Please correct the highlighted fields.",
          fields,
        },
        requestId,
      },
      { status: 400 },
    );
  }

  const nestedCode =
    error instanceof Error &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    typeof error.cause.code === "string"
      ? error.cause.code
      : undefined;
  appLogger.error("request_failed", {
    requestId,
    errorCode:
      nestedCode ??
      (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : error instanceof Error
          ? error.constructor.name
          : "internal_error"),
  });

  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "The request could not be completed.",
      },
      requestId,
    },
    { status: 500 },
  );
}

export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
