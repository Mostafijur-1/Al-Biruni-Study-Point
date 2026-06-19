import { redirect } from "next/navigation";
import { getLocalizedPath, type Locale } from "@/lib/i18n";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function TeacherDashboardPage({ params }: Props) {
  const { locale } = await params;
  redirect(getLocalizedPath("/teacher/results", locale));
}
