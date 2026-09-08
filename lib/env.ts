export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

type IntegerEnvOptions = {
  min?: number;
  max?: number;
};

export function getIntegerEnv(
  name: string,
  fallback: number,
  options: IntegerEnvOptions = {},
): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  const min = options.min ?? Number.MIN_SAFE_INTEGER;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;

  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }

  return value;
}
