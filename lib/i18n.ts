export const locales = ["bn", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "bn";

export function getLocalizedPath(path: string, locale: Locale = defaultLocale) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (locale === "bn") {
    return normalizedPath;
  }
  return `/en${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function createLocalizedPath(locale: Locale) {
  return (path: string) => getLocalizedPath(path, locale);
}

export function parseLocalizedPath(urlOrPath: string): { locale: Locale; pathWithoutLocale: string } {
  // Extract path only, removing query parameters and hashes
  const pathOnly = urlOrPath.split("?")[0].split("#")[0];
  
  let locale: Locale = "bn";
  let cleanPath = pathOnly;

  if (pathOnly.startsWith("/en") && (pathOnly.length === 3 || pathOnly[3] === "/")) {
    locale = "en";
    cleanPath = pathOnly.substring(3) || "/";
  } else if (pathOnly.startsWith("/bn") && (pathOnly.length === 3 || pathOnly[3] === "/")) {
    locale = "bn";
    cleanPath = pathOnly.substring(3) || "/";
  }

  // Preserve the query and hash if they were present in the original urlOrPath
  const queryAndHash = urlOrPath.slice(pathOnly.length);
  
  return {
    locale,
    pathWithoutLocale: cleanPath + queryAndHash,
  };
}
