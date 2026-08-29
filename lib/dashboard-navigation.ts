import type { UserRole } from "../types";

export const dashboardTopLevelRoutes = {
  student: [
    "/student",
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
    "/admin/attendance",
    "/admin/routine",
    "/admin/academic",
    "/admin/finance",
    "/admin/practice-mcqs",
    "/admin/settings",
    "/admin/profile",
  ],
} as const satisfies Record<UserRole, readonly string[]>;

export function isTopLevelDashboardRoute(role: UserRole, href: string): boolean {
  return dashboardTopLevelRoutes[role].some((route) => route === href);
}
