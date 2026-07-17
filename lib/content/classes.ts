import type { StudentClass } from "@/types";

export const STUDENT_CLASSES = [
  "class-9",
  "class-10",
  "class-11",
  "class-12",
] as const satisfies readonly StudentClass[];

export const CLASS_LABELS: Record<StudentClass, string> = {
  "class-9": "নবম শ্রেণি",
  "class-10": "দশম শ্রেণি",
  "class-11": "একাদশ শ্রেণি",
  "class-12": "দ্বাদশ শ্রেণি",
};

export function getClassLabel(studentClass: StudentClass, locale?: string) {
  void locale;
  return CLASS_LABELS[studentClass];
}

export function formatClassList(
  classes: StudentClass[] | undefined,
  locale?: string,
) {
  if (!classes?.length) {
    return "কোন শ্রেণি নির্ধারিত নয়";
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
