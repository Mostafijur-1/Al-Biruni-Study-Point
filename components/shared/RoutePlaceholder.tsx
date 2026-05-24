type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
}: RoutePlaceholderProps) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 lg:px-6">
      <div className="rounded border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-accent">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold text-primary md:text-4xl">{title}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-muted">{description}</p>
      </div>
    </section>
  );
}
