"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Shared press feedback for buttons and button-styled links */
export const pressableClasses =
  "transition-all duration-150 ease-out select-none active:scale-[0.98] active:brightness-95 [-webkit-tap-highlight-color:transparent]";

const buttonVariants = cva(
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
        secondary: "border-2 border-primary bg-surface text-primary hover:bg-secondary",
        accent: "bg-brand-yellow text-accent-foreground shadow-sm hover:bg-accent-hover",
        navy: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        ghost: "text-muted hover:bg-secondary hover:text-primary",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "text-brand-red underline-offset-4 hover:underline active:scale-100",
        outline:
          "border border-border bg-surface text-primary shadow-sm hover:border-primary hover:bg-secondary",
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

type Ripple = {
  id: number;
  x: number;
  y: number;
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, onClick, type = "button", ...props }, ref) => {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        const rect = event.currentTarget.getBoundingClientRect();
        const id = Date.now();
        setRipples((current) => [
          ...current,
          { id, x: event.clientX - rect.left, y: event.clientY - rect.top },
        ]);
        window.setTimeout(() => {
          setRipples((current) => current.filter((ripple) => ripple.id !== id));
        }, 550);
      }
      onClick?.(event);
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onClick={handleClick}
        className={cn(
          buttonVariants({ variant, size, className }),
          loading && "cursor-wait",
        )}
        {...props}
      >
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="pointer-events-none absolute animate-btn-ripple rounded-full bg-white/40"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 12,
              height: 12,
              transform: "translate(-50%, -50%)",
            }}
            aria-hidden
          />
        ))}
        {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}
        <span className={cn("inline-flex items-center gap-2", loading && "opacity-90")}>
          {children}
        </span>
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
