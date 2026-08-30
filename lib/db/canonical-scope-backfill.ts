import { createHash } from "node:crypto";
import type { Db, Document, ObjectId } from "mongodb";

import { normalizeAcademicAlias } from "../academic-alias.ts";

export const STEP3_SCOPE_MIGRATION_ID = "step3-canonical-academic-scope-v1";

type CatalogRow = Document & {
  _id: ObjectId;
  organizationId: ObjectId;
  subjectId?: ObjectId;
  code?: string;
  name?: string;
  nameBn?: string;
  aliases?: string[];
};

function anonymousRef(collection: string, id: unknown) {
  return createHash("sha256").update(`${collection}:${String(id)}`).digest("hex").slice(0, 16);
}

export function buildUniqueAliasLookup<T extends CatalogRow>(rows: T[]) {
  const candidates = new Map<string, T[]>();
  for (const row of rows) {
    for (const alias of [row.code, row.name, row.nameBn, ...(row.aliases ?? [])]) {
      const key = normalizeAcademicAlias(alias);
      if (key) candidates.set(key, [...(candidates.get(key) ?? []), row]);
    }
  }
  return (value: unknown) => {
    const matches = candidates.get(normalizeAcademicAlias(value)) ?? [];
    const unique = [...new Map(matches.map((row) => [String(row._id), row])).values()];
    return unique.length === 1 ? unique[0] : undefined;
  };
}

