import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError } from "@/lib/auth/session";
import {
  apiErrorCodeForStatus,
  createRequestId,
  type ApiErrorCode,
} from "@/lib/api-error";

export function success<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(
  message: string,
  status = 400,
  details?: unknown,
  code: ApiErrorCode = apiErrorCodeForStatus(status),
  requestId = createRequestId(),
) {
  const response = NextResponse.json(
    { success: false, error: { message, code, details, requestId } },
    { status },
  );
  response.headers.set("X-Request-ID", requestId);
  return response;
}

export function handleApiError(error: unknown) {
  const requestId = createRequestId();

  if (error instanceof AuthError) {
    return fail(error.message, error.status, undefined, apiErrorCodeForStatus(error.status), requestId);
  }

  if (error instanceof ZodError) {
    return fail("Validation failed.", 400, error.flatten(), "VALIDATION_ERROR", requestId);
  }

  if (error instanceof Error) {
    if (error.message.includes("MONGODB_URI")) {
      console.error("API request failed", {
        requestId,
        name: error.name,
        message: "Database configuration is missing.",
      });
      return fail("Database is not configured.", 500, undefined, "INTERNAL_ERROR", requestId);
    }
  }

  console.error("API request failed", {
    requestId,
    name: error instanceof Error ? error.name : "UnknownError",
    message: "Unhandled server error.",
  });

  return fail("Internal server error.", 500, undefined, "INTERNAL_ERROR", requestId);
}
