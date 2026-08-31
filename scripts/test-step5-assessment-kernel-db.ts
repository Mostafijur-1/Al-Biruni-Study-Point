import assert from "node:assert/strict";
import mongoose from "mongoose";

import { Assessment } from "../lib/db/models/Assessment.ts";
import { AssessmentAttempt } from "../lib/db/models/AssessmentAttempt.ts";
import { AssessmentQuestion } from "../lib/db/models/AssessmentQuestion.ts";
import { AssessmentVersion } from "../lib/db/models/AssessmentVersion.ts";
import { Question } from "../lib/db/models/Question.ts";
import { QuestionVersion } from "../lib/db/models/QuestionVersion.ts";

const uri = process.env.ASSESSMENT_TEST_MONGODB_URI?.trim();
const dbName = process.env.ASSESSMENT_TEST_DB_NAME?.trim();
if (!uri) throw new Error("ASSESSMENT_TEST_MONGODB_URI is required.");
if (!dbName || !/^absp_[a-z0-9_-]*test$/i.test(dbName) || dbName.toLowerCase() === "absp") {
  throw new Error("ASSESSMENT_TEST_DB_NAME must be an explicit absp_*test database.");
}

await mongoose.connect(uri, { dbName, autoIndex: true });
try {
  await Promise.all([Question.syncIndexes(), QuestionVersion.syncIndexes(), Assessment.syncIndexes(), AssessmentVersion.syncIndexes(), AssessmentQuestion.syncIndexes(), AssessmentAttempt.syncIndexes()]);
  const organizationId = new mongoose.Types.ObjectId();
  const subjectId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();

  const question = await Question.create({ organizationId, subjectId, kind: "single-choice", language: "en", status: "approved", ownerId, ownerRole: "teacher", provenance: { sourceType: "manual" } });
  const questionVersion = await QuestionVersion.create({ questionId: question._id, version: 1, prompt: "Original prompt", options: [{ key: "a", text: "A" }, { key: "b", text: "B" }], correctResponse: { mode: "single-option", optionKeys: ["a"], acceptedTexts: [] }, marks: 1, difficulty: "easy", language: "en", status: "published", contentHash: "pending", createdBy: ownerId, publishedBy: ownerId, publishedAt: new Date() });
  question.latestPublishedVersion = questionVersion._id;
  await question.save();

  questionVersion.prompt = "Changed prompt";
  await assert.rejects(questionVersion.save(), /immutable/i);
  const updateResult = await QuestionVersion.updateOne({ _id: questionVersion._id }, { $set: { prompt: "Changed by query" } });
  assert.equal(updateResult.modifiedCount, 0);
  assert.equal((await QuestionVersion.findById(questionVersion._id).lean())?.prompt, "Original prompt");

  const assessment = await Assessment.create({ organizationId, subjectId, kind: "mcq-exam", status: "published", ownerId, ownerRole: "teacher" });
  const assessmentVersion = await AssessmentVersion.create({ assessmentId: assessment._id, version: 1, title: "Version one", passRule: { mode: "percent", threshold: 60 }, scoringRules: { unansweredMarks: 0, incorrectMarks: 0, rounding: "two-decimal" }, status: "draft", questionCount: 1, totalMarks: 1, questionSetHash: "set-one", contentHash: "pending", createdBy: ownerId });
  await AssessmentQuestion.create({ assessmentVersionId: assessmentVersion._id, questionVersionId: questionVersion._id, order: 0, marks: 1, required: true });
  assessmentVersion.status = "published"; assessmentVersion.publishedBy = ownerId; assessmentVersion.publishedAt = new Date();
  await assessmentVersion.save();
  await assert.rejects(AssessmentQuestion.updateOne({ assessmentVersionId: assessmentVersion._id }, { $set: { marks: 2 } }), /immutable/i);

  const attempt = await AssessmentAttempt.create({
    organizationId, assessmentId: assessment._id, assessmentVersionId: assessmentVersion._id, studentId, attemptNo: 1,
    assessmentSnapshot: { title: assessmentVersion.title, kind: "mcq-exam", passRule: assessmentVersion.passRule, scoringRules: assessmentVersion.scoringRules, contentHash: assessmentVersion.contentHash },
    questionSnapshots: [{ questionId: question._id, questionVersionId: questionVersion._id, contentHash: questionVersion.contentHash, prompt: "Original prompt", options: questionVersion.options, correctResponse: questionVersion.correctResponse, marks: 1 }],
    responses: [{ questionId: question._id, questionVersionId: questionVersion._id, selectedOptionKeys: ["a"], awardedMarks: 1, isCorrect: true }],
    score: 1, totalMarks: 1, percentage: 100, passed: true,
  });
  question.status = "archived";
  await question.save();
  assert.equal((await AssessmentAttempt.findById(attempt._id).lean())?.questionSnapshots[0]?.prompt, "Original prompt");

  await assert.rejects(AssessmentAttempt.create({
    organizationId, assessmentId: assessment._id, assessmentVersionId: assessmentVersion._id, studentId: new mongoose.Types.ObjectId(), attemptNo: 1,
    assessmentSnapshot: attempt.assessmentSnapshot, questionSnapshots: attempt.questionSnapshots,
    responses: [{ questionId: question._id, questionVersionId: new mongoose.Types.ObjectId(), selectedOptionKeys: [], awardedMarks: 0 }], score: 0, totalMarks: 1,
  }), /belong to the assessment snapshot/i);

  console.log(JSON.stringify({ status: "passed", database: dbName, scenarios: ["published-question-immutable", "published-assessment", "attempt-replay", "response-membership"] }, null, 2));
} finally {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
