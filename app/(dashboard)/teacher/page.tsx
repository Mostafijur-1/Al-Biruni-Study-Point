import { redirect } from "next/navigation";
import { getLocalizedPath } from "@/lib/i18n";

export default function TeacherDashboardPage() {
  redirect(getLocalizedPath("/teacher/results"));
}

