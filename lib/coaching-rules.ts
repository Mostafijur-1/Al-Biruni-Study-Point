export function normalizeSubjectIds(subjectIds: readonly string[]) {
  return [...new Set(subjectIds.map(String).filter(Boolean))].sort();
}

export function isRoutineEligible(input: {
  routineBatchId: string;
  routineSubjectId: string;
  enrollmentBatchId: string;
  enrolledSubjectIds: readonly string[];
}) {
  return (
    input.routineBatchId === input.enrollmentBatchId &&
    input.enrolledSubjectIds.map(String).includes(input.routineSubjectId)
  );
}

export function isCoachingStudent(activeEnrollmentCount: number) {
  return activeEnrollmentCount > 0;
}

export function isEffectiveAt(
  effectiveFrom: Date,
  effectiveTo: Date | undefined,
  at: Date,
) {
  return effectiveFrom <= at && (!effectiveTo || effectiveTo >= at);
}

export function resolveEligibleStudentIds(input: {
  batchId: string;
  subjectId: string;
  enrollments: ReadonlyArray<{ studentId: string; batchId: string; subjectIds: readonly string[] }>;
}) {
  return [...new Set(input.enrollments
    .filter((enrollment) => isRoutineEligible({
      routineBatchId: input.batchId,
      routineSubjectId: input.subjectId,
      enrollmentBatchId: enrollment.batchId,
      enrolledSubjectIds: enrollment.subjectIds,
    }))
    .map((enrollment) => enrollment.studentId))].sort();
}
