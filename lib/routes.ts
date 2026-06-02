import type { RouteAccess, UserRole } from "@/types";

export const publicNavPaths = [
  { key: "home" as const, path: "/" },
  { key: "explore" as const, path: "/explore" },
  { key: "about" as const, path: "/about" },
  { key: "courses" as const, path: "/courses" },
  { key: "batches" as const, path: "/batches" },
  { key: "contact" as const, path: "/contact" },
] as const;

export type PublicNavKey = (typeof publicNavPaths)[number]["key"];

export function dashboardPath(role: UserRole, locale: string) {
  return `/${locale}/${role}`;
}

export type AppRoute = {
  path: string;
  access: RouteAccess;
  roles?: UserRole[];
  label: string;
};

export const publicRoutes: AppRoute[] = [
  { path: "/", access: "public", label: "Home" },
  { path: "/about", access: "public", label: "About" },
  { path: "/explore", access: "public", label: "Explore" },
  { path: "/courses", access: "public", label: "Courses" },
  { path: "/batches", access: "public", label: "Batches" },
  { path: "/contact", access: "public", label: "Contact" },
  { path: "/faq", access: "public", label: "FAQ" },
];

export const authRoutes: AppRoute[] = [
  { path: "/login", access: "guest", label: "Login" },
  { path: "/register", access: "guest", label: "Register" },
  { path: "/register/teacher", access: "guest", label: "Teacher Register" },
];

export const protectedRoutes: AppRoute[] = [
  { path: "/student", access: "protected", roles: ["student"], label: "Student Dashboard" },
  { path: "/teacher", access: "protected", roles: ["teacher"], label: "Teacher Dashboard" },
  { path: "/admin", access: "protected", roles: ["admin"], label: "Admin Dashboard" },
];
