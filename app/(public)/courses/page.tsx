import { CoursesCatalog } from "@/components/courses/CoursesCatalog";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse ABSP courses and learning resources for SSC and HSC students.",
  alternates: { canonical: "/courses" },
};

export default async function CoursesPage() {
  const dict = getDictionary();

  return <CoursesCatalog home={dict.home} />;
}
