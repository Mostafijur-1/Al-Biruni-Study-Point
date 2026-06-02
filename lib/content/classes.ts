import type { StudentClass } from "@/types";

export const STUDENT_CLASSES = [
  "class-9",
  "class-10",
  "class-11",
  "class-12",
] as const satisfies readonly StudentClass[];

export const CLASS_LABELS: Record<StudentClass, { bn: string; en: string }> = {
  "class-9": { bn: "নবম শ্রেণি", en: "Class 9" },
  "class-10": { bn: "দশম শ্রেণি", en: "Class 10" },
  "class-11": { bn: "একাদশ শ্রেণি", en: "Class 11" },
  "class-12": { bn: "দ্বাদশ শ্রেণি", en: "Class 12" },
};

export function getClassLabel(studentClass: StudentClass, locale: "bn" | "en") {
  return CLASS_LABELS[studentClass][locale];
}

export function formatClassList(
  classes: StudentClass[] | undefined,
  locale: "bn" | "en",
) {
  if (!classes?.length) {
    return locale === "bn" ? "কোন শ্রেণি নির্ধারিত নয়" : "No class assigned";
  }

  return classes.map((item) => getClassLabel(item, locale)).join(", ");
}

export function classFilterForStudent(studentClass?: StudentClass) {
  if (!studentClass) {
    return null;
  }

  return { targetClasses: studentClass };
}

export function studentCanAccessClasses(
  targetClasses: StudentClass[] | undefined,
  studentClass?: StudentClass,
) {
  if (!studentClass) {
    return false;
  }

  if (!targetClasses?.length) {
    return false;
  }

  return targetClasses.includes(studentClass);
}
