"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, LogOut, User } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboardPath } from "@/lib/routes";
import { getLocalizedPath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { SessionUser } from "@/types";

type UserMenuProps = {
  locale: Locale;
  user: SessionUser;
  auth: Dictionary["auth"];
  onLogout: () => void;
  mobile?: boolean;
};

export function UserMenu({ locale, user, auth, onLogout, mobile }: UserMenuProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      onLogout();
      window.dispatchEvent(new Event("absp-auth-changed"));
      router.push(getLocalizedPath("/", locale));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const roleLabel =
    user.role === "student"
      ? auth.roles.student
      : user.role === "teacher"
        ? auth.roles.teacher
        : auth.roles.admin;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (mobile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-yellow text-sm font-bold text-accent-foreground">
            {initials}
          </span>
          <div>
            <p className="font-bold text-white">{user.name}</p>
            <p className="text-xs uppercase tracking-wide text-white/70">{roleLabel}</p>
          </div>
        </div>
        <Link
          href={dashboardPath(user.role, locale)}
          className={cn(buttonVariants({ variant: "accent", size: "lg" }), "w-full justify-center")}
        >
          <LayoutDashboard className="size-4" />
          {auth.dashboard}
        </Link>
        <Button
          variant="secondary"
          size="lg"
          className="w-full border-white/30 bg-transparent text-white hover:bg-white/10"
          onClick={handleLogout}
          loading={loading}
        >
          <LogOut className="size-4" />
          {auth.logout}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/60 px-2 py-1.5 md:flex">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          {initials}
        </span>
        <div className="max-w-[100px] leading-tight lg:max-w-[120px]">
          <p className="truncate text-xs font-bold text-foreground">{user.name}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{roleLabel}</p>
        </div>
      </div>

      <Link
        href={dashboardPath(user.role, locale)}
        className={cn(buttonVariants({ variant: "navy", size: "sm" }))}
      >
        <LayoutDashboard className="size-4" />
        <span className="hidden sm:inline">{auth.dashboard}</span>
      </Link>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        loading={loading}
        title={auth.logout}
        className="text-muted"
      >
        <LogOut className="size-4" />
        <span className="sr-only sm:not-sr-only sm:inline">{auth.logout}</span>
      </Button>
    </div>
  );
}

export function GuestAuthLinks({
  locale,
  navigation,
  mobile,
}: {
  locale: Locale;
  navigation: Dictionary["navigation"];
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <>
        <Link
          href={getLocalizedPath("/login", locale)}
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "w-full justify-center border-white/30 bg-transparent text-white hover:bg-white/10",
          )}
        >
          <User className="size-4" />
          {navigation.login}
        </Link>
        <Link
          href={getLocalizedPath("/register", locale)}
          className={cn(buttonVariants({ size: "lg" }), "w-full justify-center")}
        >
          {navigation.register}
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href={getLocalizedPath("/login", locale)}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
      >
        <User className="size-4" />
        {navigation.login}
      </Link>
      <Link href={getLocalizedPath("/register", locale)} className={cn(buttonVariants({ size: "sm" }))}>
        {navigation.register}
      </Link>
    </>
  );
}
