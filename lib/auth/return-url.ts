import { getLocalizedPath, parseLocalizedPath } from "@/lib/i18n";
import type { UserRole } from "@/types";

const AUTH_PATH_SEGMENTS = ["/login", "/register"];

function getSaferPostAuthUrl(value: string) {
  const { pathWithoutLocale } = parseLocalizedPath(value);

  if (/^\/student\/exams\/[^/]+/.test(pathWithoutLocale)) {
    return getLocalizedPath("/student/exams");
  }

  return value;
}

export function getSafeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  const pathOnly = value.split("?")[0] ?? value;

  if (AUTH_PATH_SEGMENTS.some((segment) => pathOnly.includes(segment))) {
    return null;
  }

  return getSaferPostAuthUrl(value);
}

export function resolvePostAuthRedirect(role: UserRole, returnUrl: string | null | undefined) {
  const safe = getSafeReturnUrl(returnUrl);

  if (!safe) {
    return getLocalizedPath(`/${role}`);
  }

  const { pathWithoutLocale } = parseLocalizedPath(safe);

  if (role === "student" && (pathWithoutLocale.startsWith("/student") || pathWithoutLocale.startsWith("/explore"))) {
    return safe;
  }

  if (role === "teacher" && pathWithoutLocale.startsWith("/teacher")) {
    return safe;
  }

  if (role === "admin" && pathWithoutLocale.startsWith("/admin")) {
    return safe;
  }

  return getLocalizedPath(`/${role}`);
}

export function buildLoginUrl(returnUrl?: string | null, reason?: string) {
  const params = new URLSearchParams();

  if (returnUrl) {
    const safe = getSafeReturnUrl(returnUrl);

    if (safe) {
      params.set("next", safe);
    }
  }

  if (reason) {
    params.set("reason", reason);
  }

  const query = params.toString();

  return getLocalizedPath(`/login`) + (query ? `?${query}` : "");
}

export function buildRegisterUrl(returnUrl?: string | null) {
  const params = new URLSearchParams();
  const safe = getSafeReturnUrl(returnUrl);

  if (safe) {
    params.set("next", safe);
  }

  const query = params.toString();

  return getLocalizedPath(`/register`) + (query ? `?${query}` : "");
}

