/**
 * Groq API utility for text-based MCQ parsing.
 * OpenAI-compatible chat completions with rotating API keys.
 */

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

function getGroqModel(): string {
  return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
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

/** Parse MCQs from pasted / uploaded text via Groq. */
export async function callGroqText(prompt: string, rawText: string): Promise<GroqResult> {
  const keys = getGroqKeys();
  if (keys.length === 0) {
    return { ok: false, error: "GROQ_API_KEYS is not configured.", status: 500 };
  }

  const model = getGroqModel();
  const maxAttempts = keys.length;
  let lastError = "";
  let lastStatus = 502;

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
            {
              role: "user",
              content: `${prompt}\n\nExtract all MCQs from this text:\n\n${rawText}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Groq API error (key ${attempt + 1}/${maxAttempts}):`, response.status, errText);

        if (response.status === 429 || response.status >= 500) {
          lastError = parseGroqError(response.status, errText);
          lastStatus = 502;
          continue;
        }

        return { ok: false, error: parseGroqError(response.status, errText), status: 502 };
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || "";

      if (!text) {
        console.error("Groq returned empty response:", JSON.stringify(data));
        return { ok: false, error: "Groq returned an empty response.", status: 502 };
      }

      return { ok: true, text };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Groq API exception (key ${attempt + 1}/${maxAttempts}):`, err);
      lastError = `Groq API error: ${message}`;
      lastStatus = 502;
    }
  }

  return { ok: false, error: lastError || "All Groq API keys exhausted.", status: lastStatus };
}

export function hasGroqKeys(): boolean {
  return getGroqKeys().length > 0;
}
