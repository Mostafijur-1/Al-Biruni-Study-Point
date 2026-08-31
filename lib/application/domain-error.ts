import { ApiRouteError, type ApiErrorCode } from "@/lib/api-error";

export class DomainError extends ApiRouteError {
  constructor(message: string, status = 400, code?: ApiErrorCode, details?: unknown) {
    super(message, status, code, details);
    this.name = "DomainError";
  }
}
