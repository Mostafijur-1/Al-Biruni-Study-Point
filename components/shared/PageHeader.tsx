import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="rounded-xl border border-border border-l-4 border-l-brand-yellow bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-2xs font-bold uppercase tracking-widest text-accent sm:text-xs">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display mt-1 text-xl font-bold leading-tight text-primary sm:text-2xl md:text-3xl">
            {title}
          </h1>
          {description && (
            <div className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {description}
            </div>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
