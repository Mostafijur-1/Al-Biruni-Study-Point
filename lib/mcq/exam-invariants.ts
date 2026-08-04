export type ExamMarkQuestion = {
  marks?: number;
};

export type ExamInvariantInput = {
  configuredTotalMarks: number;
  passMark: number;
  questions: ExamMarkQuestion[];
};

export type ExamInvariantResult =
  | {
      ok: true;
      questionCount: number;
      totalMarks: number;
    }
  | {
      ok: false;
      code:
        | "NO_QUESTIONS"
        | "INVALID_QUESTION_MARKS"
        | "TOTAL_MARKS_MISMATCH"
        | "PASS_MARK_OUT_OF_RANGE";
      message: string;
      derivedTotalMarks?: number;
    };

export function validateExamForPublication(
  input: ExamInvariantInput,
): ExamInvariantResult {
  if (input.questions.length === 0) {
    return {
      ok: false,
      code: "NO_QUESTIONS",
      message: "Add at least one question before publishing the exam.",
    };
  }

  const marks = input.questions.map((question) => question.marks ?? 1);
  if (marks.some((mark) => !Number.isFinite(mark) || mark <= 0)) {
    return {
      ok: false,
      code: "INVALID_QUESTION_MARKS",
      message: "Every question must have a positive mark value.",
    };
  }

  const totalMarks = marks.reduce((sum, mark) => sum + mark, 0);
  if (input.configuredTotalMarks !== totalMarks) {
    return {
      ok: false,
      code: "TOTAL_MARKS_MISMATCH",
      message: `Configured total marks must equal the question total (${totalMarks}).`,
      derivedTotalMarks: totalMarks,
    };
  }

  if (input.passMark < 1 || input.passMark > totalMarks) {
    return {
      ok: false,
      code: "PASS_MARK_OUT_OF_RANGE",
      message: `Pass mark must be between 1 and ${totalMarks}.`,
      derivedTotalMarks: totalMarks,
    };
  }

  return { ok: true, questionCount: input.questions.length, totalMarks };
}

