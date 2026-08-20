import { randomUUID } from "node:crypto";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "GONE"
  | "PAYLOAD_TOO_LARGE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "ATTENDANCE_NOT_ELIGIBLE"
  | "ATTENDANCE_ROSTER_CHANGED"
  | "ATTENDANCE_UNMARKED_STUDENTS"
  | "ATTENDANCE_ALREADY_SUBMITTED"
  | "ATTENDANCE_VERSION_CONFLICT"
  | "ATTENDANCE_CORRECTION_FORBIDDEN"
  | "IDEMPOTENCY_KEY_REUSED"
  | "COACHING_PRICING_MISSING"
  | "INTERNAL_ERROR"
  | "REQUEST_FAILED";

export class ApiRouteError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: unknown;

  constructor(
    message: string,
    status = 400,
    code: ApiErrorCode = apiErrorCodeForStatus(status),
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function apiErrorCodeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 405:
      return "METHOD_NOT_ALLOWED";
    case 409:
      return "CONFLICT";
    case 410:
      return "GONE";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 422:
      return "VALIDATION_ERROR";
    case 429:
      return "RATE_LIMITED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
  }
}

export function createRequestId(): string {
  return randomUUID();
}
