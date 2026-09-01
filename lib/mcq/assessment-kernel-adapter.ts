import mongoose, { Types, type ClientSession } from "mongoose";

import { assessmentContentHash } from "../assessment-kernel.ts";
import { Assessment } from "../db/models/Assessment.ts";
import { AssessmentQuestion } from "../db/models/AssessmentQuestion.ts";
import { AssessmentVersion } from "../db/models/AssessmentVersion.ts";
import { Question } from "../db/models/Question.ts";
import { QuestionVersion } from "../db/models/QuestionVersion.ts";

export type LegacyMcqQuestion = {
  id: string;
  organizationId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  marks: number;
  difficulty?: "easy" | "medium" | "hard";
  ownerId: string;
  ownerRole: "admin" | "teacher";
  collection: "McqQuestion" | "PracticeQuestion";
};

export type MaterializedAssessment = {
  organizationId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  assessmentVersionId: Types.ObjectId;
  questionIds: Types.ObjectId[];
  questionVersionIds: Types.ObjectId[];
};

class AdapterUnavailableError extends Error {}

function questionVersionPayload(question: LegacyMcqQuestion) {
  const options = question.options.map((text, index) => ({ key: String(index), text }));
  return {
    prompt: question.prompt,
    options,
    correctResponse: { mode: "single-option" as const, optionKeys: [String(question.correctIndex)], acceptedTexts: [] as string[] },
    explanation: question.explanation,
    sourceReference: undefined,
    marks: question.marks,
    difficulty: question.difficulty ?? "medium",
    language: "mixed" as const,
  };
}

function questionPayloadHash(question: LegacyMcqQuestion) {
  return assessmentContentHash(questionVersionPayload(question));
}

async function materializeQuestion(question: LegacyMcqQuestion, session: ClientSession) {
  if (!question.organizationId || !question.subjectId || question.options.length !== 4 || question.correctIndex < 0 || question.correctIndex > 3) return null;
  let record = await Question.findOne({ "legacySource.collection": question.collection, "legacySource.id": question.id }).session(session);
  if (!record) {
    record = await Question.create([{
      organizationId: question.organizationId, subjectId: question.subjectId, chapterId: question.chapterId, topicId: question.topicId,
      kind: "single-choice", language: "mixed", status: "approved", ownerId: question.ownerId, ownerRole: question.ownerRole,
      provenance: { sourceType: "legacy", sourceId: question.id }, legacySource: { collection: question.collection, id: question.id },
    }], { session }).then((rows) => rows[0]);
  }
  if (!record) throw new Error("Could not create the canonical question adapter record.");
  const questionRecord = record;

  const latest = await QuestionVersion.findOne({ questionId: questionRecord._id, status: "published" }).sort({ version: -1 }).session(session);
  if (latest?.contentHash === questionPayloadHash(question)) return { question: questionRecord, version: latest };
  if (questionRecord.currentDraftVersion) return null;

  const version = await QuestionVersion.create([{
    questionId: questionRecord._id, version: (latest?.version ?? 0) + 1, ...questionVersionPayload(question),
    status: "draft", contentHash: "pending", createdBy: question.ownerId,
  }], { session }).then((rows) => rows[0]);
  version.status = "published"; version.publishedBy = new Types.ObjectId(question.ownerId); version.publishedAt = new Date();
  await version.save({ session });
  questionRecord.status = "approved"; questionRecord.latestPublishedVersion = version._id; questionRecord.currentDraftVersion = undefined;
  await questionRecord.save({ session });
  return { question: questionRecord, version };
}

