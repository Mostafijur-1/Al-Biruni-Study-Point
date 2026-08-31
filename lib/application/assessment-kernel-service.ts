import { assessmentContentHash } from "@/lib/assessment-kernel";
import { Types, type ClientSession } from "mongoose";
import { DomainError } from "@/lib/application/domain-error";
import type { RequestContext } from "@/lib/application/request-context";
import { assertAdmin, assertResourceAccess } from "@/lib/application/scope-policy";
import { withMongoTransaction } from "@/lib/application/transaction";
import { createAssessmentRecord, createAssessmentVersionRecord, createQuestionRecord, createQuestionVersionRecord, findAssessmentRecord, findAssessmentVersionRecord, findLatestAssessmentVersion, findLatestQuestionVersion, findQuestionRecord, findQuestionVersionRecord, insertAssessmentQuestions, listAssessmentQuestions, listPublishedQuestionVersions, listQuestionRecordsByIds, saveAssessmentRecord, saveAssessmentVersionRecord, saveQuestionRecord, saveQuestionVersionRecord } from "@/lib/repositories/assessment-repository";

function assertAuthor(context: RequestContext) {
  if (context.actor.role !== "admin" && context.actor.role !== "teacher") {
    throw new DomainError("Only administrators and teachers can author assessments.", 403);
  }
}

function assertScopeValue(label: string, expected: string | undefined, actual: string | undefined) {
  if (expected && expected !== actual) throw new DomainError(`${label} is outside the request scope.`, 403, "FORBIDDEN");
}

export type QuestionVersionDraftInput = {
  prompt: string;
  options?: Array<{ key: string; text: string }>;
  correctResponse: { mode: "single-option" | "multiple-option" | "text" | "manual"; optionKeys?: string[]; acceptedTexts?: string[] };
  explanation?: string;
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  language: "bn" | "en" | "mixed";
};

export async function createQuestionDraft(context: RequestContext, input: {
  organizationId: string; subjectId: string; chapterId?: string; topicId?: string;
  kind: "single-choice" | "multiple-choice" | "written"; language: "bn" | "en" | "mixed";
  provenance: { sourceType: "manual" | "import" | "legacy" | "generated"; sourceId?: string; importBatchId?: string; note?: string };
  legacySource?: { collection: string; id: string }; version: QuestionVersionDraftInput;
}) {
  assertAuthor(context);
  assertScopeValue("Organization", context.scope.organizationId, input.organizationId);
  return withMongoTransaction(async (session) => {
    const question = await createQuestionRecord({
      organizationId: input.organizationId, subjectId: input.subjectId, chapterId: input.chapterId, topicId: input.topicId,
      kind: input.kind, language: input.language, status: "draft", ownerId: context.actor.id, ownerRole: context.actor.role,
      provenance: input.provenance, legacySource: input.legacySource,
    }, session);
    const version = await createQuestionVersionRecord({
      questionId: question._id, version: 1, ...input.version,
      options: input.version.options ?? [],
      correctResponse: { ...input.version.correctResponse, optionKeys: input.version.correctResponse.optionKeys ?? [], acceptedTexts: input.version.correctResponse.acceptedTexts ?? [] },
      status: "draft", contentHash: "pending", createdBy: context.actor.id,
    }, session);
    question.currentDraftVersion = version._id;
    await saveQuestionRecord(question, session);
    return { question, version };
  });
}

export async function createQuestionRevision(context: RequestContext, questionId: string, input: QuestionVersionDraftInput) {
  assertAuthor(context);
  return withMongoTransaction(async (session) => {
    const question = await findQuestionRecord(context, questionId, session);
    if (!question) throw new DomainError("Question not found.", 404);
    assertResourceAccess(context.actor, { assignedActorIds: [String(question.ownerId)] }, "You cannot revise this question.");
    if (question.currentDraftVersion) throw new DomainError("Complete or discard the current draft before creating another revision.", 409);
    const latest = await findLatestQuestionVersion(questionId, session);
    const version = await createQuestionVersionRecord({
      questionId: question._id, version: (latest?.version ?? 0) + 1, ...input, options: input.options ?? [],
      correctResponse: { ...input.correctResponse, optionKeys: input.correctResponse.optionKeys ?? [], acceptedTexts: input.correctResponse.acceptedTexts ?? [] },
      status: "draft", contentHash: "pending", createdBy: context.actor.id,
    }, session);
    question.currentDraftVersion = version._id; question.status = "draft"; question.reviewedAt = undefined; question.reviewedBy = undefined; question.reviewNote = undefined;
    await saveQuestionRecord(question, session);
    return { question, version };
  });
}

