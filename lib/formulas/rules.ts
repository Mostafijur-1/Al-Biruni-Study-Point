export const FORMULA_SPRINT_SIZE = 5;

export type FormulaConfidence = "again" | "good" | "easy";

export type FormulaHistoryEntry = {
  dateKey: string;
  answers: Array<{ cardId: string; confidence: FormulaConfidence }>;
};

const CONFIDENCE_POINTS: Record<FormulaConfidence, number> = {
  again: 0,
  good: 1,
  easy: 2,
};

function seededRank(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function selectFormulaCardIds(input: {
  cardIds: string[];
  history: FormulaHistoryEntry[];
  dateKey: string;
  count?: number;
}) {
  const stats = new Map<
    string,
    { total: number; reviews: number; lastSeen: string }
  >();
  for (const entry of input.history) {
    for (const answer of entry.answers) {
      const current = stats.get(answer.cardId) ?? {
        total: 0,
        reviews: 0,
        lastSeen: "",
      };
      current.total += CONFIDENCE_POINTS[answer.confidence];
      current.reviews += 1;
      current.lastSeen =
        entry.dateKey > current.lastSeen ? entry.dateKey : current.lastSeen;
      stats.set(answer.cardId, current);
    }
  }

  return [...new Set(input.cardIds)]
    .sort((left, right) => {
      const leftStats = stats.get(left);
      const rightStats = stats.get(right);
      if (!leftStats && rightStats) return -1;
      if (leftStats && !rightStats) return 1;
      if (leftStats && rightStats) {
        const confidenceDifference =
          leftStats.total / leftStats.reviews -
          rightStats.total / rightStats.reviews;
        if (confidenceDifference !== 0) return confidenceDifference;
        const recencyDifference = leftStats.lastSeen.localeCompare(
          rightStats.lastSeen,
        );
        if (recencyDifference !== 0) return recencyDifference;
      }
      return (
        seededRank(`${input.dateKey}:${left}`) -
        seededRank(`${input.dateKey}:${right}`)
      );
    })
    .slice(0, input.count ?? FORMULA_SPRINT_SIZE);
}

export function calculateFormulaSprintReward(
  answers: Array<{ confidence: FormulaConfidence }>,
) {
  const breakdown = {
    completion: answers.length > 0 ? 5 : 0,
    recalled: answers.filter((answer) => answer.confidence === "good").length * 2,
    confident: answers.filter((answer) => answer.confidence === "easy").length * 3,
  };
  return {
    xp: breakdown.completion + breakdown.recalled + breakdown.confident,
    breakdown,
  };
}

export function calculateFormulaStreak(
  completedDateKeys: string[],
  currentDateKey: string,
) {
  const dates = [...new Set(completedDateKeys)]
    .filter((dateKey) => dateKey <= currentDateKey)
    .sort((left, right) => right.localeCompare(left));
  if (dates.length === 0) return 0;
  if (dateDifference(dates[0], currentDateKey) > 1) return 0;

  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    if (dateDifference(dates[index], dates[index - 1]) !== 1) break;
    streak += 1;
  }
  return streak;
}

export function formulaConfidencePercent(
  answers: Array<{ confidence: FormulaConfidence }>,
) {
  if (answers.length === 0) return 0;
  const points = answers.reduce(
    (total, answer) => total + CONFIDENCE_POINTS[answer.confidence],
    0,
  );
  return Math.round((points / (answers.length * 2)) * 100);
}

function dateDifference(previousDateKey: string, currentDateKey: string) {
  const previous = Date.parse(`${previousDateKey}T00:00:00Z`);
  const current = Date.parse(`${currentDateKey}T00:00:00Z`);
  return Math.round((current - previous) / 86_400_000);
}
