export const locales = ["bn", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "bn";

export function getLocalizedPath(path: string, locale: Locale = defaultLocale) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}`;
}
