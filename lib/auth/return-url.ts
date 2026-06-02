import { locales, type Locale } from "@/lib/i18n";
import type { UserRole } from "@/types";

const AUTH_PATH_SEGMENTS = ["/login", "/register"];

function getSaferPostAuthUrl(value: string) {
  const locale = value.split("/")[1] as Locale;
  const pathOnly = value.split("?")[0] ?? value;
  const pathWithoutLocale = pathOnly.slice(`/${locale}`.length) || "/";

  if (/^\/student\/exams\/[^/]+/.test(pathWithoutLocale)) {
    return `/${locale}/student/exams`;
  }

  return value;
}

export function getSafeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  const locale = value.split("/")[1];

  if (!locales.includes(locale as Locale)) {
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
    const locale = locales[0];
    return `/${locale}/${role}`;
  }

  const locale = safe.split("/")[1] as Locale;
  const pathWithoutLocale = safe.slice(`/${locale}`.length) || "/";

  if (role === "student" && (pathWithoutLocale.startsWith("/student") || pathWithoutLocale.startsWith("/explore"))) {
    return safe;
  }

  if (role === "teacher" && pathWithoutLocale.startsWith("/teacher")) {
    return safe;
  }

  if (role === "admin" && pathWithoutLocale.startsWith("/admin")) {
    return safe;
  }

  return `/${locale}/${role}`;
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

  return `/${locale}/login${query ? `?${query}` : ""}`;
}

export function buildRegisterUrl(locale: Locale, returnUrl?: string | null) {
  const params = new URLSearchParams();
  const safe = getSafeReturnUrl(returnUrl);

  if (safe) {
    params.set("next", safe);
  }

  const query = params.toString();

  return `/${locale}/register${query ? `?${query}` : ""}`;
}
