import type { IMcqQuestion } from "@/lib/db/models/McqQuestion";

export type SubmittedAnswer = {
  questionId: string;
  selectedIndex: number;
};

export function scoreMcqAttempt({
  questions,
  submittedAnswers,
  negativeMarking,
  passMark,
}: {
  questions: IMcqQuestion[];
  submittedAnswers: SubmittedAnswer[];
  negativeMarking: number;
  passMark: number;
}) {
  const answerMap = new Map(
    submittedAnswers.map((answer) => [answer.questionId, answer.selectedIndex]),
  );

  const checkedAnswers = questions.flatMap((question) => {
    const selectedIndex = answerMap.get(String(question._id));

    if (selectedIndex === undefined) {
      return [];
    }

    const isCorrect = selectedIndex === question.correctIndex;

    return {
      questionId: question._id,
      selectedIndex,
      isCorrect,
      marksAwarded: isCorrect ? question.marks : -negativeMarking,
    };
  });

  const rawScore = checkedAnswers.reduce(
    (sum, answer) => sum + answer.marksAwarded,
    0,
  );
  const score = Math.max(0, rawScore);
  const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);
  const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;

  return {
    answers: checkedAnswers,
    score,
    totalMarks,
    percentage,
    isPassed: score >= passMark,
  };
}
