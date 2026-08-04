"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Brain,
  ClipboardList,
  Compass,
  FileQuestion,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Map,
  MoreHorizontal,
  NotebookPen,
  Swords,
  Sigma,
  Target,
  TimerReset,
  UserCircle,
  Users,
  UsersRound,
  X,
} from "lucide-react";

import { useGuestLevel } from "@/lib/hooks/use-guest-level";
import { useSession } from "@/lib/hooks/use-session";
import { getLocalizedPath } from "@/lib/i18n";
import {
  isStudentToolRoute,
  isTopLevelDashboardRoute,
} from "@/lib/dashboard-navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  levelAware?: boolean;
  mobilePrimary?: boolean;
};

const navigationByRole: Record<UserRole, NavItem[]> = {
  student: [
    { href: "/student", label: "শিক্ষার্থী হোম", icon: Home, mobilePrimary: true },
    { href: "/student/coach", label: "স্টাডি কোচ", icon: Compass },
    { href: "/student/learning", label: "শেখার প্ল্যান", icon: Map },
    { href: "/student/mistakes", label: "ভুলের খাতা", icon: NotebookPen },
    { href: "/student/game", label: "গেম হাব", icon: Gamepad2 },
    { href: "/student/challenge", label: "ডেইলি চ্যালেঞ্জ", icon: Swords },
    { href: "/student/focus", label: "ফোকাস স্টুডিও", icon: TimerReset },
    { href: "/student/goals", label: "সাপ্তাহিক লক্ষ্য", icon: Target },
    { href: "/student/labs", label: "সায়েন্স ল্যাব", icon: FlaskConical },
    { href: "/student/formulas", label: "ফর্মুলা স্প্রিন্ট", icon: Sigma },
    { href: "/student/community", label: "ক্লাস কমিউনিটি", icon: UsersRound },
    {
      href: "/student/courses",
      label: "কোর্স ও ক্লাস",
      icon: BookOpen,
      levelAware: true,
      mobilePrimary: true,
    },
    {
      href: "/student/practice",
      label: "MCQ প্র্যাকটিস",
      icon: Brain,
      levelAware: true,
      mobilePrimary: true,
    },
    {
      href: "/student/exams",
      label: "MCQ পরীক্ষা",
      icon: FileQuestion,
      mobilePrimary: true,
    },
    { href: "/student/assignments", label: "অ্যাসাইনমেন্ট", icon: ClipboardList },
    { href: "/student/results", label: "ফলাফল", icon: GraduationCap },
    { href: "/student/profile", label: "প্রোফাইল", icon: UserCircle },
    { href: "/student/tools", label: "শেখার সরঞ্জাম", icon: LayoutGrid },
  ],
  teacher: [
    { href: "/teacher", label: "হোম", icon: Home, mobilePrimary: true },
    { href: "/teacher/classes", label: "ক্লাস কনটেন্ট", icon: BookOpen },
    {
      href: "/teacher/mcq-review",
      label: "MCQ রিভিউ",
      icon: Brain,
      mobilePrimary: true,
    },
    {
      href: "/teacher/exams",
      label: "MCQ পরীক্ষা",
      icon: FileQuestion,
      mobilePrimary: true,
    },
    {
      href: "/teacher/results",
      label: "ফলাফল",
      icon: LineChart,
      mobilePrimary: true,
    },
    { href: "/teacher/profile", label: "প্রোফাইল", icon: UserCircle },
  ],
  admin: [
    {
      href: "/admin",
      label: "ওভারভিউ",
      icon: LayoutDashboard,
      mobilePrimary: true,
    },
    {
      href: "/admin/students",
      label: "শিক্ষার্থী",
      icon: Users,
      mobilePrimary: true,
    },
    {
      href: "/admin/teachers",
      label: "শিক্ষক",
      icon: GraduationCap,
      mobilePrimary: true,
    },
    {
      href: "/admin/practice-mcqs",
      label: "সেটিংস",
      icon: Brain,
      mobilePrimary: true,
    },
    { href: "/admin/profile", label: "প্রোফাইল", icon: UserCircle },
  ],
};

function roleFromPathname(pathname: string): UserRole {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.includes("admin")) return "admin";
  if (segments.includes("teacher")) return "teacher";
  return "student";
}