export async function reviewQuestion(context: RequestContext, questionId: string, input: { approved: boolean; note?: string }) {
  assertAdmin(context.actor);
  const question = await findQuestionRecord(context, questionId);
  if (!question) throw new DomainError("Question not found.", 404);
  if (!question.currentDraftVersion) throw new DomainError("Question has no draft version to review.", 409);
  question.status = input.approved ? "approved" : "draft";
  question.reviewedBy = new Types.ObjectId(context.actor.id); question.reviewedAt = new Date(); question.reviewNote = input.note;
  await saveQuestionRecord(question);
  return question;
}

export async function publishQuestionVersion(context: RequestContext, questionId: string, versionId: string) {
  assertAuthor(context);
  return withMongoTransaction(async (session) => {
    const question = await findQuestionRecord(context, questionId, session);
    if (!question) throw new DomainError("Question not found.", 404);
    assertResourceAccess(context.actor, { assignedActorIds: [String(question.ownerId)] }, "You cannot publish this question.");
    if (question.status !== "approved") throw new DomainError("Question must be approved before publication.", 409);
    const version = await findQuestionVersionRecord(questionId, versionId, session);
    if (!version) throw new DomainError("Question version not found.", 404);
    if (version.status === "published") return { question, version };
    if (String(question.currentDraftVersion) !== String(version._id)) throw new DomainError("Only the current draft can be published.", 409);
    version.status = "published"; version.publishedBy = new Types.ObjectId(context.actor.id); version.publishedAt = new Date();
    await saveQuestionVersionRecord(version, session);
    question.latestPublishedVersion = version._id; question.currentDraftVersion = undefined; question.status = "approved";
    await saveQuestionRecord(question, session);
    return { question, version };
  });
}

type AssessmentDraftInput = {
  title: string; instructions?: string; durationSeconds?: number;
  passRule: { mode: "points" | "percent" | "manual"; threshold?: number };
  scoringRules?: { unansweredMarks?: number; incorrectMarks?: number; rounding?: "none" | "integer" | "two-decimal" };
  questions: Array<{ questionVersionId: string; marks?: number; required?: boolean }>;
};

async function validateQuestionLinks(input: AssessmentDraftInput, organizationId: string, subjectId: string, session: ClientSession) {
  if (!input.questions.length) throw new DomainError("Assessment requires at least one published question version.", 409);
  const ids = input.questions.map((row) => row.questionVersionId);
  if (new Set(ids).size !== ids.length) throw new DomainError("Assessment cannot contain duplicate question versions.", 409);
  const versions = await listPublishedQuestionVersions(ids, session);
  if (versions.length !== ids.length) throw new DomainError("Every linked question version must be published.", 409);
  const questions = await listQuestionRecordsByIds(versions.map((row) => row.questionId), session);
  if (questions.length !== versions.length || questions.some((row) => String(row.organizationId) !== organizationId || String(row.subjectId) !== subjectId)) {
    throw new DomainError("Every assessment question must belong to the same organization and subject.", 409);
  }
  const byId = new Map(versions.map((row) => [String(row._id), row]));
  return input.questions.map((row, order) => ({ version: byId.get(row.questionVersionId)!, order, marks: row.marks ?? byId.get(row.questionVersionId)!.marks, required: row.required ?? true }));
}

export async function createAssessmentDraft(context: RequestContext, input: {
  organizationId: string; branchId?: string; academicSessionId?: string; subjectId: string; batchIds?: string[];
  kind: "practice" | "mcq-exam" | "written-exam"; legacySource?: { collection: string; id: string }; draft: AssessmentDraftInput;
}) {
  assertAuthor(context);
  assertScopeValue("Organization", context.scope.organizationId, input.organizationId);
  assertScopeValue("Branch", context.scope.branchId, input.branchId);
  assertScopeValue("Academic session", context.scope.academicSessionId, input.academicSessionId);
  return withMongoTransaction(async (session) => {
    const links = await validateQuestionLinks(input.draft, input.organizationId, input.subjectId, session);
    const assessment = await createAssessmentRecord({ organizationId: input.organizationId, branchId: input.branchId, academicSessionId: input.academicSessionId, subjectId: input.subjectId, batchIds: input.batchIds ?? [], kind: input.kind, status: "draft", ownerId: context.actor.id, ownerRole: context.actor.role, legacySource: input.legacySource }, session);
    const version = await createAssessmentVersionRecord({ assessmentId: assessment._id, version: 1, title: input.draft.title, instructions: input.draft.instructions, durationSeconds: input.draft.durationSeconds, passRule: input.draft.passRule, scoringRules: { unansweredMarks: input.draft.scoringRules?.unansweredMarks ?? 0, incorrectMarks: input.draft.scoringRules?.incorrectMarks ?? 0, rounding: input.draft.scoringRules?.rounding ?? "two-decimal" }, status: "draft", contentHash: "pending", questionSetHash: "pending", createdBy: context.actor.id }, session);
    await insertAssessmentQuestions(links.map((row) => ({ assessmentVersionId: version._id, questionVersionId: row.version._id, order: row.order, marks: row.marks, required: row.required })), session);
    assessment.currentDraftVersion = version._id; await saveAssessmentRecord(assessment, session);
    return { assessment, version };
  });
}

