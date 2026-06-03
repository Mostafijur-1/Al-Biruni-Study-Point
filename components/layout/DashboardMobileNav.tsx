"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  UserCircle,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const linksByRole: Record<UserRole, NavItem[]> = {
  student: [
    { href: "/student", label: "Home", icon: LayoutDashboard },
    { href: "/student/courses", label: "Courses", icon: BookOpen },
    { href: "/student/exams", label: "Exams", icon: FileQuestion },
    { href: "/student/assignments", label: "CQ", icon: ClipboardCheck },
    { href: "/student/results", label: "Results", icon: GraduationCap },
  ],
  teacher: [
    { href: "/teacher", label: "Home", icon: LayoutDashboard },
    { href: "/teacher/classes", label: "Classes", icon: BookOpen },
    { href: "/teacher/mcq", label: "MCQ", icon: FileQuestion },
    { href: "/teacher/review-cq", label: "CQ", icon: ClipboardCheck },
  ],
  admin: [
    { href: "/admin", label: "Home", icon: LayoutDashboard },
    { href: "/admin/students", label: "Students", icon: Users },
    { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
    { href: "/admin/courses", label: "Courses", icon: BookOpen },
    { href: "/admin/exams", label: "Exams", icon: FileQuestion },
  ],
};

function roleFromPathname(pathname: string): UserRole {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.includes("admin")) return "admin";
  if (segments.includes("teacher")) return "teacher";
  return "student";
}

export function DashboardMobileNav({ locale }: { locale: string }) {
  const pathname = usePathname();
  const role = roleFromPathname(pathname);
  const links = linksByRole[role];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface px-1 py-1 shadow-[0_-4px_20px_rgb(11_37_69_/_0.08)] md:hidden"
      aria-label="Dashboard navigation"
    >
      <ul className="flex items-stretch justify-around gap-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const fullHref = `/${locale}${href}`;
          const isRoleRoot = href === `/${role}`;
          const active =
            pathname === fullHref ||
            (!isRoleRoot && pathname.startsWith(`${fullHref}/`));

          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={fullHref}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-semibold transition",
                  active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-secondary hover:text-primary",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DashboardSidebar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const role = roleFromPathname(pathname);

  const allLinks: Record<UserRole, NavItem[]> = {
    student: [
      { href: "/student", label: "Overview", icon: LayoutDashboard },
      { href: "/student/profile", label: "Profile", icon: UserCircle },
      { href: "/student/courses", label: "Courses", icon: BookOpen },
      { href: "/student/exams", label: "Exams", icon: FileQuestion },
      { href: "/student/assignments", label: "CQ", icon: ClipboardCheck },
      { href: "/student/results", label: "Results", icon: GraduationCap },
    ],
    teacher: [
      { href: "/teacher", label: "Overview", icon: LayoutDashboard },
      { href: "/teacher/profile", label: "Profile", icon: UserCircle },
      { href: "/teacher/classes", label: "Classes", icon: BookOpen },
      { href: "/teacher/mcq", label: "MCQ Exams", icon: FileQuestion },
      { href: "/teacher/review-cq", label: "Review CQ", icon: ClipboardCheck },
    ],
    admin: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/profile", label: "Profile", icon: UserCircle },
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
      { href: "/admin/courses", label: "Courses", icon: BookOpen },
      { href: "/admin/exams", label: "Exams & results", icon: FileQuestion },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  };

  const links = allLinks[role];

  return (
    <aside className="hidden rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-sm)] md:block">
      <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-accent">Menu</p>
      <nav className="mt-1 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const fullHref = `/${locale}${href}`;
          const isRoleRoot = href === `/${role}`;
          const active =
            pathname === fullHref ||
            (!isRoleRoot && pathname.startsWith(`${fullHref}/`));

          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:bg-secondary hover:text-primary",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