export async function inspectCanonicalScopeBackfill(db: Db, limit: number) {
  const subjects = await db.collection<CatalogRow>("academicsubjects")
    .find({ status: "active", organizationId: { $exists: true } })
    .project({ organizationId: 1, code: 1, name: 1, nameBn: 1, aliases: 1 })
    .toArray() as CatalogRow[];
  const chapters = await db.collection<CatalogRow>("academicchapters")
    .find({ status: "active", organizationId: { $exists: true }, subjectId: { $exists: true } })
    .project({ organizationId: 1, subjectId: 1, code: 1, name: 1, nameBn: 1 })
    .toArray() as CatalogRow[];
  const findSubject = buildUniqueAliasLookup(subjects);
  const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
  const chapterLookup = new Map<string, ReturnType<typeof buildUniqueAliasLookup>>();
  for (const subject of subjects) {
    chapterLookup.set(
      String(subject._id),
      buildUniqueAliasLookup(chapters.filter((chapter) => String(chapter.subjectId) === String(subject._id))),
    );
  }

  const updates = new Map<string, Array<{ id: ObjectId; set: Record<string, unknown> }>>();
  const exceptions: Array<{ collection: string; ref: string; reason: string }> = [];
  const addException = (collection: string, id: unknown, reason: string) =>
    exceptions.push({ collection, ref: anonymousRef(collection, id), reason });

  const legacyTargets = [
    { collection: "courses", chapterRequired: false },
    { collection: "videos", chapterRequired: false },
    { collection: "cqassignments", chapterRequired: false },
    { collection: "practicequestions", chapterRequired: true },
    { collection: "mcqexams", chapterRequired: false },
  ] as const;
  for (const target of legacyTargets) {
    const missingScope = [
      { organizationId: null },
      { subjectId: null },
      ...(target.chapterRequired ? [{ chapterId: null }] : []),
    ];
    const documents = await db.collection(target.collection).find({
      $or: missingScope,
    }).project({ organizationId: 1, subjectId: 1, chapterId: 1, subject: 1, chapter: 1 }).limit(limit).toArray();
    for (const document of documents) {
      const subject = document.subjectId ? subjectById.get(String(document.subjectId)) : findSubject(document.subject);
      if (!subject) {
        addException(target.collection, document._id, "subject_alias_missing_or_ambiguous");
        continue;
      }
      if (document.organizationId && String(document.organizationId) !== String(subject.organizationId)) {
        addException(target.collection, document._id, "organization_scope_conflict");
        continue;
      }
      const set: Record<string, unknown> = {};
      if (!document.organizationId) set.organizationId = subject.organizationId;
      if (!document.subjectId) set.subjectId = subject._id;
      if (target.chapterRequired && !document.chapterId) {
        const chapter = chapterLookup.get(String(subject._id))?.(document.chapter);
        if (!chapter) {
          addException(target.collection, document._id, "chapter_alias_missing_or_ambiguous");
          continue;
        }
        set.chapterId = chapter._id;
      }
      if (Object.keys(set).length) {
        updates.set(target.collection, [...(updates.get(target.collection) ?? []), { id: document._id, set }]);
      }
    }
  }

  const batchTargets = ["writtenexams", "studentreportcomments"] as const;
  for (const collection of batchTargets) {
    const documents = await db.collection(collection).find({
      $or: [
        { organizationId: null },
        { branchId: null },
        { academicSessionId: null },
      ],
    }).project({ organizationId: 1, branchId: 1, academicSessionId: 1, batchId: 1 }).limit(limit).toArray();
    const batchIds = documents.map((document) => document.batchId).filter(Boolean);
    const batches = await db.collection("batches").find({ _id: { $in: batchIds } })
      .project({ organizationId: 1, branchId: 1, academicSessionId: 1 }).toArray();
    const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
    for (const document of documents) {
      const batch = batchById.get(String(document.batchId));
      if (!batch?.organizationId || !batch.branchId || !batch.academicSessionId) {
        addException(collection, document._id, "batch_scope_missing");
        continue;
      }
      if (
        (document.organizationId && String(document.organizationId) !== String(batch.organizationId)) ||
        (document.branchId && String(document.branchId) !== String(batch.branchId)) ||
        (document.academicSessionId && String(document.academicSessionId) !== String(batch.academicSessionId))
      ) {
        addException(collection, document._id, "batch_scope_conflict");
        continue;
      }
      const set: Record<string, unknown> = {};
      if (!document.organizationId) set.organizationId = batch.organizationId;
      if (!document.branchId) set.branchId = batch.branchId;
      if (!document.academicSessionId) set.academicSessionId = batch.academicSessionId;
      updates.set(collection, [...(updates.get(collection) ?? []), {
        id: document._id,
        set,
      }]);
    }
  }

  const questions = await db.collection("mcqquestions").find({
    $or: [{ organizationId: null }, { subjectId: null }],
  }).project({ organizationId: 1, subjectId: 1, exam: 1 }).limit(limit).toArray();
  const exams = await db.collection("mcqexams").find({ _id: { $in: questions.map((row) => row.exam).filter(Boolean) } })
    .project({ organizationId: 1, subjectId: 1 }).toArray();
  const examById = new Map(exams.map((exam) => [String(exam._id), exam]));
  for (const question of questions) {
    const exam = examById.get(String(question.exam));
    if (!exam?.organizationId || !exam.subjectId) {
      addException("mcqquestions", question._id, "exam_scope_missing");
      continue;
    }
    if (
      (question.organizationId && String(question.organizationId) !== String(exam.organizationId)) ||
      (question.subjectId && String(question.subjectId) !== String(exam.subjectId))
    ) {
      addException("mcqquestions", question._id, "exam_scope_conflict");
      continue;
    }
    const set: Record<string, unknown> = {};
    if (!question.organizationId) set.organizationId = exam.organizationId;
    if (!question.subjectId) set.subjectId = exam.subjectId;
    updates.set("mcqquestions", [...(updates.get("mcqquestions") ?? []), {
      id: question._id,
      set,
    }]);
  }

  return {
    updates,
    report: {
      scannedLimitPerCollection: limit,
      plannedByCollection: Object.fromEntries([...updates].map(([name, rows]) => [name, rows.length])),
      plannedTotal: [...updates.values()].reduce((sum, rows) => sum + rows.length, 0),
      exceptionCount: exceptions.length,
      exceptions,
    },
  };
}

export async function applyCanonicalScopeBackfill(db: Db, limit: number) {
  const inspected = await inspectCanonicalScopeBackfill(db, limit);
  for (const [collection, rows] of inspected.updates) {
    if (!rows.length) continue;
    await db.collection(collection).bulkWrite(rows.map((row) => ({
      updateOne: {
        filter: { _id: row.id },
        update: { $set: row.set },
      },
    })), { ordered: false });
  }
  return inspected.report;
}
