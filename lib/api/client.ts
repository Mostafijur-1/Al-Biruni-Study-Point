import type { ApiEnvelope, ApiFailure } from "@/types/api";

type FetchResult<T> = {
  ok: boolean;
  status: number;
  payload: ApiEnvelope<T>;
};

const defaultInit: RequestInit = { cache: "no-store" };

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  const response = await fetch(url, { ...defaultInit, ...init });
  const payload = (await response.json()) as ApiEnvelope<T>;
  return { ok: response.ok, status: response.status, payload };
}

export function isApiSuccess<T>(payload: ApiEnvelope<T>): payload is { success: true; data: T } {
  return payload.success === true;
}

export function getApiErrorMessage(
  payload: ApiEnvelope<unknown>,
  fallback = "Something went wrong.",
) {
  if (payload.success) {
    return fallback;
  }
  return (payload as ApiFailure).error.message || fallback;
}
