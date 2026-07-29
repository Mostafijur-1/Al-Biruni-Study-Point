import path from "path";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { PracticeAttempt } from "@/lib/db/models/PracticeAttempt";
import {
  BENGALI_TO_ENGLISH_SUBJECT_MAP,
  getSchoolLevel,
  getSubjectAliases,
  getSyllabusChapters,
} from "@/lib/content/syllabus";
import type { CourseSubject } from "@/types";
import { dedupeSubmittedAnswers } from "@/lib/mcq/answer-scoring";
import {
  selectPracticeQuestions,
  type PracticeSelectionHistory,
} from "@/lib/mcq/practice-selection";

export interface JSONPracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

type PracticeQuestionCandidateDocument = {
  _id: mongoose.Types.ObjectId;
  chapter: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  imageUrl?: string;
};

type PracticeQuestionCandidateBuckets = {
  unseen: PracticeQuestionCandidateDocument[];
  weak: PracticeQuestionCandidateDocument[];
  older: PracticeQuestionCandidateDocument[];
  recentFallback: PracticeQuestionCandidateDocument[];
  immediateFallback: PracticeQuestionCandidateDocument[];
};

/**
 * Maps paper-split HSC subject names to their actual directory on disk.
 * e.g. "Physics 1st Paper" → "physics" folder.
 */
