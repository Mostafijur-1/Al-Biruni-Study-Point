import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ level?: string }>;
};

export default async function StudentDashboardPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { level } = await searchParams;
  const query = level ? `?level=${level}` : "";
  redirect(`/${locale}/student/practice${query}`);
}
