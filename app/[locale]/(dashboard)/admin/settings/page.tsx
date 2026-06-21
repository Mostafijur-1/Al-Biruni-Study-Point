import { redirect } from "next/navigation";
import { getLocalizedPath, type Locale } from "@/lib/i18n";

type AdminSettingsPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminSettingsPage({ params }: AdminSettingsPageProps) {
  const { locale } = await params;
  redirect(getLocalizedPath("/admin/practice-mcqs", locale));
}
