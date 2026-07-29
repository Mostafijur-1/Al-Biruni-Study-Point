import {
  BENGALI_TO_ENGLISH_SUBJECT_MAP,
  HSC_MCQ_SUBJECTS,
  SSC_MCQ_SUBJECTS,
  getSchoolLevel,
  getSyllabusChapters,
} from "@/lib/content/syllabus";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import {
  calculateChapterMastery,
  masteryLabel,
} from "@/lib/learning/rules";

export type ChapterMastery = {
  subject: string;
  chapter: string;
  score: number;
  status: "not_started" | "weak" | "improving" | "strong";
  attempts: number;
  correctAnswers: number;
  accuracy: number;
  availableQuestions: number;
  lastPracticedAt?: Date;
};

export async function getStudentMastery(
  studentId: string,
  studentClass: string,
) {
  const level = getSchoolLevel(studentClass);
  const subjects = level === "hsc" ? HSC_MCQ_SUBJECTS : SSC_MCQ_SUBJECTS;
  const attempts = await PracticeAttempt.find({
    student: studentId,
    isCancelled: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .select("subject answers createdAt")
    .lean();
  attempts.reverse();

  const questionIds = [
    ...new Set(
      attempts.flatMap((attempt) =>
        attempt.answers.map((answer) => String(answer.questionId)),
      ),
    ),
  ];

  const [attemptQuestions, availableGroups] = await Promise.all([
    PracticeQuestion.find({ _id: { $in: questionIds } })
      .select("chapter")
      .lean(),
    PracticeQuestion.aggregate<{
      _id: { subject: string; chapter: string };
      count: number;
    }>([
      { $match: { level, isTeacherSet: { $ne: true } } },
      {
        $group: {
          _id: { subject: "$subject", chapter: "$chapter" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const questionChapterMap = new Map(
    attemptQuestions.map((question) => [String(question._id), question.chapter]),
  );
  const availableMap = new Map<string, number>();
  for (const subject of subjects) {
    const englishSubject = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject] || subject;
    for (const group of availableGroups) {
      if (
        (group._id.subject === subject || group._id.subject === englishSubject) &&
        group.count > 0
      ) {
        availableMap.set(`${subject}|||${group._id.chapter}`, group.count);
      }
    }
  }

  const stats = new Map<
    string,
    { attempts: number; correctAnswers: number; lastPracticedAt?: Date }
  >();
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const chapter = questionChapterMap.get(String(answer.questionId));
      if (!chapter) continue;
      const key = `${attempt.subject}|||${chapter}`;
      const current = stats.get(key) ?? { attempts: 0, correctAnswers: 0 };
      current.attempts += 1;
      if (answer.isCorrect) current.correctAnswers += 1;
      current.lastPracticedAt = attempt.createdAt;
      stats.set(key, current);
    }
  }

  const chapters: ChapterMastery[] = [];
  for (const subject of subjects) {
    for (const chapter of getSyllabusChapters(level, subject)) {
      const key = `${subject}|||${chapter}`;
      const current = stats.get(key) ?? { attempts: 0, correctAnswers: 0 };
      const availableQuestions = availableMap.get(key) ?? 0;
      if (availableQuestions === 0 && current.attempts === 0) continue;

      const score = calculateChapterMastery(current);
      chapters.push({
        subject,
        chapter,
        score,
        status: masteryLabel(score, current.attempts),
        attempts: current.attempts,
        correctAnswers: current.correctAnswers,
        accuracy:
          current.attempts > 0
            ? Math.round((current.correctAnswers / current.attempts) * 100)
            : 0,
        availableQuestions,
        lastPracticedAt: current.lastPracticedAt,
      });
    }
  }

  const subjectSummaries = subjects
    .map((subject) => {
      const subjectChapters = chapters.filter((chapter) => chapter.subject === subject);
      if (subjectChapters.length === 0) return null;
      return {
        subject,
        score: Math.round(
          subjectChapters.reduce((sum, chapter) => sum + chapter.score, 0) /
            subjectChapters.length,
        ),
        completedChapters: subjectChapters.filter((chapter) => chapter.attempts > 0)
          .length,
        totalChapters: subjectChapters.length,
      };
    })
    .filter((summary): summary is NonNullable<typeof summary> => Boolean(summary));

  const recommendation = [...chapters]
    .filter((chapter) => chapter.availableQuestions > 0 && chapter.status !== "strong")
    .sort((a, b) => {
      const aPriority = a.status === "weak" ? 0 : a.status === "improving" ? 1 : 2;
      const bPriority = b.status === "weak" ? 0 : b.status === "improving" ? 1 : 2;
      return aPriority - bPriority || a.score - b.score;
    })[0];

  return { chapters, subjects: subjectSummaries, recommendation };
}
