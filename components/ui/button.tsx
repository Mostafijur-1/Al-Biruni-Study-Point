"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { buttonVariants, type ButtonVariantProps } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type Ripple = {
  id: number;
  x: number;
  y: number;
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
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
        className={cn(buttonVariants({ variant, size, className }), loading && "cursor-wait")}
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

export { Button };
