export function getStudentCodePrefix(batch: {
  name: string;
  code?: string;
  studentIdGroup?: number;
}) {
  const year = `${batch.name} ${batch.code ?? ""}`.match(/(?:19|20)\d{2}/)?.[0];
  if (!year) return null;
  const cohort = year.slice(-2);
  const group = String(batch.studentIdGroup ?? 1).padStart(3, "0");
  return `${cohort}${group}`;
}

export function formatStudentCode(prefix: string, sequence: number) {
  if (!/^\d{5}$/.test(prefix) || !Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("Invalid student code parts.");
  }
  return `${prefix}${String(sequence).padStart(2, "0")}`;
}
