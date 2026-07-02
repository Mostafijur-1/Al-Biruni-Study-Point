/**
 * Shared MCQ extraction: Groq/Gemini for text, OpenRouter for images.
 * Used by teacher, admin, and exam question upload routes.
 */

import { callTextMcqParser } from "@/lib/ai/text-mcq-parser";
import { callOpenRouterVision } from "@/lib/ai/openrouter";

export const MAX_IMAGE_UPLOADS = 1;

export type ParsedMcq = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type McqParseResult =
  | { ok: true; questions: ParsedMcq[]; rawOutput: string }
  | { ok: false; error: string; status: number };

const MCQ_JSON_SCHEMA = `{
  "questions": [
    {
      "question": string,
      "options": string[],
      "correctIndex": number,
      "explanation": string
    }
  ]
}`;

export const MCQ_EXTRACTION_PROMPT = `
You are an expert educational content parser specializing in Bangladesh SSC/HSC curriculum MCQs.
Extract every multiple-choice question (MCQ) from the provided input and translate to Bengali (Bangla) if needed.

Return a JSON object with EXACTLY this shape (no other keys at the top level):
${MCQ_JSON_SCHEMA}

Each question object rules:
- "question": Full question text in Bengali. Must be self-contained (include any shared উদ্দীপক/stimulus text).
- "options": Array of exactly 4 option strings in Bengali.
- "correctIndex": 0-based index (0, 1, 2, or 3) of the correct answer.
- "explanation": Brief Bengali explanation (optional but preferred).

Crucial Rules:

1. LANGUAGE: All output text (question, options, explanation) MUST be in Bengali, even if input is English.

2. CORRECT ANSWER: Determine the correct option using standard subject knowledge. If the source marks an answer (✓, *, underline, "সঠিক উত্তর:", "Answer:"), use that. If unclear, pick the most plausible answer — never leave correctIndex invalid.

3. EXACTLY 4 OPTIONS: Always output exactly 4 options. If source has fewer, add plausible distractors. If more, keep the 4 most relevant.

4. JSON ONLY: Return ONLY the JSON object. No markdown fences, no commentary.

5. MATH FORMATTING — no raw LaTeX:
   - Never use '$' as math delimiters; write plain text (e.g. '25' not '$25$').
   - Use Unicode superscripts (², ³, ⁴, ⁿ) instead of '^'.
   - Use '×' for multiplication, not '*' or '\\times'.
   - Format permutations/combinations as ⁴P₄, ⁴C₄ etc.
   - Use Unicode subscripts for chemical formulas (H₂O, CO₂, K₂O₂).
   - Use Unicode symbols for inequalities (≤, ≥, ≠) and Greek letters (α, β, γ, π, Δ).
   - For fractions, use '½', '⅓', '¼' etc. or write as '1/2', '1/3' if needed.
   - For integrals, derivatives, and limits, write in plain text (e.g. '∫ x² dx', 'd/dx', 'lim x→0').
   - For matrices, write in plain text with brackets (e.g. [[1, 2], [3, 4]]).
   - For chemical equations, use Unicode arrows (→, ⇌) and proper subscripts (H₂ + O₂ → H₂O).
   - For any math symbols not available in Unicode, write them in plain text (e.g. 'sqrt', 'log', 'sin', 'cos').
   - For any math expressions that cannot be represented in plain text, write them in words (e.g. "the square root of x squared plus 1").
   - All the digits and numbers must be in English numerals (0-9) in the output.

6. MULTI-STATEMENT / ROMAN-NUMERAL QUESTIONS:
   - Include ALL statements (I, II, III / 1, 2, 3) and their intro text inside the "question" field.
   - Never omit statement lists from the question text.

7. SHARED STIMULUS (উদ্দীপক):
   - Duplicate the full উদ্দীপক/passage/stem into EVERY linked question's "question" field.
   - Remove meta-instructions like "উদ্দীপকের আলোকে ১৪ ও ১৫ নং প্রশ্নের উত্তর দাও:".
   - If উদ্দীপক text cannot be read clearly, skip ALL dependent questions rather than saving contextless ones.

8. STRIP EXAM BOARD / YEAR REFERENCES:
   - Remove citations like "(দা. বো. '১৩)", "(ঢা. বো. ২০১৯)", "(Rajshahi Board 2020)" from question/options/explanation.

9. DIAGRAMS / TABLES / FIGURES:
   - If a diagram/table/chart can be described in text, prepend that description to each related question.
   - Skip questions that depend on complex visuals that cannot be represented in text.

10. CONCISE EXPLANATIONS in Bengali. Prefer exam shortcuts when applicable (e.g. "শর্টকাট: ...").

11. OCR / IMAGE-SPECIFIC RULES (when input is an image):
   - Read the ENTIRE image carefully, including headers, footers, margins, and multi-column layouts.
   - For two-column pages: read left column top-to-bottom, then right column.
   - Recognize Bengali option markers: ক), খ), গ), ঘ) or (ক), (খ), (গ), (ঘ).
   - Also recognize: A), B), C), D) / a), b), c), d) / 1., 2., 3., 4. / ১., ২., ৩., ৪.
   - Strip question numbering prefixes (e.g. "১.", "Q.3", "প্রশ্ন ৫:") from the question text — keep only the actual question.
   - Strip option letter prefixes from options (store only the option text, not "ক)" or "A)").
   - Preserve chemical/math notation accurately.
   - If text is partially obscured or blurry, extract what is readable and infer missing parts only when confident.
   - Extract ALL complete MCQs visible in the image — do not stop after the first question.
   - For table-based questions, reproduce the table as a readable text grid inside the question field.
   - Do NOT skip questions just because of minor OCR noise — extract them with best-effort reading.

12. TEXT INPUT RULES:
   - Accept any format: numbered lists, paragraph blocks, "সঠিক উত্তর:" lines, mixed Bengali/English.
   - Split combined blocks into individual MCQ objects.
   - Preserve original wording; do not rewrite questions unnecessarily.

13. SPELLING: Keep source spelling as-is for question/option text. Only fix math/LaTeX formatting per rule 5.
`.trim();

export async function parseMcqsFromText(rawText: string): Promise<McqParseResult> {
  const result = await callTextMcqParser(MCQ_EXTRACTION_PROMPT, rawText);

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

  const images = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      return {
        mimeType: file.type || "image/jpeg",
        base64: buffer.toString("base64"),
      };
    }),
  );

  const result = await callOpenRouterVision(MCQ_EXTRACTION_PROMPT, images);

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

  let correctIndex = 0;
  if (typeof item.correctIndex === "number" && item.correctIndex >= 0 && item.correctIndex <= 3) {
    correctIndex = Math.floor(item.correctIndex);
  } else if (typeof item.correctIndex === "string") {
    const parsed = parseInt(item.correctIndex, 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 3) {
      correctIndex = parsed;
    }
  }

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
