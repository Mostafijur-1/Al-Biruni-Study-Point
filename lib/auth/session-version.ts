export function normalizeSessionVersion(value: number | null | undefined): number {
  return Number.isSafeInteger(value) && (value ?? -1) >= 0 ? (value as number) : 0;
}

export function nextSessionVersion(value: number | null | undefined): number {
  return normalizeSessionVersion(value) + 1;
}

export function sessionVersionMatches(
  tokenVersion: number | null | undefined,
  userVersion: number | null | undefined,
): boolean {
  return normalizeSessionVersion(tokenVersion) === normalizeSessionVersion(userVersion);
}

export function sessionVersionFilter(version: number) {
  const normalizedVersion = normalizeSessionVersion(version);

  return normalizedVersion === 0
    ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] }
    : { sessionVersion: normalizedVersion };
}
