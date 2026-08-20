import Image from "next/image";
import Link from "next/link";

import { getLocalizedPath } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const BRAND_NAME = "Al-Biruni Study Point";

type LogoTone = "onDark" | "onLight" | "dynamic";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "hero";
  tone?: LogoTone;
  className?: string;
  link?: boolean;
};

const sizeStyles = {
  sm: "size-14 sm:size-16",
  md: "size-20 sm:size-24",
  lg: "size-28 sm:size-32",
  hero: "size-32 sm:size-40 md:size-48",
} as const;

function LogoMark({ size }: { size: keyof typeof sizeStyles }) {
  return (
    <span
      className={cn(
        "relative block shrink-0",
        sizeStyles[size],
      )}
    >
      <Image
        src="/absp-logo.png"
        alt=""
        fill
        sizes="(max-width: 640px) 160px, 192px"
        className="object-contain"
        priority
      />
    </span>
  );
}

export function Logo({
  size = "md",
  className,
  link = true,
}: LogoProps) {
  const mark = <LogoMark size={size} />;

  if (!link) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center", className)}
        aria-label={BRAND_NAME}
      >
        {mark}
      </span>
    );
  }

  return (
    <Link
      href={getLocalizedPath("/")}
      className={cn(
        "inline-flex shrink-0 items-center transition-opacity hover:opacity-90",
        className,
      )}
      aria-label={BRAND_NAME}
    >
      {mark}
    </Link>
  );
}
