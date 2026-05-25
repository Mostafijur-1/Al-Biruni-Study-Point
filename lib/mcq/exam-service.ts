import { Types } from "mongoose";

import { McqQuestion } from "@/lib/db/models/McqQuestion";
import type { IMcqExam } from "@/lib/db/models/McqExam";
import type { CreateMcqExamInput } from "@/lib/validations/mcq.schema";

export function computeTotalMarks(questions: { marks: number }[]) {
  return questions.reduce((sum, question) => sum + question.marks, 0);
}

export function isPassMarkValid(passMark: number, totalMarks: number) {
  return passMark <= totalMarks;
}

export function buildQuestionDocuments(
  examId: Types.ObjectId | string,
  questions: CreateMcqExamInput["questions"],
) {
  return questions.map((question, index) => ({
    exam: examId,
    question: question.question,
    questionBn: question.questionBn || undefined,
    options: question.options,
    correctIndex: question.correctIndex,
    explanation: question.explanation || undefined,
    marks: question.marks,
    difficulty: question.difficulty,
    topic: question.topic || undefined,
    order: index,
  }));
}

export async function replaceExamQuestions(
  examId: string,
  questions: CreateMcqExamInput["questions"],
) {
  await McqQuestion.deleteMany({ exam: examId });
  await McqQuestion.insertMany(buildQuestionDocuments(examId, questions));
}

export function applyExamInput(exam: IMcqExam, parsed: CreateMcqExamInput) {
  const totalMarks = computeTotalMarks(parsed.questions);

  exam.title = parsed.title;
  exam.course = parsed.courseId ? new Types.ObjectId(parsed.courseId) : undefined;
  exam.duration = parsed.duration;
  exam.totalMarks = totalMarks;
  exam.passMark = parsed.passMark;
  exam.negativeMarking = parsed.negativeMarking;
  exam.isRandomized = parsed.isRandomized;
  exam.isPublished = parsed.isPublished;
  exam.startTime = parsed.startTime ? new Date(parsed.startTime) : undefined;
  exam.endTime = parsed.endTime ? new Date(parsed.endTime) : undefined;
  exam.attempts = parsed.attempts;
  exam.questionCount = parsed.questions.length;
}

export function createExamPayload(
  parsed: CreateMcqExamInput,
  teacherId: string,
) {
  const totalMarks = computeTotalMarks(parsed.questions);

  return {
    title: parsed.title,
    course: parsed.courseId,
    teacher: teacherId,
    duration: parsed.duration,
    totalMarks,
    passMark: parsed.passMark,
    negativeMarking: parsed.negativeMarking,
    isRandomized: parsed.isRandomized,
    isPublished: parsed.isPublished,
    startTime: parsed.startTime ? new Date(parsed.startTime) : undefined,
    endTime: parsed.endTime ? new Date(parsed.endTime) : undefined,
    attempts: parsed.attempts,
    questionCount: parsed.questions.length,
  };
}
