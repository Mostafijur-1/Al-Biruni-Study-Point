import { createHash } from "node:crypto";
import { ObjectId, type Db, type Document } from "mongodb";

import { normalizeAcademicAlias } from "../academic-alias.ts";
import { buildUniqueAliasLookup } from "./canonical-scope-backfill.ts";

export const SINGLE_ORGANIZATION_CURRICULUM_ID = "20260905_single_organization_curriculum_v1";
type SubjectRow = Document & { _id: ObjectId; organizationId: ObjectId; code?: string; name?: string; nameBn?: string; aliases?: string[] };
type PlannedUpdate = { id: ObjectId; set: Record<string, unknown> };

function stableObjectId(namespace: string) {
  return new ObjectId(createHash("sha256").update(namespace).digest("hex").slice(0, 24));
}
function ref(collection: string, id: unknown) {
  return createHash("sha256").update(`${collection}:${String(id)}`).digest("hex").slice(0, 16);
}
function chapterKey(subjectId: ObjectId, value: unknown) {
  return `${String(subjectId)}:${normalizeAcademicAlias(value)}`;
}

export async function inspectSingleOrganizationCurriculumBackfill(db: Db, limit = 5_000) {
  const organizations = await db.collection("organizations").find({ status: "active" }, { projection: { _id: 1 } }).limit(2).toArray();
  if (organizations.length !== 1) throw new Error("Curriculum backfill requires exactly one active organization.");
  const organizationId = organizations[0]._id as ObjectId;
  const subjects = await db.collection<SubjectRow>("academicsubjects").find({ organizationId, status: "active" }).toArray();
  const findSubject = buildUniqueAliasLookup(subjects);
  const existingChapters = await db.collection("academicchapters").find({ organizationId }).toArray();
  const chaptersByKey = new Map(existingChapters.map((row) => [chapterKey(row.subjectId as ObjectId, row.name), row]));
  const plannedChapters = new Map<string, Document>();
  const updates = new Map<string, PlannedUpdate[]>();
  const exceptions: Array<{ collection: string; ref: string; reason: string }> = [];
  const plan = (collection: string, id: ObjectId, set: Record<string, unknown>) => {
    if (Object.keys(set).length) updates.set(collection, [...(updates.get(collection) ?? []), { id, set }]);
  };
  const targetCounts = await Promise.all(["practicequestions", "mcqexams", "mcqquestions"].map((name) => db.collection(name).countDocuments({ $or: [{ organizationId: null }, { subjectId: null }, ...(name === "practicequestions" ? [{ chapterId: null }] : [])] })));
  targetCounts.forEach((count, index) => { if (count > limit) throw new Error(`${["practicequestions", "mcqexams", "mcqquestions"][index]} exceeds the reviewed ${limit}-document bound.`); });

  const practiceQuestions = await db.collection("practicequestions").find({ $or: [{ organizationId: null }, { subjectId: null }, { chapterId: null }] }).limit(limit).toArray();
  for (const row of practiceQuestions) {
    const subject = row.subjectId ? subjects.find((item) => String(item._id) === String(row.subjectId)) : findSubject(row.subject);
    if (!subject) {
      exceptions.push({ collection: "practicequestions", ref: ref("practicequestions", row._id), reason: "subject_alias_missing_or_ambiguous" });
      continue;
    }
    if (!normalizeAcademicAlias(row.chapter)) {
      exceptions.push({ collection: "practicequestions", ref: ref("practicequestions", row._id), reason: "chapter_label_missing" });
      continue;
    }
    const key = chapterKey(subject._id, row.chapter);
    let chapter = chaptersByKey.get(key) ?? plannedChapters.get(key);
    if (!chapter) {
      const id = stableObjectId(`academic-chapter:${String(organizationId)}:${key}`);
      chapter = { _id: id, organizationId, subjectId: subject._id, code: `LEGACY-${String(id).slice(0, 12).toUpperCase()}`, name: String(row.chapter).trim(), nameBn: String(row.chapter).trim(), order: plannedChapters.size, status: "active", createdAt: new Date(), updatedAt: new Date() };
      plannedChapters.set(key, chapter);
    }
    if (row.organizationId && String(row.organizationId) !== String(organizationId)) {
      exceptions.push({ collection: "practicequestions", ref: ref("practicequestions", row._id), reason: "organization_scope_conflict" });
      continue;
    }
    plan("practicequestions", row._id, {
      ...(!row.organizationId ? { organizationId } : {}),
      ...(!row.subjectId ? { subjectId: subject._id } : {}),
      ...(!row.chapterId ? { chapterId: chapter._id } : {}),
    });
  }

  const exams = await db.collection("mcqexams").find({ $or: [{ organizationId: null }, { subjectId: null }] }).limit(limit).toArray();
  const prospectiveExams = new Map<string, Document>();
  for (const row of exams) {
    const subject = row.subjectId ? subjects.find((item) => String(item._id) === String(row.subjectId)) : findSubject(row.subject);
    if (!subject) {
      exceptions.push({ collection: "mcqexams", ref: ref("mcqexams", row._id), reason: "subject_alias_missing_or_ambiguous" });
      continue;
    }
    const set = { ...(!row.organizationId ? { organizationId } : {}), ...(!row.subjectId ? { subjectId: subject._id } : {}) };
    plan("mcqexams", row._id, set);
    prospectiveExams.set(String(row._id), { ...row, ...set });
  }
  const questions = await db.collection("mcqquestions").find({ $or: [{ organizationId: null }, { subjectId: null }] }).limit(limit).toArray();
  const missingExamIds = questions.map((row) => row.exam).filter((id) => id && !prospectiveExams.has(String(id)));
  const storedExams = await db.collection("mcqexams").find({ _id: { $in: missingExamIds } }).toArray();
  storedExams.forEach((row) => prospectiveExams.set(String(row._id), row));
  for (const row of questions) {
    const exam = prospectiveExams.get(String(row.exam));
    if (!exam?.organizationId || !exam.subjectId) {
      exceptions.push({ collection: "mcqquestions", ref: ref("mcqquestions", row._id), reason: "exam_scope_missing" });
      continue;
    }
    plan("mcqquestions", row._id, { ...(!row.organizationId ? { organizationId: exam.organizationId } : {}), ...(!row.subjectId ? { subjectId: exam.subjectId } : {}) });
  }

  return {
    plannedChapters: [...plannedChapters.values()],
    updates,
    report: {
      organizationId: String(organizationId),
      scannedLimitPerCollection: limit,
      plannedChapters: plannedChapters.size,
      plannedByCollection: Object.fromEntries([...updates].map(([collection, rows]) => [collection, rows.length])),
      plannedUpdates: [...updates.values()].reduce((sum, rows) => sum + rows.length, 0),
      exceptionCount: exceptions.length,
      exceptions,
    },
  };
}

export async function applySingleOrganizationCurriculumBackfill(db: Db, limit = 5_000) {
  const inspected = await inspectSingleOrganizationCurriculumBackfill(db, limit);
  if (inspected.report.exceptionCount) throw new Error("Curriculum backfill has unresolved exceptions.");
  if (inspected.plannedChapters.length) await db.collection("academicchapters").bulkWrite(inspected.plannedChapters.map((document) => ({ updateOne: { filter: { _id: document._id }, update: { $setOnInsert: document }, upsert: true } })), { ordered: false });
  let modifiedTotal = 0;
  for (const [collection, rows] of inspected.updates) {
    const result = await db.collection(collection).bulkWrite(rows.map((row) => ({ updateOne: { filter: { _id: row.id }, update: { $set: row.set } } })), { ordered: false });
    modifiedTotal += result.modifiedCount;
  }
  return { ...inspected.report, modifiedTotal };
}
