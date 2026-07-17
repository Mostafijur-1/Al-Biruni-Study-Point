import { RoutePlaceholder } from "@/components/shared/RoutePlaceholder";
import type { Metadata } from "next";

type CourseDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replaceAll("-", " ");

  return {
    title,
    description: `Course details, enrollment information, and learning modules for ${title}.`,
    alternates: { canonical: `/courses/${slug}` },
  };
}

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
