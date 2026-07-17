/**
 * Shared MCQ extraction: Groq/Gemini for text, OpenRouter for images.
 * Used by teacher, admin, and exam question upload routes.
 */

import { callTextMcqParser } from "@/lib/ai/text-mcq-parser";
import { callOpenRouterVision } from "@/lib/ai/openrouter";
import { MAX_IMAGE_SIZE_BYTES, validateImageFile } from "@/lib/image-validation";
import { parseCorrectIndex } from "@/lib/mcq/correct-index";
import { MCQ_IMAGE_EXTRACTION_PROMPT } from "@/lib/mcq/extraction-prompt";

export const MAX_IMAGE_UPLOADS = 1;
export { MAX_IMAGE_SIZE_BYTES };

export type ParsedMcq = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type McqParseResult =
  | { ok: true; questions: ParsedMcq[]; rawOutput: string }
  | { ok: false; error: string; status: number };

export async function parseMcqsFromText(rawText: string): Promise<McqParseResult> {
  const result = await callTextMcqParser(rawText);

  if (!result.ok) {
    return result;
  }

  const questions = parseAiOutput(result.text);
  if (questions.length === 0) {
    return { ok: false, error: "No questions could be extracted from the text.", status: 422 };
  }

  return { ok: true, questions, rawOutput: result.text };
}

export async function parseMcqsFromImages(files: File[]): Promise<McqParseResult> {
  if (files.length === 0) {
    return { ok: false, error: "No image file was uploaded.", status: 400 };
  }
  if (files.length > MAX_IMAGE_UPLOADS) {
    return {
      ok: false,
      error: `You can upload only ${MAX_IMAGE_UPLOADS} image at a time.`,
      status: 400,
    };
  }

  for (const file of files) {
    const validation = await validateImageFile(file);
    if (!validation.ok) return validation;
  }

  const images = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      return {
        mimeType: file.type || "image/jpeg",
        base64: buffer.toString("base64"),
      };
    }),
  );

  const result = await callOpenRouterVision(MCQ_IMAGE_EXTRACTION_PROMPT, images);

  if (!result.ok) {
    return result;
  }

  const questions = parseAiOutput(result.text);
  if (questions.length === 0) {
    return {
      ok: false,
      error: "No questions could be extracted from the image. Try a clearer photo with better lighting.",
      status: 422,
    };
  }

  return { ok: true, questions, rawOutput: result.text };
}

export function parseAiOutput(outputText: string): ParsedMcq[] {
  let cleanedText = outputText.trim();
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  }

  let rawQuestions: unknown[] = [];

  try {
    const parsedJson = JSON.parse(cleanedText);
    rawQuestions = extractQuestionArray(parsedJson);
  } catch {
    rawQuestions = extractQuestionObjects(cleanedText);
  }

  return rawQuestions.map(normalizeQuestion).filter((q): q is ParsedMcq => q !== null);
}

function extractQuestionArray(parsedJson: unknown): unknown[] {
  if (Array.isArray(parsedJson)) {
    return parsedJson;
  }

  if (parsedJson && typeof parsedJson === "object") {
    const obj = parsedJson as Record<string, unknown>;

    if ("question" in obj && "options" in obj) {
      return [obj];
    }

    if (Array.isArray(obj.questions)) {
      return obj.questions;
    }

    const arrayProp = Object.values(obj).find(
      (val) =>
        Array.isArray(val) &&
        val.length > 0 &&
        typeof val[0] === "object" &&
        val[0] !== null &&
        ("question" in (val[0] as object) || "options" in (val[0] as object)),
    );

    if (arrayProp) {
      return arrayProp as unknown[];
    }
  }

  return [];
}

function normalizeQuestion(q: unknown): ParsedMcq | null {
  if (!q || typeof q !== "object") return null;

  const item = q as Record<string, unknown>;
  const question = typeof item.question === "string" ? item.question.trim() : "";
  if (!question) return null;

  let options: string[] = [];
  if (Array.isArray(item.options)) {
    options = item.options
      .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      .map((o) => o.trim());
  }

  if (options.length !== 4) return null;

  const correctIndex = parseCorrectIndex(item.correctIndex);
  if (correctIndex === null) return null;

  const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";

  return { question, options, correctIndex, explanation };
}

function extractQuestionObjects(jsonStr: string): unknown[] {
  const objects: unknown[] = [];
  let inString = false;
  let escape = false;
  const stack: number[] = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        stack.push(i);
      } else if (char === "}") {
        const start = stack.pop();
        if (start !== undefined) {
          const objStr = jsonStr.substring(start, i + 1);
          try {
            const obj = JSON.parse(objStr);
            if (obj && typeof obj === "object" && "question" in obj && "options" in obj) {
              objects.push(obj);
            }
          } catch {
            // skip malformed fragment
          }
        }
      }
    }
  }

  return objects;
}

export async function readImageFilesFromFormData(formData: FormData): Promise<File[]> {
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0);

  const legacyFile = formData.get("file");
  if (legacyFile instanceof File && legacyFile.size > 0 && files.length === 0) {
    files.push(legacyFile);
  }

  return files;
}
