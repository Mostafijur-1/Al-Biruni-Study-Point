import type { ApiEnvelope, ApiFailure } from "@/types/api";

type FetchResult<T> = {
  ok: boolean;
  status: number;
  payload: ApiEnvelope<T>;
};

const defaultInit: RequestInit = { cache: "no-store" };

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url, { ...defaultInit, ...init });
    const payload = (await response.json()) as ApiEnvelope<T>;
    return { ok: response.ok, status: response.status, payload };
  } catch (error: unknown) {
    // Log the actual network / parse failure details to console
    console.error("[API Network/Fetch Failure Technical Details]:", error);

    const message = error instanceof Error ? error.message : "Failed to fetch resource";
    const failedPayload: ApiEnvelope<T> = {
      success: false,
      error: {
        message,
        code: "NETWORK_ERROR",
      },
    };
    return { ok: false, status: 503, payload: failedPayload };
  }
}

export function isApiSuccess<T>(payload: ApiEnvelope<T>): payload is { success: true; data: T } {
  return payload.success === true;
}

const hasBangla = (text: string) => /[\u0980-\u09FF]/.test(text);

export function getApiErrorMessage(
  payload: ApiEnvelope<unknown>,
  fallback = "Something went wrong.",
) {
  if (payload.success) {
    return fallback;
  }

  const rawError = (payload as ApiFailure).error || {};
  const techMsg = rawError.message || "";
  const code = rawError.code || "";

  // Log the actual detailed technical error to developer console
  console.error("[API Error Technical Details]:", {
    code,
    message: techMsg,
    details: rawError.details,
  });

  const lowerMsg = techMsg.toLowerCase();
  const lowerCode = code.toLowerCase();
  const isBn = hasBangla(fallback) || hasBangla(techMsg);

  // 1. Authentication & Authorization
  if (
    lowerCode.includes("auth") ||
    lowerCode.includes("login") ||
    lowerCode.includes("permission") ||
    lowerMsg.includes("unauthorized") ||
    lowerMsg.includes("forbidden") ||
    lowerMsg.includes("access denied") ||
    lowerMsg.includes("not authenticated") ||
    lowerMsg.includes("sign in")
  ) {
    return isBn
      ? "এই তথ্যটি দেখতে আপনার অনুমতি নেই অথবা আপনাকে আবার লগ ইন করতে হবে।"
      : "You do not have permission or need to log in to access this resource.";
  }

  // 2. Input / Validation
  if (
    lowerCode.includes("validation") ||
    lowerCode.includes("invalid") ||
    lowerMsg.includes("validation") ||
    lowerMsg.includes("invalid") ||
    lowerMsg.includes("required") ||
    lowerMsg.includes("missing")
  ) {
    return isBn
      ? "আপনার দেওয়া তথ্যে কিছু ভুল বা অসম্পূর্ণতা রয়েছে। অনুগ্রহ করে চেক করে আবার চেষ্টা করুন।"
      : "Some details you entered are invalid or incomplete. Please verify your inputs.";
  }

  // 3. Server / Database / Connection
  if (
    lowerCode.includes("server") ||
    lowerCode.includes("db") ||
    lowerCode.includes("mongo") ||
    lowerMsg.includes("database") ||
    lowerMsg.includes("connection") ||
    lowerMsg.includes("mongo") ||
    lowerMsg.includes("internal server") ||
    lowerMsg.includes("failed to fetch") ||
    lowerCode.includes("network")
  ) {
    return isBn
      ? "সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
      : "We're having trouble connecting to our services. Please check your connection or try again later.";
  }

  // 4. Default clean error message (use fallback or a clean generic string)
  return fallback || (isBn ? "একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।" : "An unexpected issue occurred. Please try again.");
}
