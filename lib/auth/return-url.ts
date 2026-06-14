import { locales, type Locale, getLocalizedPath, parseLocalizedPath, defaultLocale } from "@/lib/i18n";
import type { UserRole } from "@/types";

const AUTH_PATH_SEGMENTS = ["/login", "/register"];

function getSaferPostAuthUrl(value: string) {
  const { locale, pathWithoutLocale } = parseLocalizedPath(value);

  if (/^\/student\/exams\/[^/]+/.test(pathWithoutLocale)) {
    return getLocalizedPath("/student/exams", locale);
  }

  return value;
}

export function getSafeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  const { locale } = parseLocalizedPath(value);

  if (!locales.includes(locale)) {
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
    return getLocalizedPath(`/${role}`, defaultLocale);
  }

  const { locale, pathWithoutLocale } = parseLocalizedPath(safe);

  if (role === "student" && (pathWithoutLocale.startsWith("/student") || pathWithoutLocale.startsWith("/explore"))) {
    return safe;
  }

  if (role === "teacher" && pathWithoutLocale.startsWith("/teacher")) {
    return safe;
  }

  if (role === "admin" && pathWithoutLocale.startsWith("/admin")) {
    return safe;
  }

  return getLocalizedPath(`/${role}`, locale);
}

export function buildLoginUrl(locale: Locale, returnUrl?: string | null, reason?: string) {
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

  return getLocalizedPath(`/login`, locale) + (query ? `?${query}` : "");
}

export function buildRegisterUrl(locale: Locale, returnUrl?: string | null) {
  const params = new URLSearchParams();
  const safe = getSafeReturnUrl(returnUrl);

  if (safe) {
    params.set("next", safe);
  }

  const query = params.toString();

  return getLocalizedPath(`/register`, locale) + (query ? `?${query}` : "");
}
