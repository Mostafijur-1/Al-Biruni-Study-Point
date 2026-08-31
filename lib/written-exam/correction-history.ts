export type WrittenResultState = { marks: number; comment?: string };
export type WrittenResultCorrectionEvent = { sequence: number; before: WrittenResultState; after: WrittenResultState };

function sameState(left: WrittenResultState, right: WrittenResultState) {
  return left.marks === right.marks && (left.comment ?? "") === (right.comment ?? "");
}

export function replayWrittenResultCorrections(original: WrittenResultState, corrections: WrittenResultCorrectionEvent[]) {
  let current = { ...original };
  let expectedSequence = 1;
  for (const correction of [...corrections].sort((a, b) => a.sequence - b.sequence)) {
    if (correction.sequence !== expectedSequence || !sameState(current, correction.before)) throw new Error("Written result correction history is inconsistent.");
    current = { ...correction.after };
    expectedSequence += 1;
  }
  return { current, correctionSequence: expectedSequence - 1 };
}
