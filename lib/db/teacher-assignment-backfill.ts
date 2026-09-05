import { createHash } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";

import { buildUniqueAliasLookup } from "./canonical-scope-backfill.ts";

export const TEACHER_ASSIGNMENT_BACKFILL_ID = "20260905_teacher_assignments_v1";
type SubjectRow = Document & { _id: ObjectId; organizationId: ObjectId; code?: string; name?: string; nameBn?: string; aliases?: string[] };

function stableId(teacherId: ObjectId, batchId: ObjectId, subjectId: ObjectId) {
  return new ObjectId(createHash("sha256").update(`teacher-assignment:${teacherId}:${batchId}:${subjectId}`).digest("hex").slice(0, 24));
}
function ref(id: unknown) {
  return createHash("sha256").update(`teacher:${String(id)}`).digest("hex").slice(0, 16);
}

export async function inspectTeacherAssignmentBackfill(db: Db, limit = 100) {
  const organizations = await db.collection("organizations").find({ status: "active" }, { projection: { _id: 1 } }).limit(2).toArray();
  if (organizations.length !== 1) throw new Error("Teacher assignment backfill requires exactly one active organization.");
  const organizationId = organizations[0]._id as ObjectId;
  const [subjects, batches, teachers, admins] = await Promise.all([
    db.collection<SubjectRow>("academicsubjects").find({ organizationId, status: "active" }).toArray(),
    db.collection("batches").find({ organizationId, status: { $in: ["planned", "active"] } }).limit(limit).toArray(),
    db.collection("users").find({ role: "teacher", teacherDomain: { $exists: true } }).limit(limit).toArray(),
    db.collection("users").find({ role: "admin", isActive: true, approvalStatus: "approved" }, { projection: { _id: 1 } }).sort({ createdAt: 1, _id: 1 }).limit(1).toArray(),
  ]);
  if (admins.length !== 1) throw new Error("Teacher assignment backfill requires one active admin as migration actor.");
  const findSubject = buildUniqueAliasLookup(subjects);
  const planned = new Map<string, Document>();
  const exceptions: Array<{ teacherRef: string; reason: string }> = [];
  for (const teacher of teachers) {
    const domain = teacher.teacherDomain ?? {};
    const classes = Array.isArray(domain.classes) ? domain.classes.map(String) : [];
    const teacherBatches = batches.filter((batch) => classes.includes(String(batch.studentClass)));
    if (!teacherBatches.length) {
      exceptions.push({ teacherRef: ref(teacher._id), reason: "no_batch_matches_legacy_classes" });
      continue;
    }
    const resolvedSubjects = (Array.isArray(domain.subjects) ? domain.subjects : []).map((label: unknown) => findSubject(label));
    if (resolvedSubjects.some((subject: SubjectRow | undefined) => !subject)) {
      exceptions.push({ teacherRef: ref(teacher._id), reason: "subject_alias_missing_or_ambiguous" });
      continue;
    }
    for (const batch of teacherBatches) {
      for (const subject of resolvedSubjects as SubjectRow[]) {
        const id = stableId(teacher._id, batch._id, subject._id);
        planned.set(String(id), {
          _id: id,
          organizationId,
          academicSessionId: batch.academicSessionId,
          batchId: batch._id,
          teacherId: teacher._id,
          subjectId: subject._id,
          ...(!domain.isAll ? { studentIds: Array.isArray(domain.students) ? domain.students : [] } : {}),
          status: "active",
          effectiveFrom: new Date("2026-01-01T00:00:00.000+06:00"),
          createdBy: admins[0]._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }
  const existing = planned.size ? await db.collection("teacherassignments").find({ _id: { $in: [...planned.values()].map((row) => row._id) } }, { projection: { _id: 1 } }).toArray() : [];
  const existingIds = new Set(existing.map((row) => String(row._id)));
  return {
    planned: [...planned.values()],
    report: {
      organizationId: String(organizationId),
      teachersScanned: teachers.length,
      batchesScanned: batches.length,
      plannedAssignments: planned.size,
      newAssignments: [...planned.keys()].filter((id) => !existingIds.has(id)).length,
      existingAssignments: existingIds.size,
      exceptionCount: exceptions.length,
      exceptions,
    },
  };
}

export async function applyTeacherAssignmentBackfill(db: Db, limit = 100) {
  const inspected = await inspectTeacherAssignmentBackfill(db, limit);
  if (inspected.report.exceptionCount) throw new Error("Teacher assignment backfill has unresolved exceptions.");
  let insertedTotal = 0;
  for (const document of inspected.planned) insertedTotal += (await db.collection("teacherassignments").updateOne({ _id: document._id }, { $setOnInsert: document }, { upsert: true })).upsertedCount;
  return { ...inspected.report, insertedTotal };
}
