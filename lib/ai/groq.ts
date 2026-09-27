/**
 * Groq API utility for text-based MCQ parsing.
 * Uses the same extraction rules and message structure as Gemini.
 */

import {
  MCQ_TEXT_EXTRACTION_PROMPT,
  buildTextMcqUserMessage,
} from "@/lib/mcq/extraction-prompt";

const GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions";

let keyIndex = 0;

export type GroqResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status: number };

function getGroqKeys(): string[] {
  const raw = process.env.GROQ_API_KEYS?.trim();
  if (!raw) return [];
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

function getGroqModels(): string[] {
  const configured = process.env.GROQ_MODEL?.trim();
  const candidates = [
    configured,
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
  ].filter((m): m is string => Boolean(m));

  return Array.from(new Set(candidates));
}

function parseGroqError(status: number, errText: string): string {
  try {
    const parsed = JSON.parse(errText);
    const message = parsed?.error?.message || parsed?.message;
    if (message) return `Groq API failed: ${message}`;
  } catch {
    if (errText.length < 300) return `Groq API failed: ${errText}`;
  }
  return `Groq API failed: ${status}`;
}

/** Parse MCQs from pasted / uploaded text via Groq (same rules as Gemini). */
export async function callGroqText(
  prompt: string = MCQ_TEXT_EXTRACTION_PROMPT,
  rawText: string,
): Promise<GroqResult> {
  const keys = getGroqKeys();
  if (keys.length === 0) {
    return { ok: false, error: "GROQ_API_KEYS is not configured.", status: 500 };
  }

  const models = getGroqModels();
  let lastError = "";
  let lastStatus = 502;

  for (const model of models) {
    const maxAttempts = keys.length;
    let modelUnavailable = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = keys[keyIndex % keys.length];
      keyIndex = (keyIndex + 1) % keys.length;

      try {
        const response = await fetch(GROQ_API_BASE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: buildTextMcqUserMessage(rawText) },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Groq API error (model ${model}, key ${attempt + 1}/${maxAttempts}):`, response.status, errText);

          // 404 = model not found or decommissioned, 503 = service unavailable. Fall back to next model!
          if (response.status === 404 || response.status === 503) {
            lastError = parseGroqError(response.status, errText);
            modelUnavailable = true;
            break;
          }

          if (response.status === 429 || response.status >= 500) {
            lastError = parseGroqError(response.status, errText);
            lastStatus = 502;
            continue;
          }

          lastError = parseGroqError(response.status, errText);
          lastStatus = 502;
          break;
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";

        if (!text) {
          console.error("Groq returned empty response:", JSON.stringify(data));
          lastError = "Groq returned an empty response.";
          continue;
        }

        return { ok: true, text };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Groq API exception (model ${model}, key ${attempt + 1}/${maxAttempts}):`, err);
        lastError = `Groq API error: ${message}`;
        lastStatus = 502;
      }
    }

    if (modelUnavailable) {
      console.warn(`[Groq] Model ${model} is unavailable. Trying fallback model...`);
      continue;
    }
  }

  return { ok: false, error: lastError || "All Groq API keys and models exhausted.", status: lastStatus };
}

export function hasGroqKeys(): boolean {
  return getGroqKeys().length > 0;
}
