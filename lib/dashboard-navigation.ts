import type { UserRole } from "../types";

export const studentToolRoutes = [
  "/student/coach",
  "/student/learning",
  "/student/mistakes",
  "/student/focus",
  "/student/goals",
  "/student/labs",
  "/student/formulas",
  "/student/challenge",
  "/student/game",
  "/student/community",
] as const;

export const dashboardTopLevelRoutes = {
  student: [
    "/student",
    "/student/courses",
    "/student/practice",
    "/student/exams",
    "/student/results",
    "/student/tools",
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
    "/admin/academic",
    "/admin/profile",
  ],
} as const satisfies Record<UserRole, readonly string[]>;

export function isTopLevelDashboardRoute(role: UserRole, href: string): boolean {
  return dashboardTopLevelRoutes[role].some((route) => route === href);
}

export function isStudentToolRoute(pathname: string): boolean {
  return studentToolRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
