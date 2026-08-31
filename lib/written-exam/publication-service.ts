import mongoose, { type HydratedDocument, Types } from "mongoose";

import { assessmentContentHash } from "../assessment-kernel.ts";
import type { RequestContext } from "../application/request-context.ts";
import { writeAuditLog } from "../audit/write-audit-log.ts";
import { Assessment } from "../db/models/Assessment.ts";
import { AssessmentAttempt } from "../db/models/AssessmentAttempt.ts";
import { AssessmentVersion } from "../db/models/AssessmentVersion.ts";
import { QuestionVersion } from "../db/models/QuestionVersion.ts";
import { WrittenExam, type IWrittenExam } from "../db/models/WrittenExam.ts";
import { WrittenExamResult } from "../db/models/WrittenExamResult.ts";
import { WrittenExamResultCorrection, type IWrittenExamResultCorrection } from "../db/models/WrittenExamResultCorrection.ts";
import { WrittenExamResultPublication } from "../db/models/WrittenExamResultPublication.ts";
import { replayWrittenResultCorrections } from "./correction-history.ts";

export async function publishWrittenResultsAtomically(context: RequestContext, input: { examId: string; assessmentId?: Types.ObjectId; assessmentVersionId?: Types.ObjectId; questionVersionId?: Types.ObjectId }): Promise<{ exam: HydratedDocument<IWrittenExam>; publicationId: Types.ObjectId; alreadyPublished: boolean }> {
  const session = await mongoose.startSession();
  try {
    let output: { exam: HydratedDocument<IWrittenExam>; publicationId: Types.ObjectId; alreadyPublished: boolean } | null = null;
    await session.withTransaction(async () => {
      const exam = await WrittenExam.findById(input.examId).session(session);
      if (!exam) throw new Error("Written exam not found.");
      const existing = await WrittenExamResultPublication.findOne({ examId: exam._id }).session(session);
      if (existing) {
        if (!exam.isPublished) {
          exam.isPublished = true;
          exam.publishedAt = existing.publishedAt;
          exam.publishedBy = existing.publishedBy;
          if (existing.assessmentVersionId) exam.assessmentVersionId = existing.assessmentVersionId;
          await exam.save({ session });
        }
        output = { exam, publicationId: existing._id, alreadyPublished: true };
        return;
      }
      const results = await WrittenExamResult.find({ examId: exam._id }).sort({ studentId: 1 }).session(session);
      if (!results.length) throw new Error("Enter at least one student mark before publishing.");
      const publishedAt = new Date();
      const frozen = results.map((row) => ({ resultId: row._id, studentId: row.studentId, enrollmentId: row.enrollmentId, marks: row.marks, comment: row.comment }));
      const resultsHash = assessmentContentHash(frozen.map((row) => ({ resultId: String(row.resultId), studentId: String(row.studentId), enrollmentId: String(row.enrollmentId), marks: row.marks, comment: row.comment })));
      const [publication] = await WrittenExamResultPublication.create([{ organizationId: exam.organizationId, examId: exam._id, assessmentVersionId: input.assessmentVersionId, version: 1, resultCount: frozen.length, resultsHash, results: frozen, publishedBy: context.actor.id, publishedAt }], { session });

      if (input.assessmentId && input.assessmentVersionId && input.questionVersionId) {
        if (!exam.organizationId) throw new Error("Canonical written attempts require an organization.");
        const [assessment, version, questionVersion] = await Promise.all([
          Assessment.findById(input.assessmentId).session(session).lean(), AssessmentVersion.findById(input.assessmentVersionId).session(session).lean(), QuestionVersion.findById(input.questionVersionId).session(session).lean(),
        ]);
        if (!assessment || !version || !questionVersion) throw new Error("Written assessment version is incomplete.");
        const attempts = results.map((row) => ({
          organizationId: exam.organizationId, assessmentId: assessment._id, assessmentVersionId: version._id, studentId: row.studentId, attemptNo: 1,
          assessmentSnapshot: { title: version.title, kind: "written-exam" as const, passRule: { mode: version.passRule.mode, threshold: version.passRule.threshold }, scoringRules: { unansweredMarks: version.scoringRules.unansweredMarks, incorrectMarks: version.scoringRules.incorrectMarks, rounding: version.scoringRules.rounding }, contentHash: version.contentHash },
          questionSnapshots: [{ questionId: questionVersion.questionId, questionVersionId: questionVersion._id, contentHash: questionVersion.contentHash, prompt: questionVersion.prompt, options: [], correctResponse: { mode: "manual", optionKeys: [], acceptedTexts: [] }, explanation: questionVersion.explanation, marks: questionVersion.marks }],
          responses: [{ questionId: questionVersion.questionId, questionVersionId: questionVersion._id, selectedOptionKeys: [], textResponse: "Manually graded written submission.", awardedMarks: row.marks }],
          score: row.marks, totalMarks: exam.totalMarks, percentage: Number(((row.marks / exam.totalMarks) * 100).toFixed(2)), submittedAt: publishedAt,
          legacySource: { collection: "WrittenExamResult", id: String(row._id) },
        }));
        const createdAttempts = await AssessmentAttempt.insertMany(attempts, { session });
        const operations = results.map((row, index) => ({ updateOne: { filter: { _id: row._id }, update: { $set: { publicationId: publication._id, assessmentAttemptId: createdAttempts[index]._id } } } }));
        await WrittenExamResult.collection.bulkWrite(operations, { session });
      } else {
        await WrittenExamResult.collection.updateMany({ examId: exam._id }, { $set: { publicationId: publication._id } }, { session });
      }

      exam.isPublished = true; exam.publishedAt = publishedAt; exam.publishedBy = new Types.ObjectId(context.actor.id);
      if (input.assessmentId) exam.assessmentId = input.assessmentId;
      if (input.assessmentVersionId) exam.assessmentVersionId = input.assessmentVersionId;
      await exam.save({ session });
      await writeAuditLog({ request: context.request, actor: context.actor, organizationId: exam.organizationId, branchId: exam.branchId, action: "written-exam.published", resourceType: "WrittenExam", resourceId: exam._id, reason: "Written exam results atomically published", after: { resultCount: results.length, publicationId: String(publication._id), resultsHash }, session });
      output = { exam, publicationId: publication._id, alreadyPublished: false };
    });
    if (!output) throw new Error("Written result publication did not complete.");
    return output;
  } finally {
    await session.endSession();
  }
}

