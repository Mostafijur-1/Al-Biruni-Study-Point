type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-4 rounded-xl border border-border border-l-4 border-l-brand-yellow bg-card p-4 shadow-[var(--shadow-sm)] sm:mb-6 sm:p-6">
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{eyebrow}</p>
      )}
      <h1 className="font-display mt-1 text-xl font-bold text-primary sm:text-2xl md:text-3xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      )}
    </div>
  );
}
