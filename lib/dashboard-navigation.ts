import type { UserRole } from "../types";

export const dashboardTopLevelRoutes = {
  student: [
    "/student/profile",
    "/student/practice",
    "/student/exams",
    "/student/results",
  ],
  teacher: [
    "/teacher",
    "/teacher/classes",
    "/teacher/mcq-review",
    "/teacher/exams",
    "/teacher/results",
    "/teacher/profile",
  ],
  admin: [
    "/admin",
    "/admin/students",
    "/admin/teachers",
    "/admin/practice-mcqs",
    "/admin/profile",
  ],
} as const satisfies Record<UserRole, readonly string[]>;

export function isTopLevelDashboardRoute(role: UserRole, href: string): boolean {
  return dashboardTopLevelRoutes[role].some((route) => route === href);
}
