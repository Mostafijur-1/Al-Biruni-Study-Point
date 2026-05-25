import Image from "next/image";
import Link from "next/link";

import { getLocalizedPath, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/absp-logo.png";

type LogoProps = {
  locale: Locale;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
  priority?: boolean;
  link?: boolean;
};

const sizeMap = {
  sm: { width: 160, height: 48, className: "h-9 w-auto max-w-[160px] sm:h-10 sm:max-w-[180px]" },
  md: { width: 200, height: 60, className: "h-10 w-auto max-w-[200px] sm:h-12 sm:max-w-[240px]" },
  lg: { width: 260, height: 78, className: "h-12 w-auto max-w-[260px] sm:h-14 sm:max-w-[300px]" },
  hero: { width: 320, height: 96, className: "h-auto w-full max-w-[320px] sm:max-w-[400px]" },
};

export function Logo({
  locale,
  size = "md",
  className,
  priority,
  link = true,
}: LogoProps) {
  const dims = sizeMap[size];

  const image = (
    <Image
      src={LOGO_SRC}
      alt="ABSP - Al Biruni Study Point Science Coaching Center"
      width={dims.width}
      height={dims.height}
      priority={priority}
      className={cn(dims.className, "rounded-md object-contain object-left")}
    />
  );

  if (!link) {
    return <span className={cn("inline-flex shrink-0 items-center", className)}>{image}</span>;
  }

  return (
    <Link
      href={getLocalizedPath("/", locale)}
      className={cn("inline-flex shrink-0 items-center", className)}
      aria-label="ABSP - Al-Biruni Study Point"
    >
      {image}
    </Link>
  );
}
