/**
 * Gemini API utility for text-based MCQ parsing.
 * Uses the Google Generative Language REST API with rotating API keys.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

let keyIndex = 0;

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status: number };

function getGeminiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS?.trim();
  if (!raw) return [];
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

function getTextModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
}

function parseGeminiError(status: number, errText: string): string {
  try {
    const parsed = JSON.parse(errText);
    const message = parsed?.error?.message || parsed?.message;
    if (message) return `Gemini API failed: ${message}`;
  } catch {
    if (errText.length < 300) return `Gemini API failed: ${errText}`;
  }
  return `Gemini API failed: ${status}`;
}

async function callGemini(
  parts: GeminiPart[],
  model: string,
): Promise<GeminiResult> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    return {
      ok: false,
      error: "GEMINI_API_KEYS is not configured in .env.local",
      status: 500,
    };
  }

  const maxAttempts = keys.length;
  let lastError = "";
  let lastStatus = 502;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = keys[keyIndex % keys.length];
    keyIndex = (keyIndex + 1) % keys.length;

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini API error (key ${attempt + 1}/${maxAttempts}):`, response.status, errText);

        if (response.status === 429 || response.status >= 500) {
          lastError = parseGeminiError(response.status, errText);
          lastStatus = 502;
          continue;
        }

        return { ok: false, error: parseGeminiError(response.status, errText), status: 502 };
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!text) {
        console.error("Gemini returned empty response:", JSON.stringify(data));
        return { ok: false, error: "Gemini returned an empty response.", status: 502 };
      }

      return { ok: true, text };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Gemini API exception (key ${attempt + 1}/${maxAttempts}):`, err);
      lastError = `Gemini API error: ${message}`;
      lastStatus = 502;
    }
  }

  return { ok: false, error: lastError || "All Gemini API keys exhausted.", status: lastStatus };
}

/** Parse MCQs from pasted / uploaded text. */
export async function callGeminiText(prompt: string, rawText: string): Promise<GeminiResult> {
  return callGemini(
    [
      { text: prompt },
      { text: `Extract all MCQs from this text:\n\n${rawText}` },
    ],
    getTextModel(),
  );
}
