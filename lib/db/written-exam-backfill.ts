import { ObjectId, type AnyBulkWriteOperation, type Db, type Document } from "mongodb";
import { assessmentContentHash } from "../assessment-kernel.ts";

export const STEP7_WRITTEN_EXAM_MIGRATION_ID = "step7-written-exam-publication-backfill-v1";

type ReferenceUpdate = { collection: string; id: ObjectId; set: Record<string, ObjectId> };
type PublicationInsert = {
  _id: ObjectId; examId: ObjectId; organizationId?: ObjectId; assessmentVersionId?: ObjectId; version: number;
  resultCount: number; resultsHash: string; results: Array<{ resultId: ObjectId; studentId: ObjectId; enrollmentId: ObjectId; marks: number; comment?: string }>;
  publishedBy: ObjectId; publishedAt: Date; createdAt: Date;
};

function publicationHash(results: PublicationInsert["results"]) {
  const normalized = results.map((row) => ({ resultId: String(row.resultId), studentId: String(row.studentId), enrollmentId: String(row.enrollmentId), marks: row.marks, comment: row.comment }));
  return assessmentContentHash(normalized);
}

export async function inspectWrittenExamBackfill(db: Db, limit = 500) {
  const updates: ReferenceUpdate[] = [];
  const publications: PublicationInsert[] = [];
  const assessments = await db.collection("assessments").find({ latestPublishedVersion: { $type: "objectId" }, "legacySource.collection": "WrittenExam", "legacySource.id": { $type: "string" } }).limit(limit).toArray();
  for (const assessment of assessments) {
    if (!ObjectId.isValid(assessment.legacySource.id)) continue;
    updates.push({ collection: "writtenexams", id: new ObjectId(assessment.legacySource.id), set: { assessmentId: assessment._id, assessmentVersionId: assessment.latestPublishedVersion } });
  }

  const existingPublications = await db.collection("writtenexamresultpublications").find({ examId: { $type: "objectId" } }).limit(limit).toArray();
  for (const publication of existingPublications) {
    const results = await db.collection("writtenexamresults").find({ examId: publication.examId, publicationId: { $ne: publication._id } }, { projection: { _id: 1 } }).limit(limit).toArray();
    for (const result of results) updates.push({ collection: "writtenexamresults", id: result._id, set: { publicationId: publication._id } });
  }

  const attempts = await db.collection("assessmentattempts").find({ "legacySource.collection": "WrittenExamResult", "legacySource.id": { $type: "string" } }).limit(limit).toArray();
  for (const attempt of attempts) {
    if (!ObjectId.isValid(attempt.legacySource.id)) continue;
    updates.push({ collection: "writtenexamresults", id: new ObjectId(attempt.legacySource.id), set: { assessmentAttemptId: attempt._id } });
  }

  const publishedExams = await db.collection("writtenexams").find({ isPublished: true }).limit(limit).toArray();
  const existingExamIds = new Set(existingPublications.map((row) => String(row.examId)));
  for (const exam of publishedExams) {
    if (existingExamIds.has(String(exam._id))) continue;
    const rows = await db.collection("writtenexamresults").find({ examId: exam._id }).sort({ studentId: 1 }).limit(limit).toArray();
    if (!rows.length || rows.some((row) => !row.enrollmentId)) continue;
    const publicationId = new ObjectId();
    const results = rows.map((row) => ({ resultId: row._id, studentId: row.studentId, enrollmentId: row.enrollmentId, marks: row.marks, ...(row.comment ? { comment: row.comment } : {}) }));
    const publishedAt = exam.publishedAt ?? exam.updatedAt ?? exam.createdAt ?? new Date();
    publications.push({ _id: publicationId, examId: exam._id, organizationId: exam.organizationId, assessmentVersionId: exam.assessmentVersionId, version: 1, resultCount: results.length, resultsHash: publicationHash(results), results, publishedBy: exam.publishedBy ?? exam.createdBy, publishedAt, createdAt: publishedAt });
    for (const row of rows) updates.push({ collection: "writtenexamresults", id: row._id, set: { publicationId } });
  }
  const byCollection = Object.fromEntries([...new Set(updates.map((row) => row.collection))].map((collection) => [collection, updates.filter((row) => row.collection === collection).length]));
  return { updates, publications, report: { plannedReferenceUpdates: updates.length, plannedPublications: publications.length, byCollection } };
}

export async function applyWrittenExamBackfill(db: Db, limit = 500) {
  const { updates, publications, report } = await inspectWrittenExamBackfill(db, limit);
  let insertedPublications = 0;
  for (const publication of publications) {
    const result = await db.collection("writtenexamresultpublications").updateOne({ examId: publication.examId }, { $setOnInsert: publication }, { upsert: true });
    insertedPublications += result.upsertedCount;
    if (!result.upsertedCount) {
      const existing = await db.collection("writtenexamresultpublications").findOne({ examId: publication.examId }, { projection: { _id: 1 } });
      if (existing) {
        for (const update of updates) {
          if (update.set.publicationId?.equals(publication._id)) update.set.publicationId = existing._id;
        }
      }
    }
  }
  let modifiedReferences = 0;
  for (const collection of new Set(updates.map((row) => row.collection))) {
    const operations: AnyBulkWriteOperation<Document>[] = updates.filter((row) => row.collection === collection).map((row) => ({ updateOne: { filter: { _id: row.id }, update: { $set: row.set } } }));
    if (operations.length) modifiedReferences += (await db.collection(collection).bulkWrite(operations, { ordered: false })).modifiedCount;
  }
  return { ...report, insertedPublications, modifiedReferences };
}
