import { redirect } from "next/navigation";
import { getLocalizedPath } from "@/lib/i18n";

type Props = {
  searchParams: Promise<{ level?: string }>;
};

export default async function StudentDashboardPage({ searchParams }: Props) {
  const { level } = await searchParams;
  const query = level ? `?level=${level}` : "";
  redirect(getLocalizedPath(`/student/practice${query}`));
}

