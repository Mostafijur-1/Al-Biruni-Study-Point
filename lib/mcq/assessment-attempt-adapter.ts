import { Assessment } from "../db/models/Assessment.ts";
import { AssessmentAttempt } from "../db/models/AssessmentAttempt.ts";
import { AssessmentQuestion } from "../db/models/AssessmentQuestion.ts";
import { AssessmentVersion } from "../db/models/AssessmentVersion.ts";
import { AttemptSession } from "../db/models/AttemptSession.ts";
import { QuestionVersion } from "../db/models/QuestionVersion.ts";

export async function recordAuthoritativeAssessmentAttempt(input: {
  attemptSessionId: string;
  studentId: string;
  responses: Array<{ questionId: string; selectedIndex: number | null; awardedMarks: number; isCorrect: boolean }>;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  submittedAt: Date;
  voided?: boolean;
}) {
  const existing = await AssessmentAttempt.findOne({ "legacySource.collection": "AttemptSession", "legacySource.id": input.attemptSessionId });
  if (existing) return existing;

  const attemptSession = await AttemptSession.findOne({ _id: input.attemptSessionId, student: input.studentId });
  if (!attemptSession?.organizationId || !attemptSession.assessmentId || !attemptSession.assessmentVersionId || attemptSession.questionVersionIds.length !== attemptSession.questionIds.length) return null;
  const [assessment, version, links, questionVersions] = await Promise.all([
    Assessment.findById(attemptSession.assessmentId).lean(),
    AssessmentVersion.findOne({ _id: attemptSession.assessmentVersionId, status: "published" }).lean(),
    AssessmentQuestion.find({ assessmentVersionId: attemptSession.assessmentVersionId }).sort({ order: 1 }).lean(),
    QuestionVersion.find({ _id: { $in: attemptSession.questionVersionIds }, status: "published" }).lean(),
  ]);
  if (!assessment || !version || links.length !== attemptSession.questionVersionIds.length || questionVersions.length !== links.length) return null;

  const versionById = new Map(questionVersions.map((row) => [String(row._id), row]));
  const legacyToVersion = new Map(attemptSession.questionIds.map((id, index) => [String(id), String(attemptSession.questionVersionIds[index])]));
  const questionSnapshots = attemptSession.questionVersionIds.map((id) => versionById.get(String(id))).filter((row): row is NonNullable<typeof row> => Boolean(row)).map((row) => ({
    questionId: row.questionId, questionVersionId: row._id, contentHash: row.contentHash, prompt: row.prompt,
    options: row.options.map((option) => ({ key: option.key, text: option.text })),
    correctResponse: { mode: row.correctResponse.mode, optionKeys: [...row.correctResponse.optionKeys], acceptedTexts: [...row.correctResponse.acceptedTexts] },
    explanation: row.explanation, marks: row.marks,
  }));
  if (questionSnapshots.length !== attemptSession.questionVersionIds.length) return null;

  const responses = input.responses.map((response) => {
    const questionVersionId = legacyToVersion.get(response.questionId);
    const snapshot = questionSnapshots.find((row) => String(row.questionVersionId) === questionVersionId);
    if (!questionVersionId || !snapshot) return null;
    return {
      questionId: snapshot.questionId, questionVersionId,
      selectedOptionKeys: response.selectedIndex === null ? [] : [String(response.selectedIndex)],
      awardedMarks: response.awardedMarks, isCorrect: response.isCorrect,
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (responses.length !== input.responses.length) return null;

  const attemptNo = await AssessmentAttempt.countDocuments({ studentId: input.studentId, assessmentVersionId: version._id }) + 1;
  try {
    return await AssessmentAttempt.create({
      organizationId: attemptSession.organizationId, assessmentId: assessment._id, assessmentVersionId: version._id,
      studentId: input.studentId, attemptNo,
      status: input.voided ? "voided" : "submitted",
      assessmentSnapshot: {
        title: version.title, kind: assessment.kind, durationSeconds: version.durationSeconds,
        passRule: { mode: version.passRule.mode, threshold: version.passRule.threshold },
        scoringRules: { unansweredMarks: version.scoringRules.unansweredMarks, incorrectMarks: version.scoringRules.incorrectMarks, rounding: version.scoringRules.rounding },
        contentHash: version.contentHash,
      },
      questionSnapshots, responses, score: input.score, totalMarks: input.totalMarks, percentage: input.percentage, passed: input.passed,
      startedAt: attemptSession.startedAt, submittedAt: input.submittedAt,
      voidedAt: input.voided ? input.submittedAt : undefined,
      voidReason: input.voided ? "Student cancelled attempt." : undefined,
      legacySource: { collection: "AttemptSession", id: input.attemptSessionId },
    });
  } catch (error) {
    const raced = await AssessmentAttempt.findOne({ "legacySource.collection": "AttemptSession", "legacySource.id": input.attemptSessionId });
    if (raced) return raced;
    throw error;
  }
}
