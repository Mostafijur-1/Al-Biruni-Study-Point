import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError } from "@/lib/auth/session";

export function success<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { message, details } },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return fail(error.message, error.status);
  }

  if (error instanceof ZodError) {
    return fail("Validation failed.", 400, error.flatten());
  }

  console.error("Unhandled API error", error);

  if (error instanceof Error) {
    if (error.message.includes("MONGODB_URI")) {
      return fail("Database is not configured.", 500);
    }
  }

  return fail("Internal server error.", 500);
}
