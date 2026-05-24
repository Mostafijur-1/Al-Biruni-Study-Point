import type { RouteAccess, UserRole } from "@/types";

export type AppRoute = {
  path: string;
  access: RouteAccess;
  roles?: UserRole[];
  label: string;
};

export const publicRoutes: AppRoute[] = [
  { path: "/", access: "public", label: "Home" },
  { path: "/about", access: "public", label: "About" },
  { path: "/courses", access: "public", label: "Courses" },
  { path: "/batches", access: "public", label: "Batches" },
  { path: "/contact", access: "public", label: "Contact" },
  { path: "/faq", access: "public", label: "FAQ" },
];

export const authRoutes: AppRoute[] = [
  { path: "/login", access: "guest", label: "Login" },
  { path: "/register", access: "guest", label: "Register" },
];

export const protectedRoutes: AppRoute[] = [
  { path: "/student", access: "protected", roles: ["student"], label: "Student Dashboard" },
  { path: "/teacher", access: "protected", roles: ["teacher"], label: "Teacher Dashboard" },
  { path: "/admin", access: "protected", roles: ["admin"], label: "Admin Dashboard" },
];
