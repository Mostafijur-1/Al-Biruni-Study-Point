import type { StudentClass } from "../../types";
import { COURSE_TO_MCQ_SUBJECT_MAP } from "../content/syllabus.ts";

export type TeacherDomainRuleInput = {
  isAll: boolean;
  classes: StudentClass[];
  subjects: string[];
};

export function areClassesWithinTeacherDomain(
  domain: TeacherDomainRuleInput | null | undefined,
  targetClasses: StudentClass[],
): boolean {
  if (domain?.isAll) return targetClasses.length > 0;
  return Boolean(
    domain &&
    targetClasses.length > 0 &&
    targetClasses.every((studentClass) => domain.classes.includes(studentClass)),
  );
}

export function doTargetClassesMatchLevel(
  level: "SSC" | "HSC",
  targetClasses: StudentClass[],
): boolean {
  const levelClasses: StudentClass[] = level === "SSC"
    ? ["class-9", "class-10"]
    : ["class-11", "class-12"];
  return targetClasses.length > 0 && targetClasses.every((item) => levelClasses.includes(item));
}

export function isExamWithinTeacherDomain(
  domain: TeacherDomainRuleInput | null | undefined,
  subject: string,
  targetClasses: StudentClass[],
): boolean {
  if (domain?.isAll) return true;
  if (!domain || !areClassesWithinTeacherDomain(domain, targetClasses)) return false;

  const allowedSubjects = new Set<string>(domain.subjects);
  for (const level of ["ssc", "hsc"] as const) {
    const mapping = COURSE_TO_MCQ_SUBJECT_MAP[level] || {};
    for (const subjectKey of domain.subjects) {
      for (const mapped of mapping[subjectKey] ?? []) allowedSubjects.add(mapped);
    }
  }
  return allowedSubjects.has(subject);
}
