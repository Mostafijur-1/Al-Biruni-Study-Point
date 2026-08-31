import { createHash } from "node:crypto";

export type KernelResponse = {
  questionVersionId: string;
  selectedOptionKeys?: string[];
  textResponse?: string;
};

export type KernelResponseValidation =
  | { ok: true }
  | { ok: false; code: "DUPLICATE_RESPONSE" | "UNKNOWN_QUESTION" | "INVALID_RESPONSE"; questionVersionId: string };

function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

export function assessmentContentHash(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

export function validateKernelResponses(responses: KernelResponse[], allowedQuestionVersionIds: readonly string[]): KernelResponseValidation {
  const allowed = new Set(allowedQuestionVersionIds);
  const seen = new Set<string>();
  for (const response of responses) {
    if (seen.has(response.questionVersionId)) return { ok: false, code: "DUPLICATE_RESPONSE", questionVersionId: response.questionVersionId };
    seen.add(response.questionVersionId);
    if (!allowed.has(response.questionVersionId)) return { ok: false, code: "UNKNOWN_QUESTION", questionVersionId: response.questionVersionId };
    const optionKeys = response.selectedOptionKeys ?? [];
    if (optionKeys.some((key) => !key.trim()) || new Set(optionKeys).size !== optionKeys.length) {
      return { ok: false, code: "INVALID_RESPONSE", questionVersionId: response.questionVersionId };
    }
  }
  return { ok: true };
}

export function validateLegacyIndexResponses(
  responses: Array<{ questionId: string; selectedIndex: number | null }>,
  allowedQuestionIds: readonly string[],
) {
  for (const response of responses) {
    if (
      response.selectedIndex !== null &&
      (!Number.isInteger(response.selectedIndex) || response.selectedIndex < 0 || response.selectedIndex > 3)
    ) {
      return { ok: false as const, code: "INVALID_RESPONSE" as const, questionVersionId: response.questionId };
    }
  }
  const kernelResponses = responses.map((response) => ({
    questionVersionId: response.questionId,
    selectedOptionKeys: response.selectedIndex === null ? [] : [String(response.selectedIndex)],
  }));
  return validateKernelResponses(kernelResponses, allowedQuestionIds);
}

export function canEditVersion(status: "draft" | "published") {
  return status === "draft";
}
