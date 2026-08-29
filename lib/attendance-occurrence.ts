const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export function getDhakaRoutineOccurrence(
  routine: { weekday: number; startMinute: number; endMinute: number },
  now = new Date(),
) {
  const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS);
  if (dhakaNow.getUTCDay() !== routine.weekday) return null;

  const localMidnightUtc = Date.UTC(
    dhakaNow.getUTCFullYear(),
    dhakaNow.getUTCMonth(),
    dhakaNow.getUTCDate(),
  );
  const dhakaMidnight = localMidnightUtc - DHAKA_OFFSET_MS;

  return {
    scheduledStart: new Date(dhakaMidnight + routine.startMinute * 60 * 1000),
    scheduledEnd: new Date(dhakaMidnight + routine.endMinute * 60 * 1000),
  };
}
