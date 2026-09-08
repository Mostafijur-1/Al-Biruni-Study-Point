import { subjectAcceptsLegacyAlias } from "../academic-alias";
import { AcademicSubject } from "../db/models/AcademicSubject";
import { Batch } from "../db/models/Batch";
import { BatchEnrollment } from "../db/models/BatchEnrollment";
import { TeacherAssignment } from "../db/models/TeacherAssignment";
import { User } from "../db/models/User";
import type { StudentClass } from "../../types";

export type TeacherScopeDecision =
  | { ok: true; authority: "canonical" }
  | { ok: false; status: 403 | 404; message: string; authority: "canonical" };

const activeAt = (now: Date) => ({
  status: "active" as const,
  effectiveFrom: { $lte: now },
  $or: [
    { effectiveTo: { $exists: false } },
    { effectiveTo: null },
    { effectiveTo: { $gte: now } },
  ],
});

async function isWithinCanonicalAssignment(
  teacherId: string,
  targetClasses: StudentClass[],
  subjectId: string | undefined,
) {
  const now = new Date();
  const assignments = await TeacherAssignment.find({
    teacherId,
    ...(subjectId ? { subjectId } : {}),
    ...activeAt(now),
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
  _subject?: string,
  subjectId?: string,
): Promise<TeacherScopeDecision> {
  const teacherExists = await User.exists({ _id: teacherId, role: "teacher", isActive: true });
  if (!teacherExists) {
    return { ok: false, status: 404, message: "Teacher not found.", authority: "canonical" };
  }
  const allowed = await isWithinCanonicalAssignment(teacherId, targetClasses, subjectId);
  return allowed
    ? { ok: true, authority: "canonical" }
    : {
        ok: false,
        status: 403,
        message: "The selected subject or class is outside your assigned teaching scope.",
        authority: "canonical",
      };
}

export async function authorizeTeacherForStudentSubject(
  teacherId: string,
  studentId: string,
  subjectName: string,
): Promise<TeacherScopeDecision> {
  const now = new Date();
  const [teacherExists, student, subjects] = await Promise.all([
    User.exists({ _id: teacherId, role: "teacher", isActive: true }),
    User.findOne({ _id: studentId, role: "student", isActive: true }).select("_id").lean(),
    AcademicSubject.find({ status: "active" }).select("code name nameBn aliases").lean(),
  ]);
  if (!teacherExists) {
    return { ok: false, status: 404, message: "Teacher not found.", authority: "canonical" };
  }
  if (!student) {
    return { ok: false, status: 404, message: "Student not found.", authority: "canonical" };
  }
  const subject = subjects.find((candidate) => subjectAcceptsLegacyAlias(candidate, subjectName));
  if (!subject) {
    return { ok: false, status: 403, message: "This result has no canonical subject.", authority: "canonical" };
  }

  const assignments = await TeacherAssignment.find({
    teacherId,
    subjectId: subject._id,
    ...activeAt(now),
    $and: [{
      $or: [
        { studentIds: { $exists: false } },
        { "studentIds.0": { $exists: false } },
        { studentIds: student._id },
      ],
    }],
  }).select("batchId").lean();
  const enrollment = assignments.length
    ? await BatchEnrollment.exists({
        batchId: { $in: assignments.map((assignment) => assignment.batchId) },
        studentId: student._id,
        ...activeAt(now),
      })
    : null;
  return enrollment
    ? { ok: true, authority: "canonical" }
    : {
        ok: false,
        status: 403,
        message: "You are not authorised to manage this student's result.",
        authority: "canonical",
      };
}