const SUBJECT_DIR_MAP: Partial<Record<CourseSubject, string>> = {
  "পদার্থবিজ্ঞান": "physics",
  "পদার্থবিজ্ঞান ১ম পত্র": "physics",
  "পদার্থবিজ্ঞান ২য় পত্র": "physics",
  "রসায়ন": "chemistry",
  "রসায়ন ১ম পত্র": "chemistry",
  "রসায়ন ২য় পত্র": "chemistry",
  "সাধারণ গণিত": "math",
  "উচ্চতর গণিত": "higher-math",
  "উচ্চতর গণিত ১ম পত্র": "higher-math",
  "উচ্চতর গণিত ২য় পত্র": "higher-math",
  "জীববিজ্ঞান": "biology",
  "জীববিজ্ঞান ১ম পত্র": "biology",
  "জীববিজ্ঞান ২য় পত্র": "biology",
  "তথ্য ও যোগাযোগ প্রযুক্তি": "ict",
  "বাংলা ১ম পত্র": "bangla",
  "বাংলা ২য় পত্র": "bangla",
  "ইংরেজি ১ম পত্র": "english",
  "ইংরেজি ২য় পত্র": "english",
  "ইসলাম ও নৈতিক শিক্ষা": "islam-education",
  "বাংলাদেশ ও বিশ্বপরিচয়": "bgs",
};

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getChapterFilePath(level: "ssc" | "hsc", subject: string, chapter: string): string {
  // Use the directory map if available (paper-split subjects share parent dir)
  const mappedDir = SUBJECT_DIR_MAP[subject as CourseSubject];
  const subjectDir = mappedDir ?? subject.toLowerCase().replace(/\s+/g, "-");
  const chapterSlug = chapter
    .toLowerCase()
    .replace(/[^\u0980-\u09FFa-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  let fileName = chapterSlug;
  if (mappedDir) {
    const prefix = subject.toLowerCase().replace(/\s+/g, "-");
    fileName = `${prefix}-${chapterSlug}`;
  }

  return path.join(process.cwd(), "lib", "data", "practice", level, subjectDir, `${fileName}.json`);
}

export function getChapterFromSlug(
  level: "ssc" | "hsc",
  subject: string,
  slug: string
): string | null {
  // Use getSyllabusChapters to handle Bengali subject names
  const chapters = getSyllabusChapters(level, subject);
  const subjectPrefix = subject.toLowerCase().replace(/\s+/g, "-");

  for (const chapter of chapters) {
    const chapterSlug = chapter
      .toLowerCase()
      .replace(/[^\u0980-\u09FFa-zA-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (chapterSlug === slug || `${subjectPrefix}-${chapterSlug}` === slug) {
      return chapter;
    }
  }
  return null;
}

export async function loadPracticeQuestionsData(
  level: "ssc" | "hsc",
  subject: string
): Promise<Record<string, JSONPracticeQuestion[]>> {
  await connectDB();
  const englishSubject = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject] || subject;
  const dbQuestions = await PracticeQuestion.find({
    level,
    subject: { $in: [subject, englishSubject] }
  }).lean();

  const result: Record<string, JSONPracticeQuestion[]> = {};
  // Use getSyllabusChapters to handle Bengali subject names correctly
  const chapters = getSyllabusChapters(level, subject);

  // Initialize all syllabus chapters to empty arrays
  for (const chapter of chapters) {
    result[chapter] = [];
  }

  // Populate list
  for (const q of dbQuestions) {
    const chapterName = q.chapter;
    if (!result[chapterName]) {
      result[chapterName] = [];
    }
    result[chapterName].push({
      id: q._id.toString(),
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    });
  }

  return result;
}

export async function getChaptersForSubject(
  subject: string,
  studentClass: string
): Promise<Array<{ name: string; hasMcqs: boolean }>> {
  const level = getSchoolLevel(studentClass);
  const classData = await loadPracticeQuestionsData(level, subject);
  return Object.keys(classData).map((chapter) => ({
    name: chapter,
    hasMcqs: classData[chapter] && classData[chapter].length > 0,
  }));
}

export async function startPracticeExam(
  subject: string,
  studentClass: string,
  selectedChapters?: string[],
  maxQuestions = 25,
  secondsPerQuestion = 45,
  teacherId?: string,
  studentId?: string,
) {
  const level = getSchoolLevel(studentClass);
  await connectDB();

  // Use getSyllabusChapters to handle Bengali subject names
  const chapters = getSyllabusChapters(level, subject);
  let chaptersToUse = chapters;
  if (selectedChapters && selectedChapters.length > 0) {
    chaptersToUse = chapters.filter((c) => selectedChapters.includes(c));
  }

  if (chaptersToUse.length === 0) {
    throw new Error("No valid chapters selected for practice.");
  }

  const englishSubject = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject] || subject;
  const matchQuery: Record<string, unknown> = {
    level,
    subject: { $in: [subject, englishSubject] },
    chapter: { $in: chaptersToUse },
  };

  if (teacherId) {
    matchQuery.isTeacherSet = true;
    matchQuery.createdBy = new mongoose.Types.ObjectId(teacherId);
  } else {
    matchQuery.isTeacherSet = { $ne: true };
  }

  const emptyHistory: PracticeSelectionHistory = {
    seenQuestionIds: [],
    recentQuestionIds: [],
    immediateQuestionIds: [],
    incorrectQuestionIds: [],
  };
  let history = emptyHistory;

  if (studentId && mongoose.isValidObjectId(studentId)) {
    const attemptQuery: Record<string, unknown> = {
      student: new mongoose.Types.ObjectId(studentId),
      subject: { $in: getSubjectAliases(subject) },
    };
    if (teacherId && mongoose.isValidObjectId(teacherId)) {
      attemptQuery.isTeacherSet = true;
      attemptQuery.teacherId = new mongoose.Types.ObjectId(teacherId);
    } else {
      attemptQuery.isTeacherSet = { $ne: true };
    }

    const attempts = await PracticeAttempt.find(attemptQuery)
      .sort({ createdAt: -1 })
      .limit(20)
      .select("answers.questionId answers.isCorrect")
      .lean();
    const answerIds = (attempt: (typeof attempts)[number]) =>
      attempt.answers.map((answer) => String(answer.questionId));

    history = {
      seenQuestionIds: attempts.flatMap(answerIds),
      recentQuestionIds: attempts.slice(0, 3).flatMap(answerIds),
      immediateQuestionIds: attempts.slice(0, 1).flatMap(answerIds),
      incorrectQuestionIds: attempts.flatMap((attempt) =>
        attempt.answers
          .filter((answer) => !answer.isCorrect)
          .map((answer) => String(answer.questionId)),
      ),
    };
  }

  const toObjectIds = (ids: string[]) =>
    [...new Set(ids)]
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  const seenObjectIds = toObjectIds(history.seenQuestionIds);
  const recentObjectIds = toObjectIds(history.recentQuestionIds);
  const immediateObjectIds = toObjectIds(history.immediateQuestionIds);
  const incorrectObjectIds = toObjectIds(history.incorrectQuestionIds);
  const sampleSize = Math.max(100, maxQuestions * 6);
  const [candidateBuckets] =
    await PracticeQuestion.aggregate<PracticeQuestionCandidateBuckets>([
    { $match: matchQuery },
    {
      $facet: {
        unseen: [
          { $match: { _id: { $nin: seenObjectIds } } },
          { $sample: { size: sampleSize } },
        ],
        weak: [
          {
            $match: {
              _id: { $in: incorrectObjectIds, $nin: recentObjectIds },
            },
          },
          { $sample: { size: sampleSize } },
        ],
        older: [
          {
            $match: {
              _id: {
                $in: seenObjectIds,
                $nin: [...recentObjectIds, ...incorrectObjectIds],
              },
            },
          },
          { $sample: { size: sampleSize } },
        ],
        recentFallback: [
          {
            $match: {
              _id: { $in: recentObjectIds, $nin: immediateObjectIds },
            },
          },
          { $sample: { size: sampleSize } },
        ],
        immediateFallback: [
          { $match: { _id: { $in: immediateObjectIds } } },
          { $sample: { size: sampleSize } },
        ],
      },
    },
    ]);
  const bucketValues = candidateBuckets
    ? Object.values(candidateBuckets).flat()
    : [];
  const candidateQuestions = bucketValues.map((question) => ({
    ...question,
    id: question._id.toString(),
  }));
  const dbQuestions = selectPracticeQuestions({
    candidates: candidateQuestions,
    history,
    maxQuestions,
  });

  const finalQuestions = dbQuestions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    imageUrl: q.imageUrl,
  }));

  const totalQuestions = finalQuestions.length;
  // Total duration in seconds
  const durationSeconds = totalQuestions * secondsPerQuestion;

  // Sanitize questions for the student (strip correctIndex and explanation)
  const sanitizedQuestions = finalQuestions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    imageUrl: q.imageUrl,
  }));

  return {
    questions: sanitizedQuestions,
    subject,
    durationSeconds,
    totalQuestions,
    secondsPerQuestion,
  };
}

