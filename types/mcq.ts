import type { StudentClass } from "@/types";

export type McqDifficulty = "easy" | "medium" | "hard";

export type McqExamSummary = {
  _id: string;
  title: string;
  duration: number;
  totalMarks: number;
  passMark: number;
  questionCount: number;
  targetClasses?: StudentClass[];
};

export type McqExamSummaryTeacher = McqExamSummary & {
  isPublished: boolean;
  createdAt: string;
};

export type McqExamRunnerMeta = McqExamSummary & {
  _id: string;
};

export type McqQuestionPublic = {
  _id: string;
  question: string;
  questionBn?: string;
  options: string[];
  marks: number;
};

export type McqQuestionTeacher = McqQuestionPublic & {
  correctIndex: number;
  explanation?: string;
  difficulty: McqDifficulty;
  topic?: string;
};

export type McqExamDetailTeacher = {
  title: string;
  targetClasses: StudentClass[];
  duration: number;
  passMark: number;
  negativeMarking?: number;
  attempts: number;
  isRandomized: boolean;
  isPublished: boolean;
};

export type McqResultStudent = {
  _id: string;
  score: number;
  percentage: number;
  isPassed: boolean;
  attemptNo: number;
  submittedAt: string;
  timeTaken?: number;
  exam?: { title?: string; totalMarks?: number };
  teacherComment?: string;
  commentedBy?: { _id: string; name: string };
  isPractice?: boolean;
  subject?: string;
  isCancelled?: boolean;
};

export type WrongAnswer = {
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  explanation: string | null;
};

export type McqResultTeacherRow = {
  _id: string;
  score: number;
  percentage: number;
  isPassed: boolean;
  timeTaken: number;
  attemptNo: number;
  submittedAt: string;
  student: { _id: string; name: string };
  exam: McqExamSummary & { _id: string };
  teacherComment?: string;
  deletedByTeacher?: boolean;
  wrongAnswers?: WrongAnswer[];
  isCancelled?: boolean;
};

export type McqSubmitResultData = {
  result: {
    score: number;
    percentage: number;
    isPassed: boolean;
    attemptNo: number;
  };
  totalMarks: number;
  solutions: { questionId: string; correctIndex: number; explanation?: string }[];
};
