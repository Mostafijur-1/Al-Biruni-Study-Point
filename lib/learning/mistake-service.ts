import { Types } from "mongoose";

import { MistakeReview } from "@/lib/db/models/MistakeReview";
import { PracticeAttempt, type IPracticeAnswer } from "@/lib/db/models/PracticeAttempt";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { StudentLearningProfile } from "@/lib/db/models/StudentLearningProfile";
import {
  getNextReviewAt,
  isMistakeMastered,
} from "@/lib/learning/rules";

type SyncMistakesInput = {
  studentId: string;
  subject: string;
  answers: IPracticeAnswer[];
  attemptedAt: Date;
};

export async function syncMistakesFromAnswers(input: SyncMistakesInput) {
  const validQuestionIds = input.answers
    .map((answer) => String(answer.questionId))
    .filter((questionId) => Types.ObjectId.isValid(questionId));

  if (validQuestionIds.length === 0) return;

  const [questions, existingReviews] = await Promise.all([
    PracticeQuestion.find({ _id: { $in: validQuestionIds } })
      .select("chapter question options correctIndex explanation imageUrl")
      .lean(),
    MistakeReview.find({
      student: input.studentId,
      question: { $in: validQuestionIds },
    }).lean(),
  ]);

  const questionMap = new Map(questions.map((question) => [String(question._id), question]));
  const reviewMap = new Map(
    existingReviews.map((review) => [String(review.question), review]),
  );
  const operations: Parameters<typeof MistakeReview.bulkWrite>[0] = [];

  for (const answer of input.answers) {
    const questionId = String(answer.questionId);
    const question = questionMap.get(questionId);
    if (!question) continue;

    const existing = reviewMap.get(questionId);
    if (!answer.isCorrect) {
      if (existing) {
        operations.push({
          updateOne: {
            filter: { _id: existing._id },
            update: {
              $set: {
                subject: input.subject,
                chapter: question.chapter,
                questionText: question.question,
                options: question.options,
                correctIndex: question.correctIndex,
                explanation: question.explanation,
                imageUrl: question.imageUrl,
                correctStreak: 0,
                status: "active",
                nextReviewAt: getNextReviewAt(input.attemptedAt, false, 0),
                lastWrongAt: input.attemptedAt,
                lastReviewedAt: input.attemptedAt,
              },
              $unset: { masteredAt: "" },
              $inc: { wrongCount: 1 },
            },
          },
        });
      } else {
        operations.push({
          insertOne: {
            document: {
              student: new Types.ObjectId(input.studentId),
              question: question._id,
              subject: input.subject,
              chapter: question.chapter,
              questionText: question.question,
              options: question.options,
              correctIndex: question.correctIndex,
              explanation: question.explanation,
              imageUrl: question.imageUrl,
              wrongCount: 1,
              reviewCount: 0,
              correctStreak: 0,
              status: "active",
              nextReviewAt: getNextReviewAt(input.attemptedAt, false, 0),
              lastWrongAt: input.attemptedAt,
              lastReviewedAt: input.attemptedAt,
            },
          },
        });
      }
      continue;
    }

    if (!existing) continue;
    const correctStreak = existing.correctStreak + 1;
    const mastered = isMistakeMastered(correctStreak);
    operations.push({
      updateOne: {
        filter: { _id: existing._id },
        update: {
          $set: {
            correctStreak,
            status: mastered ? "mastered" : "active",
            nextReviewAt: getNextReviewAt(input.attemptedAt, true, correctStreak),
            lastReviewedAt: input.attemptedAt,
            ...(mastered ? { masteredAt: input.attemptedAt } : {}),
          },
          $inc: { reviewCount: 1 },
        },
      },
    });
  }

  if (operations.length > 0) {
    await MistakeReview.bulkWrite(operations, { ordered: false });
  }
}

export async function backfillMistakesForStudent(studentId: string) {
  const learningProfile = await StudentLearningProfile.findOne({
    student: studentId,
  })
    .select("mistakesBackfilledAt")
    .lean();
  if (learningProfile?.mistakesBackfilledAt) return;

  const attempts = await PracticeAttempt.find({
    student: studentId,
    isCancelled: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  for (const attempt of attempts.reverse()) {
    await syncMistakesFromAnswers({
      studentId,
      subject: attempt.subject,
      answers: attempt.answers,
      attemptedAt: attempt.createdAt,
    });
  }

  await StudentLearningProfile.findOneAndUpdate(
    { student: studentId },
    { $set: { mistakesBackfilledAt: new Date() } },
    { upsert: true, new: true },
  );
}

export async function recordMistakeReviewAnswer(input: {
  studentId: string;
  mistakeId: string;
  selectedIndex: number;
  reviewedAt?: Date;
}) {
  const mistake = await MistakeReview.findOne({
    _id: input.mistakeId,
    student: input.studentId,
  });
  if (!mistake) return null;

  const reviewedAt = input.reviewedAt ?? new Date();
  const isCorrect = input.selectedIndex === mistake.correctIndex;
  const correctStreak = isCorrect ? mistake.correctStreak + 1 : 0;
  const mastered = isMistakeMastered(correctStreak);

  mistake.reviewCount += 1;
  mistake.correctStreak = correctStreak;
  mistake.status = mastered ? "mastered" : "active";
  mistake.nextReviewAt = getNextReviewAt(reviewedAt, isCorrect, correctStreak);
  mistake.lastReviewedAt = reviewedAt;
  if (!isCorrect) {
    mistake.wrongCount += 1;
    mistake.lastWrongAt = reviewedAt;
    mistake.masteredAt = undefined;
  } else if (mastered) {
    mistake.masteredAt = reviewedAt;
  }
  await mistake.save();

  return {
    isCorrect,
    correctIndex: mistake.correctIndex,
    explanation: mistake.explanation,
    status: mistake.status,
    correctStreak: mistake.correctStreak,
    nextReviewAt: mistake.nextReviewAt,
  };
}
