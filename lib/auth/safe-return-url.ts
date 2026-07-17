export type RedirectRole = "student" | "teacher" | "admin";

const LOCAL_ORIGIN = "https://return.local";
const AUTH_SEGMENTS = new Set(["login", "register"]);

export function sanitizeLocalReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.includes("\\")) return null;

  const pathOnly = value.split("?")[0]?.split("#")[0] || "/";
  if (/%(?:2f|5c)/i.test(pathOnly)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value, LOCAL_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== LOCAL_ORIGIN) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.some((segment) => AUTH_SEGMENTS.has(segment.toLowerCase()))) return null;

  return value;
}

export function isReturnPathAllowedForRole(role: RedirectRole, path: string): boolean {
  if (role === "student") return path === "/student" || path.startsWith("/student/");
  if (role === "teacher") return path === "/teacher" || path.startsWith("/teacher/");
  return path === "/admin" || path.startsWith("/admin/");
}