export async function createAssessmentRevision(context: RequestContext, assessmentId: string, draft: AssessmentDraftInput) {
  assertAuthor(context);
  return withMongoTransaction(async (session) => {
    const assessment = await findAssessmentRecord(context, assessmentId, session);
    if (!assessment) throw new DomainError("Assessment not found.", 404);
    assertResourceAccess(context.actor, { assignedActorIds: [String(assessment.ownerId)] }, "You cannot revise this assessment.");
    if (assessment.currentDraftVersion) throw new DomainError("Complete the current assessment draft before creating another revision.", 409);
    const links = await validateQuestionLinks(draft, String(assessment.organizationId), String(assessment.subjectId), session);
    const latest = await findLatestAssessmentVersion(assessmentId, session);
    const version = await createAssessmentVersionRecord({ assessmentId, version: (latest?.version ?? 0) + 1, title: draft.title, instructions: draft.instructions, durationSeconds: draft.durationSeconds, passRule: draft.passRule, scoringRules: { unansweredMarks: draft.scoringRules?.unansweredMarks ?? 0, incorrectMarks: draft.scoringRules?.incorrectMarks ?? 0, rounding: draft.scoringRules?.rounding ?? "two-decimal" }, status: "draft", contentHash: "pending", questionSetHash: "pending", createdBy: context.actor.id }, session);
    await insertAssessmentQuestions(links.map((row) => ({ assessmentVersionId: version._id, questionVersionId: row.version._id, order: row.order, marks: row.marks, required: row.required })), session);
    assessment.currentDraftVersion = version._id; assessment.status = "draft"; await saveAssessmentRecord(assessment, session);
    return { assessment, version };
  });
}

export async function publishAssessmentVersion(context: RequestContext, assessmentId: string, versionId: string) {
  assertAuthor(context);
  return withMongoTransaction(async (session) => {
    const assessment = await findAssessmentRecord(context, assessmentId, session);
    if (!assessment) throw new DomainError("Assessment not found.", 404);
    assertResourceAccess(context.actor, { assignedActorIds: [String(assessment.ownerId)] }, "You cannot publish this assessment.");
    const version = await findAssessmentVersionRecord(assessmentId, versionId, session);
    if (!version) throw new DomainError("Assessment version not found.", 404);
    if (version.status === "published") return { assessment, version };
    if (String(assessment.currentDraftVersion) !== String(version._id)) throw new DomainError("Only the current draft can be published.", 409);
    const links = await listAssessmentQuestions(version._id, session);
    if (!links.length) throw new DomainError("Assessment requires at least one question.", 409);
    const publishedQuestions = await listPublishedQuestionVersions(links.map((row) => String(row.questionVersionId)), session);
    if (publishedQuestions.length !== links.length) throw new DomainError("Every assessment question must reference a published version.", 409);
    const totalMarks = links.reduce((sum, row) => sum + row.marks, 0);
    if (version.passRule.mode === "points" && (version.passRule.threshold ?? 0) > totalMarks) throw new DomainError("Point pass threshold cannot exceed total marks.", 409);
    const hashRows = links.map((row) => ({ questionVersionId: String(row.questionVersionId), order: row.order, marks: row.marks, required: row.required }));
    version.questionCount = links.length; version.totalMarks = totalMarks; version.questionSetHash = assessmentContentHash(hashRows);
    version.status = "published"; version.publishedBy = new Types.ObjectId(context.actor.id); version.publishedAt = new Date();
    await saveAssessmentVersionRecord(version, session);
    assessment.latestPublishedVersion = version._id; assessment.currentDraftVersion = undefined; assessment.status = "published";
    await saveAssessmentRecord(assessment, session);
    return { assessment, version };
  });
}
