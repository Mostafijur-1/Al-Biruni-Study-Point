export type AcademicLifecycleStatus = "planned" | "active" | "closed" | "archived";
export type EnrollmentStatus = "active" | "completed" | "withdrawn" | "transferred";
export type AssignmentStatus = "active" | "ended";

const lifecycleTransitions: Record<AcademicLifecycleStatus, AcademicLifecycleStatus[]> = {
  planned: ["active", "archived"],
  active: ["closed"],
  closed: ["archived"],
  archived: [],
};

export function isValidDateRange(start: Date, end: Date): boolean {
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < end;
}

export function canTransitionAcademicLifecycle(
  current: AcademicLifecycleStatus,
  next: AcademicLifecycleStatus,
): boolean {
  return current === next || lifecycleTransitions[current].includes(next);
}

export function hasEnrollmentCapacity(capacity: number, activeEnrollmentCount: number): boolean {
  return (
    Number.isSafeInteger(capacity) &&
    capacity > 0 &&
    Number.isSafeInteger(activeEnrollmentCount) &&
    activeEnrollmentCount >= 0 &&
    activeEnrollmentCount < capacity
  );
}

export function isValidRoutineWindow(startMinute: number, endMinute: number): boolean {
  return (
    Number.isSafeInteger(startMinute) &&
    Number.isSafeInteger(endMinute) &&
    startMinute >= 0 &&
    endMinute <= 24 * 60 &&
    startMinute < endMinute
  );
}

export function isEffectiveOn(
  effectiveFrom: Date,
  effectiveTo: Date | null | undefined,
  at: Date,
): boolean {
  return effectiveFrom <= at && (!effectiveTo || effectiveTo >= at);
}

export function areAcademicWritesEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
