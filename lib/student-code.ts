function toAsciiDigits(value: string) {
  return value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
}

export function getStudentCodePrefix(batch: {
  name: string;
  code?: string;
  studentIdGroup?: number;
}) {
  const year = toAsciiDigits(`${batch.name} ${batch.code ?? ""}`).match(/(?:19|20)\d{2}/)?.[0];
  if (!year) return null;
  const cohort = year.slice(-2);
  const group = String(batch.studentIdGroup ?? 1).padStart(3, "0");
  return `${cohort}${group}`;
}

export function formatStudentCode(prefix: string, sequence: number) {
  if (!/^\d{5}$/.test(prefix) || !Number.isSafeInteger(sequence) || sequence < 1 || sequence > 99) {
    throw new Error("Invalid student code parts.");
  }
  return `${prefix}${String(sequence).padStart(2, "0")}`;
}

export function isSevenDigitStudentCode(value: string) {
  return /^\d{7}$/.test(value);
}

export function suggestNextStudentCode(prefix: string, lastSequence: number) {
  if (!/^\d{5}$/.test(prefix) || !Number.isSafeInteger(lastSequence) || lastSequence < 0 || lastSequence >= 99) {
    return null;
  }
  return formatStudentCode(prefix, lastSequence + 1);
}

export function suggestNextFromLastCode(lastStudentCode: string) {
  if (!isSevenDigitStudentCode(lastStudentCode)) return null;
  const next = Number(lastStudentCode) + 1;
  if (!Number.isSafeInteger(next) || String(next).length !== 7) return null;
  return String(next);
}

export function parseStudentCodeSequence(studentCode: string, prefix: string) {
  const code = String(studentCode);
  if (!isSevenDigitStudentCode(code) || !code.startsWith(prefix)) return null;
  const sequence = Number(code.slice(prefix.length));
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 99) return null;
  return sequence;
}

export function isValidStudentCodeForPrefix(studentCode: string, prefix: string) {
  return parseStudentCodeSequence(studentCode, prefix) !== null;
}
