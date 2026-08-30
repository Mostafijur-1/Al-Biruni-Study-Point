import { COURSE_TO_MCQ_SUBJECT_MAP } from "../content/syllabus";
import { User } from "../db/models/User";
import { Batch } from "../db/models/Batch";
import { TeacherAssignment } from "../db/models/TeacherAssignment";
import { isCanonicalAcademicAuthorityEnabled } from "../db/canonical-scope-guard";
import { selectTeacherAuthorityDecision } from "./canonical-authority-decision";
import type { StudentClass } from "../../types";
import {
  areClassesWithinTeacherDomain,
  isExamWithinTeacherDomain,
} from "./teacher-domain-rules";

export type TeacherScopeDecision =
  | { ok: true; authority?: "legacy" | "canonical"; shadowMismatch?: boolean }
  | { ok: false; status: 403 | 404; message: string; authority?: "legacy" | "canonical"; shadowMismatch?: boolean };

async function isWithinCanonicalAssignment(
  teacherId: string,
  targetClasses: StudentClass[],
  subjectId: string | undefined,
) {
  if (!subjectId) return false;
  const now = new Date();
  const assignments = await TeacherAssignment.find({
    teacherId,
    subjectId,
    status: "active",
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
  }).select("batchId").lean();
  if (!assignments.length) return false;
  const batches = await Batch.find({
    _id: { $in: assignments.map((assignment) => assignment.batchId) },
    status: { $in: ["planned", "active"] },
  }).select("studentClass").lean();
  const assignedClasses = new Set(batches.map((batch) => batch.studentClass).filter(Boolean));
  return targetClasses.every((studentClass) => assignedClasses.has(studentClass));
}

export async function authorizeTeacherContentScope(
  teacherId: string,
  targetClasses: StudentClass[],
  subject?: string,
  subjectId?: string,
): Promise<TeacherScopeDecision> {
  const teacher = await User.findById(teacherId).select("teacherDomain").lean();
  if (!teacher) return { ok: false, status: 404, message: "Teacher not found." };

  const legacyAllowed = subject
    ? isExamWithinTeacherDomain(teacher.teacherDomain, subject, targetClasses)
    : areClassesWithinTeacherDomain(teacher.teacherDomain, targetClasses);
  const authorityEnabled = isCanonicalAcademicAuthorityEnabled();
  const shadowEnabled = process.env.CANONICAL_ACADEMIC_SHADOW_READS_ENABLED?.trim().toLowerCase() === "true";
  const canonicalAllowed = authorityEnabled || shadowEnabled
    ? await isWithinCanonicalAssignment(teacherId, targetClasses, subjectId)
    : legacyAllowed;
  const selected = selectTeacherAuthorityDecision({
    legacyAllowed,
    canonicalAllowed,
    canonicalAuthorityEnabled: authorityEnabled,
  });
  return selected.allowed
    ? { ok: true, authority: selected.authority, shadowMismatch: selected.shadowMismatch }
    : {
        ok: false,
        status: 403,
        message: "The selected subject or class is outside your assigned teaching scope.",
        authority: selected.authority,
        shadowMismatch: selected.shadowMismatch,
      };
}

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
