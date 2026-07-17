import { getLocalizedPath, parseLocalizedPath } from "@/lib/i18n";
import { isReturnPathAllowedForRole, sanitizeLocalReturnUrl } from "@/lib/auth/safe-return-url";
import type { UserRole } from "@/types";

function getSaferPostAuthUrl(value: string) {
  const { pathWithoutLocale } = parseLocalizedPath(value);

  if (/^\/student\/exams\/[^/]+/.test(pathWithoutLocale)) {
    return getLocalizedPath("/student/exams");
  }

  return value;
}

export function getSafeReturnUrl(value: string | null | undefined): string | null {
  const safe = sanitizeLocalReturnUrl(value);
  return safe ? getSaferPostAuthUrl(safe) : null;
}

export function resolvePostAuthRedirect(role: UserRole, returnUrl: string | null | undefined) {
  const safe = getSafeReturnUrl(returnUrl);

  if (!safe) {
    return getLocalizedPath(`/${role}`);
  }

  const { pathWithoutLocale } = parseLocalizedPath(safe);

  if (isReturnPathAllowedForRole(role, pathWithoutLocale)) {
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
