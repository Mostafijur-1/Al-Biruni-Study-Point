/**
 * Gemini API utility for text-based MCQ parsing.
 * Uses the Google Generative Language REST API with rotating API keys.
 * Falls back to the next key on 429 (rate limit) or 500 errors.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Round-robin index – survives across requests within the same serverless instance. */
let keyIndex = 0;

function getGeminiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS?.trim();
  if (!raw) return [];
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

export type GeminiTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status: number };

/**
 * Send a text prompt to the Gemini API and return the generated text.
 * Automatically rotates through available API keys on rate-limit / server errors.
 */
export async function callGeminiText(
  prompt: string,
  rawText: string,
): Promise<GeminiTextResult> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    return { ok: false, error: "GEMINI_API_KEYS is not configured in .env.local", status: 500 };
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
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
          contents: [
            {
              parts: [
                { text: prompt },
                { text: `Raw Text:\n${rawText}` },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini API error (key ${attempt + 1}/${maxAttempts}):`, response.status, errText);

        // Retry with the next key on rate limit or server error
        if (response.status === 429 || response.status >= 500) {
          lastError = `Gemini API failed: ${response.statusText}`;
          lastStatus = 502;
          continue;
        }

        // Non-retryable error (e.g. 400 bad request)
        return { ok: false, error: `Gemini API failed: ${response.statusText}`, status: 502 };
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!text) {
        console.error("Gemini returned empty response. Full data:", JSON.stringify(data));
        return { ok: false, error: "Gemini returned empty response.", status: 502 };
      }

      return { ok: true, text };
    } catch (err: any) {
      console.error(`Gemini API exception (key ${attempt + 1}/${maxAttempts}):`, err);
      lastError = `Gemini API error: ${err.message || err}`;
      lastStatus = 502;
      continue;
    }
  }

  return { ok: false, error: lastError || "All Gemini API keys exhausted.", status: lastStatus };
}
