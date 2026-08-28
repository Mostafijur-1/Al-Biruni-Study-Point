export function formatRoutineTime(minuteOfDay: number) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}
