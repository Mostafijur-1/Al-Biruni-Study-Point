export function parseCorrectIndex(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3) {
    return value;
  }

  if (typeof value === "string" && /^[0-3]$/.test(value.trim())) {
    return Number(value.trim());
  }

  return null;
}
