import mongoose, { Types } from "mongoose";

import { assessmentContentHash } from "../assessment-kernel.ts";
import { Assessment } from "../db/models/Assessment.ts";
import { AssessmentQuestion } from "../db/models/AssessmentQuestion.ts";
import { AssessmentVersion } from "../db/models/AssessmentVersion.ts";
import { Question } from "../db/models/Question.ts";
import { QuestionVersion } from "../db/models/QuestionVersion.ts";

export async function materializeWrittenExamAssessment(input: {
  examId: string; organizationId: string; branchId?: string; academicSessionId?: string; batchId: string; subjectId: string;
  title: string; instructions?: string; totalMarks: number; ownerId: string; ownerRole: "admin" | "teacher";
  questionLink?: string;
}): Promise<{ assessmentId: Types.ObjectId; assessmentVersionId: Types.ObjectId; questionId: Types.ObjectId; questionVersionId: Types.ObjectId }> {
  const session = await mongoose.startSession();
  try {
    let output: { assessmentId: Types.ObjectId; assessmentVersionId: Types.ObjectId; questionId: Types.ObjectId; questionVersionId: Types.ObjectId } | null = null;
    await session.withTransaction(async () => {
      let question = await Question.findOne({ "legacySource.collection": "WrittenExamQuestion", "legacySource.id": input.examId }).session(session);
      if (!question) question = await Question.create([{ organizationId: input.organizationId, subjectId: input.subjectId, kind: "written", language: "mixed", status: "approved", ownerId: input.ownerId, ownerRole: input.ownerRole, provenance: { sourceType: "legacy", sourceId: input.examId }, legacySource: { collection: "WrittenExamQuestion", id: input.examId } }], { session }).then((rows) => rows[0]);
      if (!question) throw new Error("Could not materialize written question.");
      let questionVersion = await QuestionVersion.findOne({ questionId: question._id, status: "published" }).sort({ version: -1 }).session(session);
      if (!questionVersion) {
        questionVersion = await QuestionVersion.create([{ questionId: question._id, version: 1, prompt: input.title, options: [], correctResponse: { mode: "manual", optionKeys: [], acceptedTexts: [] }, explanation: input.instructions, sourceReference: input.questionLink ? { provider: "google-drive", url: input.questionLink } : undefined, marks: input.totalMarks, difficulty: "medium", language: "mixed", status: "draft", contentHash: "pending", createdBy: input.ownerId }], { session }).then((rows) => rows[0]);
        if (!questionVersion) throw new Error("Could not materialize written question version.");
        questionVersion.status = "published"; questionVersion.publishedBy = new Types.ObjectId(input.ownerId); questionVersion.publishedAt = new Date(); await questionVersion.save({ session });
        question.latestPublishedVersion = questionVersion._id; await question.save({ session });
      }

      let assessment = await Assessment.findOne({ "legacySource.collection": "WrittenExam", "legacySource.id": input.examId }).session(session);
      if (!assessment) assessment = await Assessment.create([{ organizationId: input.organizationId, branchId: input.branchId, academicSessionId: input.academicSessionId, subjectId: input.subjectId, batchIds: [input.batchId], kind: "written-exam", status: "draft", ownerId: input.ownerId, ownerRole: input.ownerRole, legacySource: { collection: "WrittenExam", id: input.examId } }], { session }).then((rows) => rows[0]);
      if (!assessment) throw new Error("Could not materialize written assessment.");
      let assessmentVersion = await AssessmentVersion.findOne({ assessmentId: assessment._id, status: "published" }).sort({ version: -1 }).session(session);
      if (!assessmentVersion) {
        const questionSetHash = assessmentContentHash([{ questionVersionId: String(questionVersion._id), order: 0, marks: input.totalMarks, required: true }]);
        assessmentVersion = await AssessmentVersion.create([{ assessmentId: assessment._id, version: 1, title: input.title, instructions: input.instructions, passRule: { mode: "manual" }, scoringRules: { unansweredMarks: 0, incorrectMarks: 0, rounding: "two-decimal" }, status: "draft", questionCount: 1, totalMarks: input.totalMarks, questionSetHash, contentHash: "pending", createdBy: input.ownerId }], { session }).then((rows) => rows[0]);
        if (!assessmentVersion) throw new Error("Could not materialize written assessment version.");
        await AssessmentQuestion.insertMany([{ assessmentVersionId: assessmentVersion._id, questionVersionId: questionVersion._id, order: 0, marks: input.totalMarks, required: true }], { session });
        assessmentVersion.status = "published"; assessmentVersion.publishedBy = new Types.ObjectId(input.ownerId); assessmentVersion.publishedAt = new Date(); await assessmentVersion.save({ session });
        assessment.status = "published"; assessment.latestPublishedVersion = assessmentVersion._id; await assessment.save({ session });
      }
      output = { assessmentId: assessment._id, assessmentVersionId: assessmentVersion._id, questionId: question._id, questionVersionId: questionVersion._id };
    });
    if (!output) throw new Error("Written assessment materialization did not complete.");
    return output;
  } finally {
    await session.endSession();
  }
}
