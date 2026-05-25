import { CoursesCatalog } from "@/components/courses/CoursesCatalog";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n";

type CoursesPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CoursesPage({ params }: CoursesPageProps) {
  const { locale } = await params;
  const dict = getDictionary(locale as Locale);

  return <CoursesCatalog locale={locale as Locale} home={dict.home} />;
}
