"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useGuestLevel } from "@/lib/hooks/use-guest-level";
import {
  BarChart3,
  BookOpen,
  Brain,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  UserCircle,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If true, append ?level=<current> when navigating */
  levelAware?: boolean;
};

const linksByRole: Record<UserRole, NavItem[]> = {
  student: [
    { href: "/student/courses", label: "Home", icon: LayoutDashboard, levelAware: true },
    { href: "/student/courses", label: "Courses", icon: BookOpen, levelAware: true },
    { href: "/student/practice", label: "MCQ test", icon: Brain, levelAware: true },
    { href: "/student/results", label: "Results", icon: GraduationCap },
  ],
  teacher: [
    { href: "/teacher", label: "Home", icon: LayoutDashboard },
    { href: "/teacher/classes", label: "Classes", icon: BookOpen },
    { href: "/teacher/results", label: "Results", icon: LineChart },
  ],
  admin: [
    { href: "/admin", label: "Home", icon: LayoutDashboard },
    { href: "/admin/students", label: "Students", icon: Users },
    { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
    { href: "/admin/courses", label: "Courses", icon: BookOpen },
    { href: "/admin/exams", label: "Exams", icon: FileQuestion },
    { href: "/admin/practice-mcqs", label: "Practice MCQs", icon: Brain },
  ],
};

function roleFromPathname(pathname: string): UserRole {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.includes("admin")) return "admin";
  if (segments.includes("teacher")) return "teacher";
  return "student";
}

function buildHref(href: string, locale: string, level: "SSC" | "HSC", levelAware?: boolean) {
  const levelSuffix = levelAware ? `?level=${level}` : "";
  return `/${locale}${href}${levelSuffix}`;
}

export function DashboardMobileNav({ locale }: { locale: string }) {
  const pathname = usePathname();
  const level = useGuestLevel();
  const role = roleFromPathname(pathname);
  const links = linksByRole[role];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface px-1 py-1 shadow-[0_-4px_20px_rgb(11_37_69_/_0.08)] md:hidden"
      aria-label="Dashboard navigation"
    >
      <ul className="flex items-stretch justify-around gap-0.5">
        {links.map(({ href, label, icon: Icon, levelAware }, idx) => {
          const fullHref = buildHref(href, locale, level, levelAware);
          const fullHrefBase = `/${locale}${href}`;
          const isRoleRoot = href === `/${role}`;
          const active =
            pathname === fullHrefBase ||
            (!isRoleRoot && pathname.startsWith(`${fullHrefBase}/`));

          return (
            <li key={`${href}-${idx}`} className="min-w-0 flex-1">
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
  const level = useGuestLevel();
  const role = roleFromPathname(pathname);

  const allLinks: Record<UserRole, NavItem[]> = {
    student: [
      // { href: "/student/courses", label: "Overview", icon: LayoutDashboard, levelAware: true },
      { href: "/student/profile", label: "Profile", icon: UserCircle },
     // { href: "/student/courses", label: "Courses", icon: BookOpen, levelAware: true },
      { href: "/student/practice", label: "MCQ test", icon: Brain, levelAware: true },
      { href: "/student/results", label: "Results", icon: GraduationCap },
    ],
    teacher: [
      //{ href: "/teacher", label: "Overview", icon: LayoutDashboard },
      { href: "/teacher/profile", label: "Profile", icon: UserCircle },
     // { href: "/teacher/classes", label: "Classes", icon: BookOpen },
      { href: "/teacher/results", label: "Results", icon: LineChart },
    ],
    admin: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/profile", label: "Profile", icon: UserCircle },
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
      //{ href: "/admin/courses", label: "Courses", icon: BookOpen },
      //{ href: "/admin/exams", label: "Exams & results", icon: FileQuestion },
      { href: "/admin/practice-mcqs", label: "Practice MCQs", icon: Brain },
      //{ href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  };

  const links = allLinks[role];

  return (
    <aside className="hidden rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-sm)] md:block">
      <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-accent">Menu</p>
      <nav className="mt-1 space-y-0.5">
        {links.map(({ href, label, icon: Icon, levelAware }, idx) => {
          const fullHref = buildHref(href, locale, level, levelAware);
          const fullHrefBase = `/${locale}${href}`;
          const isRoleRoot = href === `/${role}`;
          const active =
            pathname === fullHrefBase ||
            (!isRoleRoot && pathname.startsWith(`${fullHrefBase}/`));

          return (
            <Link
              key={`${href}-${idx}`}
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
