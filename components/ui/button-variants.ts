import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Shared press feedback for buttons and button-styled links (safe for Server Components) */
export const pressableClasses =
  "transition-all duration-150 ease-out select-none active:scale-[0.98] active:brightness-95 [-webkit-tap-highlight-color:transparent]";

export const buttonVariants = cva(
  cn(
    "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg text-sm font-semibold",
    pressableClasses,
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
  ),
  {
    variants: {
      variant: {
        default: "bg-brand-red text-white shadow-sm hover:bg-brand-red-hover",
        secondary:
          "border-2 border-primary bg-surface text-primary hover:bg-secondary " +
          "dark:border-border dark:text-foreground dark:bg-surface dark:hover:bg-secondary/70",
        accent: "bg-brand-yellow text-accent-foreground shadow-sm hover:bg-accent-hover",
        navy: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        ghost:
          "text-muted hover:bg-secondary hover:text-primary " +
          "dark:hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "text-brand-red underline-offset-4 hover:underline active:scale-100",
        outline:
          "border border-border bg-surface text-primary shadow-sm hover:border-primary hover:bg-secondary " +
          "dark:text-foreground dark:hover:border-border dark:hover:bg-secondary/70",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
