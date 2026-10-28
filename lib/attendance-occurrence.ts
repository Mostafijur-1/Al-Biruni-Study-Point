const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export function getDhakaWeekday(date = new Date()) {
  const dhakaNow = new Date(date.getTime() + DHAKA_OFFSET_MS);
  return dhakaNow.getUTCDay();
}

export function getDhakaDayBounds(date = new Date()) {
  const dhakaDate = new Date(date.getTime() + DHAKA_OFFSET_MS);
  const localMidnightUtc = Date.UTC(
    dhakaDate.getUTCFullYear(),
    dhakaDate.getUTCMonth(),
    dhakaDate.getUTCDate(),
  );
  const dhakaMidnight = localMidnightUtc - DHAKA_OFFSET_MS;
  const start = new Date(dhakaMidnight);
  const end = new Date(dhakaMidnight + 24 * 60 * 60 * 1000 - 1); // 23:59:59.999 Dhaka time (11:59:59 PM)
  return { start, end };
}

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
    dayStart: new Date(dhakaMidnight),
    dayEnd: new Date(dhakaMidnight + 24 * 60 * 60 * 1000 - 1),
  };
}
