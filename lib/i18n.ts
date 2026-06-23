export type Locale = "bn";

export function getLocalizedPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function createLocalizedPath(locale?: string) {
  return (path: string) => path.startsWith("/") ? path : `/${path}`;
}

export function parseLocalizedPath(urlOrPath: string): { pathWithoutLocale: string } {
  // Extract path only, removing query parameters and hashes
  const pathOnly = urlOrPath.split("?")[0].split("#")[0];
  
  let cleanPath = pathOnly;

  if (pathOnly.startsWith("/bn") && (pathOnly.length === 3 || pathOnly[3] === "/")) {
    cleanPath = pathOnly.substring(3) || "/";
  }

  // Preserve the query and hash if they were present in the original urlOrPath
  const queryAndHash = urlOrPath.slice(pathOnly.length);
  
  return {
    pathWithoutLocale: cleanPath + queryAndHash,
  };
}

