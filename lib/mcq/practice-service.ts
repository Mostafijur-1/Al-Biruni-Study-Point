import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db/connect";
import { PracticeQuestion } from "@/lib/db/models/PracticeQuestion";
import { getSchoolLevel, SYLLABUS } from "@/lib/content/syllabus";
import type { CourseSubject } from "@/types";

export interface JSONPracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

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
  const chapters = SYLLABUS[level]?.[subject as CourseSubject] || [];
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
  const dbQuestions = await PracticeQuestion.find({ level, subject }).lean();

  const result: Record<string, JSONPracticeQuestion[]> = {};
  const chapters = SYLLABUS[level]?.[subject as CourseSubject] || [];

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
      id: (q as any)._id.toString(),
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
  teacherId?: string
) {
  const level = getSchoolLevel(studentClass);
  await connectDB();

  const chapters = SYLLABUS[level]?.[subject as CourseSubject] || [];
  let chaptersToUse = chapters;
  if (selectedChapters && selectedChapters.length > 0) {
    chaptersToUse = chapters.filter((c) => selectedChapters.includes(c));
  }

  if (chaptersToUse.length === 0) {
    throw new Error("No valid chapters selected for practice.");
  }

  // Optimize: Query only a random sample of maxQuestions matching the selected chapters in MongoDB
  const matchQuery: any = {
    level,
    subject,
    chapter: { $in: chaptersToUse },
  };

  if (teacherId) {
    matchQuery.isTeacherSet = true;
    matchQuery.createdBy = new mongoose.Types.ObjectId(teacherId);
  } else {
    matchQuery.isTeacherSet = { $ne: true };
  }

  const dbQuestions = await PracticeQuestion.aggregate([
    {
      $match: matchQuery,
    },
    { $sample: { size: maxQuestions } },
  ]);

  const finalQuestions = dbQuestions.map((q) => ({
    id: q._id.toString(),
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
    const found = await PracticeQuestion.findOne({
      _id: questionId,
      level,
      subject,
    }).lean();
    if (found) {
      return { question: found.question, options: found.options, imageUrl: found.imageUrl };
    }
  } catch (err) {
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

  // Extract only the IDs of questions answered by the student
  const questionIds = answers.map((ans) => ans.questionId);

  // Optimize: query only the specific answered questions from MongoDB
  const dbQuestions = await PracticeQuestion.find({
    _id: { $in: questionIds },
  }).lean();

  const allQuestionsMap = new Map<string, any>();
  for (const q of dbQuestions) {
    allQuestionsMap.set(q._id.toString(), q);
  }

  let correctCount = 0;
  const solutions: { questionId: string; correctIndex: number; explanation?: string }[] = [];

  for (const ans of answers) {
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

  const totalQuestions = answers.length;
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
  };
}
