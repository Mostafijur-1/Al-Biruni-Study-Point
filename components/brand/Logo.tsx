import Image from "next/image";
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
    mark: "size-15 sm:size-16",
    main: "text-xl sm:text-2xl",
    sub: "text-[11px] sm:text-xs",
    gap: "mt-1",
    spacing: "gap-2",
  },
  md: {
    mark: "size-18 sm:size-20 lg:size-19",
    main: "text-2xl sm:text-3xl lg:text-[1.7rem]",
    sub: "text-xs sm:text-sm lg:text-[0.8rem]",
    gap: "mt-1",
    spacing: "gap-2.5",
  },
  lg: {
    mark: "size-22 sm:size-24",
    main: "text-3xl sm:text-4xl",
    sub: "text-sm sm:text-base",
    gap: "mt-1.5",
    spacing: "gap-3",
  },
  hero: {
    mark: "size-22 sm:size-24 md:size-28",
    main: "text-3xl sm:text-4xl md:text-[2.75rem]",
    sub: "text-sm sm:text-base",
    gap: "mt-1.5",
    spacing: "gap-3 md:gap-4",
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
    <span className={cn("inline-flex items-center", styles.spacing)}>
      <span className={cn("relative shrink-0 overflow-hidden rounded-md", styles.mark)}>
        <Image
          src="/absp-emblem.png"
          alt=""
          fill
          sizes="(max-width: 640px) 44px, 64px"
          className="object-contain"
          priority
        />
      </span>
      <span className={cn("inline-flex flex-col leading-none", styles.gap)}>
        <span className={cn("font-display font-bold", styles.main, colors.main)}>
          {BRAND_MAIN}
        </span>
        <span
          className={cn(
            "font-sans font-normal leading-tight",
            styles.sub,
            colors.sub,
          )}
        >
          {BRAND_SUB}
        </span>
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
