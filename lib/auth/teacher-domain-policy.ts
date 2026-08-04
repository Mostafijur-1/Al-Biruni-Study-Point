import { COURSE_TO_MCQ_SUBJECT_MAP } from "../content/syllabus";
import { User } from "../db/models/User";

export type TeacherScopeDecision =
  | { ok: true }
  | { ok: false; status: 403 | 404; message: string };

export async function authorizeTeacherForStudentSubject(
  teacherId: string,
  studentId: string,
  subject: string,
): Promise<TeacherScopeDecision> {
  const teacher = await User.findById(teacherId).lean();
  if (!teacher) return { ok: false, status: 404, message: "Teacher not found." };

  const domain = teacher.teacherDomain;
  const allowedClasses = domain?.isAll
    ? ["class-9", "class-10", "class-11", "class-12"]
    : domain?.classes ?? [];
  if (allowedClasses.length === 0) {
    return { ok: false, status: 403, message: "You are not authorised to manage this result." };
  }

  if (!domain?.isAll) {
    const assignedStudents = (domain?.students ?? []).map(String);
    if (!assignedStudents.includes(String(studentId))) {
      return { ok: false, status: 403, message: "You are not authorised to manage this student's results." };
    }
  }

  const student = await User.findById(studentId).lean();
  if (!student) return { ok: false, status: 404, message: "Student not found." };
  if (!allowedClasses.includes(student.studentClass || "")) {
    return { ok: false, status: 403, message: "You are not authorised to manage this result's class." };
  }

  if (!domain?.isAll && domain?.subjects?.length) {
    const allowedSubjects = new Set<string>(domain.subjects);
    for (const level of ["ssc", "hsc"] as const) {
      const mapping = COURSE_TO_MCQ_SUBJECT_MAP[level] || {};
      for (const subjectKey of domain.subjects) {
        for (const mapped of mapping[subjectKey] ?? []) allowedSubjects.add(mapped);
      }
    }
    if (!allowedSubjects.has(subject)) {
      return { ok: false, status: 403, message: "You are not authorised to manage this result's subject." };
    }
  }

  return { ok: true };
}