export async function appendWrittenResultCorrection(context: RequestContext, input: { examId: string; studentId: string; marks: number; comment?: string; reason: string }): Promise<HydratedDocument<IWrittenExamResultCorrection>> {
  const session = await mongoose.startSession();
  try {
    let output: HydratedDocument<IWrittenExamResultCorrection> | null = null;
    await session.withTransaction(async () => {
      const exam = await WrittenExam.findById(input.examId).session(session).lean();
      if (!exam?.isPublished) throw new Error("Written exam results are not published.");
      if (input.marks > exam.totalMarks) throw new Error(`Marks cannot exceed ${exam.totalMarks}.`);
      const publication = await WrittenExamResultPublication.findOne({ examId: exam._id }).session(session);
      const result = await WrittenExamResult.findOne({ examId: exam._id, studentId: input.studentId }).session(session).lean();
      if (!publication || !result) throw new Error("Published written result not found.");
      const history = await WrittenExamResultCorrection.find({ resultId: result._id }).sort({ sequence: 1 }).session(session).lean();
      const replayed = replayWrittenResultCorrections({ marks: result.marks, comment: result.comment }, history);
      const [correction] = await WrittenExamResultCorrection.create([{ organizationId: exam.organizationId, examId: exam._id, publicationId: publication._id, resultId: result._id, studentId: result.studentId, sequence: replayed.correctionSequence + 1, before: replayed.current, after: { marks: input.marks, comment: input.comment }, reason: input.reason, correctedBy: context.actor.id, correctedAt: new Date(), contentHash: "pending" }], { session });
      await writeAuditLog({ request: context.request, actor: context.actor, organizationId: exam.organizationId, branchId: exam.branchId, action: "written-result.corrected", resourceType: "WrittenExamResult", resourceId: result._id, reason: input.reason, before: replayed.current, after: { marks: input.marks, comment: input.comment, correctionSequence: correction.sequence }, session });
      output = correction;
    });
    if (!output) throw new Error("Written result correction did not complete.");
    return output;
  } finally {
    await session.endSession();
  }
}
