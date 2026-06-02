import Link from "next/link";

import { getLocalizedPath, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const BRAND_MAIN = "আল-বিরুনি";
const BRAND_SUB = "স্টাডি পয়েন্ট";

type LogoTone = "onDark" | "onLight";

type LogoProps = {
  locale: Locale;
  size?: "sm" | "md" | "lg" | "hero";
  tone?: LogoTone;
  className?: string;
  link?: boolean;
};

const sizeStyles = {
  sm: {
    main: "text-lg sm:text-xl",
    sub: "text-[10px] sm:text-[11px]",
    gap: "mt-1",
  },
  md: {
    main: "text-xl sm:text-2xl",
    sub: "text-[11px] sm:text-xs",
    gap: "mt-1",
  },
  lg: {
    main: "text-2xl sm:text-3xl",
    sub: "text-xs sm:text-sm",
    gap: "mt-1.5",
  },
  hero: {
    main: "text-3xl sm:text-4xl md:text-[2.75rem]",
    sub: "text-sm sm:text-base",
    gap: "mt-1.5",
  },
} as const;

const palette = {
  onDark: {
    main: "text-[#faf7f2]",
    sub: "text-[#c9d4e3]",
  },
  onLight: {
    main: "text-[#0b2545]",
    sub: "text-[#5a6b7d]",
  },
} as const;

function LogoMark({ size, tone }: { size: keyof typeof sizeStyles; tone: LogoTone }) {
  const styles = sizeStyles[size];
  const colors = palette[tone];

  return (
    <span className={cn("inline-flex flex-col leading-none", styles.gap)}>
      <span className={cn("font-display font-bold tracking-tight", styles.main, colors.main)}>
        {BRAND_MAIN}
      </span>
      <span
        className={cn(
          "font-sans font-normal leading-tight tracking-[0.12em]",
          styles.sub,
          colors.sub,
        )}
      >
        {BRAND_SUB}
      </span>
    </span>
  );
}

export function Logo({
  locale,
  size = "md",
  tone = "onDark",
  className,
  link = true,
}: LogoProps) {
  const mark = <LogoMark size={size} tone={tone} />;

  if (!link) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)} aria-label={BRAND_MAIN}>
        {mark}
      </span>
    );
  }

  return (
    <Link
      href={getLocalizedPath("/", locale)}
      className={cn(
        "inline-flex shrink-0 items-center transition-opacity hover:opacity-90",
        className,
      )}
      aria-label={`${BRAND_MAIN} ${BRAND_SUB}`}
    >
      {mark}
    </Link>
  );
}
