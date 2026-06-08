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

/**
 * Maps paper-split HSC subject names to their actual directory on disk.
 * e.g. "Physics 1st Paper" → "physics" folder.
 */
const SUBJECT_DIR_MAP: Partial<Record<CourseSubject, string>> = {
  "Physics 1st Paper": "physics",
  "Physics 2nd Paper": "physics",
  "Chemistry 1st Paper": "chemistry",
  "Chemistry 2nd Paper": "chemistry",
  "Higher Math 1st Paper": "higher-math",
  "Higher Math 2nd Paper": "higher-math",
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
    } catch {
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
  selectedChapters?: string[],
  maxQuestions = 25,
  secondsPerQuestion = 45
) {
  const level = getSchoolLevel(studentClass);
  const classData = await loadPracticeQuestionsData(level, subject);

  let chaptersToUse = Object.keys(classData);
  if (selectedChapters && selectedChapters.length > 0) {
    chaptersToUse = chaptersToUse.filter((c) => selectedChapters.includes(c));
  }

  if (chaptersToUse.length === 0) {
    throw new Error("No valid chapters selected for practice.");
  }

  // Collect all questions from selected chapters
  const allQuestions: JSONPracticeQuestion[] = [];
  for (const chapter of chaptersToUse) {
    const chapterQuestions = classData[chapter] || [];
    allQuestions.push(...chapterQuestions);
  }

  // Shuffle and cap to maxQuestions
  const shuffled = shuffleArray(allQuestions);
  const finalQuestions = shuffled.slice(0, maxQuestions);

  const totalQuestions = finalQuestions.length;
  // Total duration in seconds
  const durationSeconds = totalQuestions * secondsPerQuestion;

  // Sanitize questions for the student (strip correctIndex and explanation)
  const sanitizedQuestions = finalQuestions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
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
): Promise<{ question: string; options: string[] } | null> {
  const chapters = SYLLABUS[level]?.[subject as CourseSubject] || [];
  for (const chapter of chapters) {
    const filePath = getChapterFilePath(level, subject, chapter);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const questions: JSONPracticeQuestion[] = JSON.parse(content);
      const found = questions.find((q) => q.id === questionId);
      if (found) return { question: found.question, options: found.options };
    } catch {}
  }
  return null;
}

export interface PracticeAnswer {
  questionId: string;
  selectedIndex: number;
}

export async function scorePracticeAttempt(
  subject: string,
  studentClass: string,
  answers: PracticeAnswer[],
  passMarkPercent: number = 60
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
