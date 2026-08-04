import type { StudentClass } from "../../types";
import { COURSE_TO_MCQ_SUBJECT_MAP } from "../content/syllabus.ts";

export type TeacherDomainRuleInput = {
  isAll: boolean;
  classes: StudentClass[];
  subjects: string[];
};

export function isExamWithinTeacherDomain(
  domain: TeacherDomainRuleInput | null | undefined,
  subject: string,
  targetClasses: StudentClass[],
): boolean {
  if (domain?.isAll) return true;
  if (!domain || targetClasses.length === 0) return false;
  if (!targetClasses.every((studentClass) => domain.classes.includes(studentClass))) {
    return false;
  }

  const allowedSubjects = new Set<string>(domain.subjects);
  for (const level of ["ssc", "hsc"] as const) {
    const mapping = COURSE_TO_MCQ_SUBJECT_MAP[level] || {};
    for (const subjectKey of domain.subjects) {
      for (const mapped of mapping[subjectKey] ?? []) allowedSubjects.add(mapped);
    }
  }
  return allowedSubjects.has(subject);
}