function isNavActive(pathname: string, href: string, role: UserRole) {
  const localizedBase = getLocalizedPath(href);
  const isRoleRoot = href === `/${role}`;
  if (role === "student" && href === "/student/tools" && isStudentToolRoute(pathname)) {
    return true;
  }
  return (
    pathname === localizedBase ||
    (!isRoleRoot && pathname.startsWith(`${localizedBase}/`))
  );
}

function buildHref(
  href: string,
  level: "SSC" | "HSC",
  levelAware?: boolean,
) {
  return getLocalizedPath(`${href}${levelAware ? `?level=${level}` : ""}`);
}

function useDashboardNavigation() {
  const pathname = usePathname();
  const guestLevel = useGuestLevel();
  const { user } = useSession();
  const level =
    user?.studentClass === "class-11" || user?.studentClass === "class-12"
      ? "HSC"
      : user?.studentClass
        ? "SSC"
        : guestLevel;
  const role = roleFromPathname(pathname);

  return {
    pathname,
    level,
    role,
    links: navigationByRole[role].filter((item) =>
      isTopLevelDashboardRoute(role, item.href),
    ),
  };
}

export function DashboardMobileNav() {
  const { pathname, level, role, links } = useDashboardNavigation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const primaryLinks = links.filter((item) => item.mobilePrimary).slice(0, 4);
  const secondaryLinks = links.filter((item) => !item.mobilePrimary);
  const secondaryActive = secondaryLinks
    .some((item) => isNavActive(pathname, item.href, role));

  useEffect(() => {
    const timeout = window.setTimeout(() => setMoreOpen(false), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = moreButtonRef.current;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    );
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="মেনু বন্ধ করুন"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-more-title"
            className="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-hidden rounded-t-3xl border-t border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-2xs font-black uppercase tracking-widest text-accent">
                  ড্যাশবোর্ড
                </p>
                <h2
                  id="dashboard-more-title"
                  className="mt-0.5 text-lg font-black text-primary"
                >
                  আরও ফিচার
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMoreOpen(false)}
                className="grid size-11 place-items-center rounded-xl border border-border bg-secondary text-primary"
                aria-label="মেনু বন্ধ করুন"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav
              className="grid max-h-[calc(78dvh-5rem)] grid-cols-2 gap-2 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
              aria-label="আরও ড্যাশবোর্ড ফিচার"
            >
              {secondaryLinks.map(({ href, label, icon: Icon, levelAware }) => {
                const active = isNavActive(pathname, href, role);
                return (
                  <Link
                    key={href}
                    href={buildHref(href, level, levelAware)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-primary hover:bg-secondary",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="min-w-0 leading-tight">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </section>
        </div>
      )}

      <nav
        data-dashboard-mobile-nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-1 pt-1 shadow-[0_-4px_20px_rgb(11_37_69_/_0.08)] backdrop-blur-md pb-[max(.25rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="ড্যাশবোর্ড নেভিগেশন"
      >
        <ul className="grid grid-cols-5 gap-0.5">
          {primaryLinks.map(({ href, label, icon: Icon, levelAware }) => {
            const active = isNavActive(pathname, href, role);
            return (
              <li key={href} className="min-w-0">
                <Link
                  href={buildHref(href, level, levelAware)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold leading-tight transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted hover:bg-secondary hover:text-primary",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="w-full truncate text-center">
                    {label.replace("শিক্ষার্থী ", "").replace("MCQ ", "")}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold leading-tight transition",
                secondaryActive || moreOpen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-secondary hover:text-primary",
              )}
            >
              <MoreHorizontal className="size-4 shrink-0" />
              <span>আরও</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

export function DashboardSidebar() {
  const { pathname, level, role, links } = useDashboardNavigation();

  return (
    <aside className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] self-start overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-sm)] lg:block">
      <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-accent">
        নেভিগেশন
      </p>
      <nav className="mt-1 space-y-0.5" aria-label="ড্যাশবোর্ড নেভিগেশন">
        {links.map(({ href, label, icon: Icon, levelAware }) => {
          const active = isNavActive(pathname, href, role);
          return (
            <Link
              key={href}
              href={buildHref(href, level, levelAware)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:bg-secondary hover:text-primary",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
