import { redirect } from "next/navigation";
import { getLocalizedPath } from "@/lib/i18n";

export default function AdminSettingsPage() {
  redirect(getLocalizedPath("/admin/practice-mcqs"));
}

