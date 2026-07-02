/**
 * Text MCQ parsing with Groq + Gemini fallback.
 */

import { callGroqText, hasGroqKeys } from "@/lib/ai/groq";
import { callGeminiText, hasGeminiKeys } from "@/lib/ai/gemini";

export type TextParseResult =
  | { ok: true; text: string; provider: "groq" | "gemini" }
  | { ok: false; error: string; status: number };

/** Try Groq first, then fall back to Gemini. */
export async function callTextMcqParser(prompt: string, rawText: string): Promise<TextParseResult> {
  const errors: string[] = [];

  if (hasGroqKeys()) {
    const groqResult = await callGroqText(prompt, rawText);
    if (groqResult.ok) {
      return { ok: true, text: groqResult.text, provider: "groq" };
    }
    errors.push(groqResult.error);
    console.warn("[Text MCQ parser] Groq failed, trying Gemini fallback:", groqResult.error);
  }

  if (hasGeminiKeys()) {
    const geminiResult = await callGeminiText(prompt, rawText);
    if (geminiResult.ok) {
      return { ok: true, text: geminiResult.text, provider: "gemini" };
    }
    errors.push(geminiResult.error);
  }

  if (errors.length === 0) {
    return {
      ok: false,
      error: "No text parser configured. Set GROQ_API_KEYS and/or GEMINI_API_KEYS in .env.local",
      status: 500,
    };
  }

  return {
    ok: false,
    error: errors.join(" | Fallback also failed: "),
    status: 502,
  };
}
