import type { CourseLevel, CourseSubject } from "@/types";

export type SubjectOffering = {
  subject: CourseSubject;
  slug: string;
};

/** SSC: Physics, Chemistry, Math, Higher Math, ICT */
export const sscSubjects: SubjectOffering[] = [
  { subject: "Physics", slug: "ssc-physics" },
  { subject: "Chemistry", slug: "ssc-chemistry" },
  { subject: "Math", slug: "ssc-math" },
  { subject: "Higher Math", slug: "ssc-higher-math" },
  { subject: "ICT", slug: "ssc-ict" },
];

/** HSC: Physics, Chemistry, Higher Math, ICT (no general Math) */
export const hscSubjects: SubjectOffering[] = [
  { subject: "Physics", slug: "hsc-physics" },
  { subject: "Chemistry", slug: "hsc-chemistry" },
  { subject: "Higher Math", slug: "hsc-higher-math" },
  { subject: "ICT", slug: "hsc-ict" },
];

export function subjectsForLevel(level: CourseLevel): SubjectOffering[] {
  return level === "SSC" ? sscSubjects : hscSubjects;
}

