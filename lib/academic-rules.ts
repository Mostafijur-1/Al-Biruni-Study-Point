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

export function intervalsOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function effectiveRangesOverlap(
  firstStart: Date,
  firstEnd: Date | null | undefined,
  secondStart: Date,
  secondEnd: Date | null | undefined,
): boolean {
  const firstEndTime = firstEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  const secondEndTime = secondEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  return firstStart.getTime() <= secondEndTime && secondStart.getTime() <= firstEndTime;
}

export type RoutineConflictInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
};

export function routineSlotsConflict(
  first: RoutineConflictInput,
  second: RoutineConflictInput,
): boolean {
  return (
    first.weekday === second.weekday &&
    intervalsOverlap(first.startMinute, first.endMinute, second.startMinute, second.endMinute) &&
    effectiveRangesOverlap(
      first.effectiveFrom,
      first.effectiveTo,
      second.effectiveFrom,
      second.effectiveTo,
    )
  );
}

export type ClassSessionStatus = "scheduled" | "completed" | "cancelled";

export function canTransitionClassSession(
  current: ClassSessionStatus,
  next: ClassSessionStatus,
): boolean {
  if (current === next) return true;
  return current === "scheduled" && (next === "completed" || next === "cancelled");
}

export function getZonedSchedulePosition(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const weekdayByName: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayByName[parts.weekday];
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);

  if (weekday === undefined || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Unable to resolve schedule position for timezone ${timeZone}.`);
  }
  return { weekday, minuteOfDay: hour * 60 + minute };
}