export async function loadFullQuestionById(
  level: "ssc" | "hsc",
  subject: string,
  questionId: string
): Promise<{ question: string; options: string[]; imageUrl?: string } | null> {
  await connectDB();
  try {
    const englishSubject = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject] || subject;
    const found = await PracticeQuestion.findOne({
      _id: questionId,
      level,
      subject: { $in: [subject, englishSubject] },
    }).lean();
    if (found) {
      return { question: found.question, options: found.options, imageUrl: found.imageUrl };
    }
  } catch {
    // Ignore casting errors if questionId is not a valid ObjectId
  }
  return null;
}

export interface PracticeAnswer {
  questionId: string;
  selectedIndex: number | null;
}

export async function scorePracticeAttempt(
  subject: string,
  studentClass: string,
  answers: PracticeAnswer[],
  passMarkPercent: number = 60
) {
  await connectDB();

  const uniqueAnswers = dedupeSubmittedAnswers(answers);
  const questionIds = uniqueAnswers.map((answer) => answer.questionId);
  const level = getSchoolLevel(studentClass);
  const englishSubject = BENGALI_TO_ENGLISH_SUBJECT_MAP[subject] || subject;

  // Optimize: query only the specific answered questions from MongoDB
  const dbQuestions = await PracticeQuestion.find({
    _id: { $in: questionIds },
    level,
    subject: { $in: [subject, englishSubject] },
  }).lean();

  const allQuestionsMap = new Map<string, (typeof dbQuestions)[number]>();
  for (const q of dbQuestions) {
    allQuestionsMap.set(q._id.toString(), q);
  }

  let correctCount = 0;
  const solutions: { questionId: string; correctIndex: number; explanation?: string }[] = [];

  for (const ans of uniqueAnswers) {
    const question = allQuestionsMap.get(ans.questionId);
    if (!question) continue;

    const isCorrect =
      ans.selectedIndex !== null && ans.selectedIndex === question.correctIndex;
    if (isCorrect) {
      correctCount++;
    }

    solutions.push({
      questionId: ans.questionId,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    });
  }

  const invalidQuestionIds = uniqueAnswers
    .filter((answer) => !allQuestionsMap.has(answer.questionId))
    .map((answer) => answer.questionId);
  const totalQuestions = uniqueAnswers.length;
  const score = correctCount;
  const percentage =
    totalQuestions > 0 ? Number(((score / totalQuestions) * 100).toFixed(2)) : 0;
  const isPassed = percentage >= passMarkPercent;

  return {
    score,
    totalQuestions,
    percentage,
    isPassed,
    passMarkPercent,
    solutions,
    invalidQuestionIds,
  };
}
