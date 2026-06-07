import fs from "fs/promises";
import path from "path";

import { getSchoolLevel, SYLLABUS } from "@/lib/content/syllabus";
import type { CourseSubject } from "@/types";

export interface JSONPracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

const QUESTIONS_PER_CHAPTER = 2; // Fixed number of questions per chapter

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getChapterFilePath(level: "ssc" | "hsc", subject: string, chapter: string): string {
  const subjectDir = subject.toLowerCase().replace(/\s+/g, "-");
  const chapterSlug = chapter
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return path.join(process.cwd(), "lib", "data", "practice", level, subjectDir, `${chapterSlug}.json`);
}

export async function loadPracticeQuestionsData(
  level: "ssc" | "hsc",
  subject: string
): Promise<Record<string, JSONPracticeQuestion[]>> {
  const result: Record<string, JSONPracticeQuestion[]> = {};
  const chapters = SYLLABUS[level]?.[subject as CourseSubject] || [];

  for (const chapter of chapters) {
    const filePath = getChapterFilePath(level, subject, chapter);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      result[chapter] = JSON.parse(content) as JSONPracticeQuestion[];
    } catch (error) {
      // Ignore if chapter file does not exist (no questions uploaded yet)
    }
  }

  return result;
}

export async function getChaptersForSubject(
  subject: string,
  studentClass: string
): Promise<string[]> {
  const level = getSchoolLevel(studentClass);
  const classData = await loadPracticeQuestionsData(level, subject);
  return Object.keys(classData);
}

export async function startPracticeExam(
  subject: string,
  studentClass: string,
  selectedChapters?: string[]
) {
  const level = getSchoolLevel(studentClass);
  const classData = await loadPracticeQuestionsData(level, subject);

  let chaptersToUse = Object.keys(classData);
  if (selectedChapters && selectedChapters.length > 0) {
    // Filter to valid selected chapters
    chaptersToUse = chaptersToUse.filter((c) => selectedChapters.includes(c));
  }

  if (chaptersToUse.length === 0) {
    throw new Error("No valid chapters selected for practice.");
  }

  const selectedQuestions: JSONPracticeQuestion[] = [];

  for (const chapter of chaptersToUse) {
    const chapterQuestions = classData[chapter] || [];
    if (chapterQuestions.length === 0) continue;

    // Shuffle and pick QUESTIONS_PER_CHAPTER
    const shuffledChapterQs = shuffleArray(chapterQuestions);
    const countToPick = Math.min(shuffledChapterQs.length, QUESTIONS_PER_CHAPTER);
    selectedQuestions.push(...shuffledChapterQs.slice(0, countToPick));
  }

  // Shuffle the final merged list of questions
  const finalShuffledQuestions = shuffleArray(selectedQuestions);

  const totalQuestions = finalShuffledQuestions.length;
  // Calculate duration in minutes: 1.5 minutes per question
  const duration = Math.max(1, Math.ceil(totalQuestions * 1.5));

  // Sanitize questions for the student (strip correctIndex and explanation)
  const sanitizedQuestions = finalShuffledQuestions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
  }));

  return {
    questions: sanitizedQuestions,
    subject,
    duration,
    totalQuestions,
  };
}

export async function scorePracticeAttempt(
  subject: string,
  studentClass: string,
  answers: { questionId: string; selectedIndex: number }[]
) {
  const level = getSchoolLevel(studentClass);
  const classData = await loadPracticeQuestionsData(level, subject);

  // Flatten all questions for this subject/class to easily search by ID
  const allQuestionsMap = new Map<string, JSONPracticeQuestion>();
  for (const chapter of Object.keys(classData)) {
    for (const q of classData[chapter]) {
      allQuestionsMap.set(q.id, q);
    }
  }

  let correctCount = 0;
  const solutions: { questionId: string; correctIndex: number; explanation?: string }[] = [];

  for (const ans of answers) {
    const question = allQuestionsMap.get(ans.questionId);
    if (!question) continue;

    const isCorrect = ans.selectedIndex === question.correctIndex;
    if (isCorrect) {
      correctCount++;
    }

    solutions.push({
      questionId: question.id,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    });
  }

  const totalQuestions = answers.length;
  const score = correctCount;
  const percentage = totalQuestions > 0 ? Number(((score / totalQuestions) * 100).toFixed(2)) : 0;
  const isPassed = percentage >= 50.0; // 50% pass mark for practice

  return {
    score,
    totalQuestions,
    percentage,
    isPassed,
    solutions,
  };
}
