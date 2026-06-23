import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-lg border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-secondary text-secondary-foreground",
      destructive:
        "border-red-200 bg-red-50 text-red-800 " +
        "dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
      success:
        "border-emerald-200 bg-emerald-50 text-emerald-800 " +
        "dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert, alertVariants };
