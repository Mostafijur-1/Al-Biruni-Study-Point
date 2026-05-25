import { PageHeader } from "@/components/shared/PageHeader";

type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function RoutePlaceholder({ eyebrow, title, description }: RoutePlaceholderProps) {
  return (
    <section className="px-0">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-10 text-center text-sm text-muted sm:px-6 sm:py-12">
        Content coming soon.
      </div>
    </section>
  );
}
