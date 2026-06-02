import { studentCanAccessClasses } from "@/lib/content/classes";
import type { SessionUser, StudentClass } from "@/types";

type ExamWithTeacher = {
  teacher: unknown;
  isPublished: boolean;
  isRandomized: boolean;
  targetClasses?: StudentClass[];
};

export function studentCanAccessExam(
  exam: Pick<ExamWithTeacher, "targetClasses">,
  studentClass?: StudentClass,
) {
  return studentCanAccessClasses(exam.targetClasses, studentClass);
}

export function shuffleQuestions<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function teacherOwnsExam(userId: string, teacherId: unknown) {
  return String(teacherId) === userId;
}

export function canReviewExam(user: SessionUser, exam: ExamWithTeacher) {
  const isOwner = teacherOwnsExam(user.id, exam.teacher);
  return user.role === "admin" || (user.role === "teacher" && isOwner);
}

export function sanitizeQuestionForStudent(question: {
  _id: unknown;
  exam: unknown;
  question: string;
  questionBn?: string;
  options: string[];
  marks: number;
  difficulty: string;
  topic?: string;
  order: number;
}) {
  return {
    _id: question._id,
    exam: question.exam,
    question: question.question,
    questionBn: question.questionBn,
    options: question.options,
    marks: question.marks,
    difficulty: question.difficulty,
    topic: question.topic,
    order: question.order,
  };
}