export async function materializeLegacyMcqAssessment(input: {
  source: { collection: "McqExam" | "PracticeSelection"; id: string };
  organizationId?: string;
  subjectId?: string;
  branchId?: string;
  academicSessionId?: string;
  title: string;
  kind: "practice" | "mcq-exam";
  durationSeconds: number;
  passRule: { mode: "points" | "percent"; threshold: number };
  ownerId: string;
  ownerRole: "admin" | "teacher";
  questions: LegacyMcqQuestion[];
}): Promise<MaterializedAssessment | null> {
  if (!input.organizationId || !input.subjectId || !input.questions.length) return null;
  if (input.questions.some((question) => question.organizationId !== input.organizationId || question.subjectId !== input.subjectId)) return null;

  const session = await mongoose.startSession();
  try {
    let result: MaterializedAssessment | null = null;
    await session.withTransaction(async () => {
      const materialized = [];
      for (const question of input.questions) {
        const questionResult = await materializeQuestion(question, session);
        if (!questionResult) throw new AdapterUnavailableError();
        materialized.push(questionResult);
      }

    let assessment = await Assessment.findOne({ "legacySource.collection": input.source.collection, "legacySource.id": input.source.id }).session(session);
    if (!assessment) {
      assessment = await Assessment.create([{
        organizationId: input.organizationId, branchId: input.branchId, academicSessionId: input.academicSessionId, subjectId: input.subjectId,
        kind: input.kind, status: "draft", ownerId: input.ownerId, ownerRole: input.ownerRole,
        legacySource: input.source,
      }], { session }).then((rows) => rows[0]);
    }
    if (!assessment) throw new Error("Could not create the canonical assessment adapter record.");
    const assessmentRecord = assessment;

    const links = materialized.map((row, order) => ({ questionVersionId: row.version._id, order, marks: row.version.marks, required: true }));
    const questionSetHash = assessmentContentHash(links.map((row) => ({ questionVersionId: String(row.questionVersionId), order: row.order, marks: row.marks, required: row.required })));
    const latest = await AssessmentVersion.findOne({ assessmentId: assessmentRecord._id, status: "published" }).sort({ version: -1 }).session(session);
    if (latest?.questionSetHash === questionSetHash && latest.title === input.title && latest.durationSeconds === input.durationSeconds && latest.passRule.mode === input.passRule.mode && latest.passRule.threshold === input.passRule.threshold) {
      result = { organizationId: assessmentRecord.organizationId, assessmentId: assessmentRecord._id, assessmentVersionId: latest._id, questionIds: materialized.map((row) => row.question._id), questionVersionIds: materialized.map((row) => row.version._id) };
      return;
    }
    if (assessmentRecord.currentDraftVersion) throw new AdapterUnavailableError();

    const totalMarks = links.reduce((total, link) => total + link.marks, 0);
    const version = await AssessmentVersion.create([{
      assessmentId: assessmentRecord._id, version: (latest?.version ?? 0) + 1, title: input.title, durationSeconds: input.durationSeconds,
      passRule: input.passRule, scoringRules: { unansweredMarks: 0, incorrectMarks: 0, rounding: "two-decimal" }, status: "draft",
      questionCount: links.length, totalMarks, questionSetHash, contentHash: "pending", createdBy: input.ownerId,
    }], { session }).then((rows) => rows[0]);
    await AssessmentQuestion.insertMany(links.map((link) => ({ ...link, assessmentVersionId: version._id })), { session });
    version.status = "published"; version.publishedBy = new Types.ObjectId(input.ownerId); version.publishedAt = new Date();
    await version.save({ session });
    assessmentRecord.status = "published"; assessmentRecord.latestPublishedVersion = version._id; assessmentRecord.currentDraftVersion = undefined;
    await assessmentRecord.save({ session });
    result = { organizationId: assessmentRecord.organizationId, assessmentId: assessmentRecord._id, assessmentVersionId: version._id, questionIds: materialized.map((row) => row.question._id), questionVersionIds: materialized.map((row) => row.version._id) };
    });
    return result;
  } catch (error) {
    if (error instanceof AdapterUnavailableError) return null;
    throw error;
  } finally {
    await session.endSession();
  }
}

export function practiceSelectionSourceId(input: { questionIds: string[]; durationSeconds: number; passMarkPercent: number }) {
  return assessmentContentHash(input);
}
