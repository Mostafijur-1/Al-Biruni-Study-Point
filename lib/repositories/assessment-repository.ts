import type { ClientSession } from "mongoose";

import type { RequestContext } from "@/lib/application/request-context";
import { canonicalScopeFilter } from "@/lib/application/scope-policy";
import { Assessment } from "@/lib/db/models/Assessment";
import { AssessmentQuestion } from "@/lib/db/models/AssessmentQuestion";
import { AssessmentVersion } from "@/lib/db/models/AssessmentVersion";
import { Question } from "@/lib/db/models/Question";
import { QuestionVersion } from "@/lib/db/models/QuestionVersion";

export async function createQuestionRecord(input: Record<string, unknown>, session: ClientSession) {
  return (await Question.create([input], { session }))[0];
}
export async function createQuestionVersionRecord(input: Record<string, unknown>, session: ClientSession) {
  return (await QuestionVersion.create([input], { session }))[0];
}
export function findQuestionRecord(context: RequestContext, questionId: string, session?: ClientSession) {
  return Question.findOne({ ...canonicalScopeFilter(context.scope), _id: questionId }).session(session ?? null);
}
export function findQuestionVersionRecord(questionId: string, versionId: string, session?: ClientSession) {
  return QuestionVersion.findOne({ _id: versionId, questionId }).session(session ?? null);
}
export function findLatestQuestionVersion(questionId: string, session?: ClientSession) {
  return QuestionVersion.findOne({ questionId }).sort({ version: -1 }).session(session ?? null);
}
export function saveQuestionRecord<T extends { save(options?: { session?: ClientSession }): Promise<unknown> }>(record: T, session?: ClientSession) {
  return record.save({ session });
}
export function saveQuestionVersionRecord<T extends { save(options?: { session?: ClientSession }): Promise<unknown> }>(record: T, session?: ClientSession) {
  return record.save({ session });
}

export async function createAssessmentRecord(input: Record<string, unknown>, session: ClientSession) {
  return (await Assessment.create([input], { session }))[0];
}
export async function createAssessmentVersionRecord(input: Record<string, unknown>, session: ClientSession) {
  return (await AssessmentVersion.create([input], { session }))[0];
}
export function findAssessmentRecord(context: RequestContext, assessmentId: string, session?: ClientSession) {
  return Assessment.findOne({ ...canonicalScopeFilter(context.scope), _id: assessmentId }).session(session ?? null);
}
export function findAssessmentVersionRecord(assessmentId: string, versionId: string, session?: ClientSession) {
  return AssessmentVersion.findOne({ _id: versionId, assessmentId }).session(session ?? null);
}
export function findLatestAssessmentVersion(assessmentId: string, session?: ClientSession) {
  return AssessmentVersion.findOne({ assessmentId }).sort({ version: -1 }).session(session ?? null);
}
export function listAssessmentQuestions(assessmentVersionId: string | import("mongoose").Types.ObjectId, session?: ClientSession) {
  return AssessmentQuestion.find({ assessmentVersionId }).sort({ order: 1 }).session(session ?? null).lean();
}
export function listQuestionRecordsByIds(questionIds: Array<string | import("mongoose").Types.ObjectId>, session?: ClientSession) {
  return Question.find({ _id: { $in: questionIds } }).session(session ?? null).lean();
}
export async function listPublishedQuestionVersions(versionIds: string[], session?: ClientSession) {
  return QuestionVersion.find({ _id: { $in: versionIds }, status: "published" }).session(session ?? null).lean();
}
export async function insertAssessmentQuestions(rows: Array<Record<string, unknown>>, session: ClientSession) {
  return AssessmentQuestion.insertMany(rows, { session });
}
export function saveAssessmentRecord<T extends { save(options?: { session?: ClientSession }): Promise<unknown> }>(record: T, session?: ClientSession) {
  return record.save({ session });
}
export function saveAssessmentVersionRecord<T extends { save(options?: { session?: ClientSession }): Promise<unknown> }>(record: T, session?: ClientSession) {
  return record.save({ session });
}
