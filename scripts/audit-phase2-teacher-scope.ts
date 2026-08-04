import mongoose from "mongoose";

import { compareTeacherScopeParity } from "../lib/academic-scope-parity.ts";
import { AcademicSubject } from "../lib/db/models/AcademicSubject.ts";
import { Batch } from "../lib/db/models/Batch.ts";
import { BatchEnrollment } from "../lib/db/models/BatchEnrollment.ts";
import { TeacherAssignment } from "../lib/db/models/TeacherAssignment.ts";
import { User } from "../lib/db/models/User.ts";

const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");

await mongoose.connect(uri, { dbName: "absp" });

try {
  const now = new Date();
  const [teachers, assignments] = await Promise.all([
    User.find({ role: "teacher" }).select("teacherDomain").lean(),
    TeacherAssignment.find({
      status: "active",
      effectiveFrom: { $lte: now },
      $or: [
        { effectiveTo: { $exists: false } },
        { effectiveTo: null },
        { effectiveTo: { $gte: now } },
      ],
    }).lean(),
  ]);
  const batchIds = [...new Set(assignments.map((item) => String(item.batchId)))];
  const subjectIds = [...new Set(assignments.map((item) => String(item.subjectId)))];
  const [batches, subjects, enrollments] = await Promise.all([
    Batch.find({ _id: { $in: batchIds } }).select("studentClass").lean(),
    AcademicSubject.find({ _id: { $in: subjectIds } })
      .select("code name nameBn aliases")
      .lean(),
    BatchEnrollment.find({
      batchId: { $in: batchIds },
      status: "active",
      effectiveFrom: { $lte: now },
      $or: [
        { effectiveTo: { $exists: false } },
        { effectiveTo: null },
        { effectiveTo: { $gte: now } },
      ],
    })
      .select("batchId studentId")
      .lean(),
  ]);
  const batchById = new Map(batches.map((item) => [String(item._id), item]));
  const subjectById = new Map(subjects.map((item) => [String(item._id), item]));
  const studentsByBatch = new Map<string, string[]>();
  for (const enrollment of enrollments) {
    const key = String(enrollment.batchId);
    studentsByBatch.set(key, [...(studentsByBatch.get(key) ?? []), String(enrollment.studentId)]);
  }

  const results = teachers.map((teacher) => {
    const teacherAssignments = assignments.filter(
      (assignment) => String(assignment.teacherId) === String(teacher._id),
    );
    const canonicalClasses = teacherAssignments
      .map((assignment) => batchById.get(String(assignment.batchId))?.studentClass)
      .filter((value): value is "class-9" | "class-10" | "class-11" | "class-12" =>
        Boolean(value),
      );
    const canonicalSubjects = teacherAssignments.flatMap((assignment) => {
      const subject = subjectById.get(String(assignment.subjectId));
      return subject
        ? [
            {
              key: subject.code,
              aliases: [subject.name, subject.nameBn, ...(subject.aliases ?? [])],
            },
          ]
        : [];
    });
    const canonicalStudents = teacherAssignments.flatMap(
      (assignment) => studentsByBatch.get(String(assignment.batchId)) ?? [],
    );
    const legacy = teacher.teacherDomain
      ? {
          isAll: teacher.teacherDomain.isAll,
          classes: teacher.teacherDomain.classes,
          subjects: teacher.teacherDomain.subjects,
          students: teacher.teacherDomain.students?.map(String),
        }
      : undefined;
    const parity = compareTeacherScopeParity(legacy, {
      classes: canonicalClasses,
      subjects: canonicalSubjects,
      students: canonicalStudents,
    });

    return {
      teacherId: String(teacher._id),
      canonicalAssignmentCount: teacherAssignments.length,
      ...parity,
    };
  });
  const summary = {
    generatedAt: now.toISOString(),
    teachers: results.length,
    matches: results.filter((result) => result.status === "match").length,
    mismatches: results.filter((result) => result.status === "mismatch").length,
    legacyAllRequiresReview: results.filter(
      (result) => result.status === "legacy_all_requires_review",
    ).length,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (process.argv.includes("--fail-on-mismatch") && summary.matches !== summary.teachers) {
    process.exitCode = 1;
  }
} finally {
  await mongoose.disconnect();
}
