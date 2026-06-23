import { RoutePlaceholder } from "@/components/shared/RoutePlaceholder";

type CourseDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { slug } = await params;

  return (
    <RoutePlaceholder
      eyebrow="Course detail"
      title={slug.replaceAll("-", " ")}
      description="Course overview, modules, current batches, tutor details, price, and enrollment CTA."
    />
  );
}
