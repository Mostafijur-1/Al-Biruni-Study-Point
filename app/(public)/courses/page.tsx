import { CoursesCatalog } from "@/components/courses/CoursesCatalog";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function CoursesPage() {
  const dict = getDictionary();

  return <CoursesCatalog home={dict.home} />;
}

