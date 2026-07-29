export type PracticeSelectionCandidate = {
  id: string;
  chapter: string;
  question: string;
};

export type PracticeSelectionHistory = {
  seenQuestionIds: string[];
  recentQuestionIds: string[];
  immediateQuestionIds: string[];
  incorrectQuestionIds: string[];
};

type SelectionInput<T extends PracticeSelectionCandidate> = {
  candidates: T[];
  history: PracticeSelectionHistory;
  maxQuestions: number;
  random?: () => number;
};

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function normalizeQuestionText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("bn")
    .replace(/[০-৯0-9]+(?:[.,][০-৯0-9]+)?/gu, "#")
    .replace(/[^\p{L}\p{N}#]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function areQuestionTextsSimilar(left: string, right: string) {
  const normalizedLeft = normalizeQuestionText(left);
  const normalizedRight = normalizeQuestionText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = new Set(normalizedLeft.split(" "));
  const rightTokens = new Set(normalizedRight.split(" "));
  const smallerSize = Math.min(leftTokens.size, rightTokens.size);
  if (smallerSize < 5) return false;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = leftTokens.size + rightTokens.size - intersection;
  const containment = intersection / smallerSize;
  const jaccard = union > 0 ? intersection / union : 0;

  return containment >= 0.9 && jaccard >= 0.72;
}

function orderAcrossChapters<T extends PracticeSelectionCandidate>(
  items: T[],
  random: () => number,
) {
  const groups = new Map<string, T[]>();
  for (const item of shuffle(items, random)) {
    const group = groups.get(item.chapter) ?? [];
    group.push(item);
    groups.set(item.chapter, group);
  }

  const chapters = shuffle([...groups.keys()], random);
  const ordered: T[] = [];
  let hasQuestions = true;
  while (hasQuestions) {
    hasQuestions = false;
    for (const chapter of chapters) {
      const question = groups.get(chapter)?.shift();
      if (!question) continue;
      ordered.push(question);
      hasQuestions = true;
    }
  }
  return ordered;
}

export function selectPracticeQuestions<T extends PracticeSelectionCandidate>({
  candidates,
  history,
  maxQuestions,
  random = Math.random,
}: SelectionInput<T>) {
  const limit = Math.max(0, Math.floor(maxQuestions));
  if (limit === 0) return [];

  const uniqueCandidates = [
    ...new Map(candidates.map((candidate) => [candidate.id, candidate])).values(),
  ];
  const seenIds = new Set(history.seenQuestionIds);
  const recentIds = new Set(history.recentQuestionIds);
  const immediateIds = new Set(history.immediateQuestionIds);
  const incorrectIds = new Set(history.incorrectQuestionIds);

  const unseen = orderAcrossChapters(
    uniqueCandidates.filter((candidate) => !seenIds.has(candidate.id)),
    random,
  );
  const weak = orderAcrossChapters(
    uniqueCandidates.filter(
      (candidate) =>
        incorrectIds.has(candidate.id) && !recentIds.has(candidate.id),
    ),
    random,
  );
  const older = orderAcrossChapters(
    uniqueCandidates.filter(
      (candidate) =>
        seenIds.has(candidate.id) &&
        !recentIds.has(candidate.id) &&
        !incorrectIds.has(candidate.id),
    ),
    random,
  );
  const recentFallback = orderAcrossChapters(
    uniqueCandidates.filter(
      (candidate) =>
        recentIds.has(candidate.id) && !immediateIds.has(candidate.id),
    ),
    random,
  );
  const immediateFallback = orderAcrossChapters(
    uniqueCandidates.filter((candidate) => immediateIds.has(candidate.id)),
    random,
  );

  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const chapterCounts = new Map<string, number>();

  function addFrom(pool: T[], requested: number, allowSimilar = false) {
    let added = 0;
    const available = pool.filter((candidate) => !selectedIds.has(candidate.id));
    while (
      added < requested &&
      selected.length < limit &&
      available.length > 0
    ) {
      let candidateIndex = -1;
      let lowestChapterCount = Number.POSITIVE_INFINITY;
      for (let index = 0; index < available.length; index += 1) {
        const candidate = available[index];
        if (
          !allowSimilar &&
          selected.some((item) =>
            areQuestionTextsSimilar(item.question, candidate.question),
          )
        ) {
          continue;
        }
        const chapterCount = chapterCounts.get(candidate.chapter) ?? 0;
        if (chapterCount < lowestChapterCount) {
          lowestChapterCount = chapterCount;
          candidateIndex = index;
        }
      }

      if (candidateIndex < 0) break;
      const [candidate] = available.splice(candidateIndex, 1);
      selected.push(candidate);
      selectedIds.add(candidate.id);
      chapterCounts.set(
        candidate.chapter,
        (chapterCounts.get(candidate.chapter) ?? 0) + 1,
      );
      added += 1;
    }
  }

  const weakTarget = limit >= 10 ? Math.max(1, Math.round(limit * 0.1)) : 0;
  const olderTarget = Math.round(limit * 0.2);
  const unseenTarget = Math.max(0, limit - weakTarget - olderTarget);

  addFrom(weak, weakTarget);
  addFrom(unseen, unseenTarget);
  addFrom(older, olderTarget);

  const nonRecent = orderAcrossChapters([...unseen, ...older, ...weak], random);
  addFrom(nonRecent, limit - selected.length);
  addFrom(recentFallback, limit - selected.length);
  addFrom(immediateFallback, limit - selected.length);

  // A small bank should still produce the requested test size even if similar
  // wording or the no-repeat window has to be relaxed.
  const allFallbacks = orderAcrossChapters(
    [...nonRecent, ...recentFallback, ...immediateFallback],
    random,
  );
  addFrom(allFallbacks, limit - selected.length, true);

  return shuffle(selected, random);
}
