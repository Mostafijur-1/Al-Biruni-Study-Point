export type SubmittedAnswer = {
  questionId: string;
  selectedIndex: number | null;
};

export type ScorableQuestion = {
  id: string;
  correctIndex: number;
  marks?: number;
};

export function dedupeSubmittedAnswers(answers: SubmittedAnswer[]): SubmittedAnswer[] {
  const unique = new Map<string, SubmittedAnswer>();
  for (const answer of answers) unique.set(answer.questionId, answer);
  return [...unique.values()];
}

export function scoreSubmittedAnswers(
  answers: SubmittedAnswer[],
  questions: ScorableQuestion[],
) {
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const records: Array<SubmittedAnswer & { isCorrect: boolean }> = [];
  const invalidQuestionIds: string[] = [];
  let score = 0;

  for (const answer of dedupeSubmittedAnswers(answers)) {
    const question = questionsById.get(answer.questionId);
    if (!question) {
      invalidQuestionIds.push(answer.questionId);
      continue;
    }

    const isCorrect =
      answer.selectedIndex !== null && answer.selectedIndex === question.correctIndex;
    if (isCorrect) score += question.marks ?? 1;
    records.push({ ...answer, isCorrect });
  }

  return { score, records, invalidQuestionIds };
}
