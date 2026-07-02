import { MCQ_IMAGE_EXTRACTION_PROMPT, MCQ_IMAGE_USER_INSTRUCTION } from "@/lib/mcq/extraction-prompt";

export type OpenRouterResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status: number };

function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  // OpenRouter free credits cap affordable output tokens. Without this, it defaults to ~65535 and fails.
  const maxTokens = Number(process.env.OPENROUTER_MAX_TOKENS) || 3800;
  return { apiKey, model, maxTokens };
}

/** Parse MCQs from exam-page images via OpenRouter vision model. */
export async function callOpenRouterVision(
  prompt: string = MCQ_IMAGE_EXTRACTION_PROMPT,
  images: Array<{ mimeType: string; base64: string }>,
): Promise<OpenRouterResult> {
  const { apiKey, model, maxTokens } = getOpenRouterConfig();

  if (!apiKey) {
    return { ok: false, error: "OPENROUTER_API_KEY is not configured in .env.local", status: 500 };
  }

  const imageParts = images.map((img) => ({
    type: "image_url" as const,
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }));

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/Mostafijur-1/Al-Biruni-Study-Point",
        "X-OpenRouter-Title": "Al-Biruni Study Point",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "text", text: MCQ_IMAGE_USER_INSTRUCTION },
              ...imageParts,
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter Vision API error:", response.status, errText);
      let detail = response.statusText;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed?.error?.message || parsed?.message || detail;
      } catch {
        if (errText.length < 300) detail = errText;
      }
      return { ok: false, error: `AI parsing failed: ${detail}`, status: 502 };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text) {
      console.error("OpenRouter empty response:", JSON.stringify(data));
      return { ok: false, error: "AI returned an empty response. Please try again.", status: 502 };
    }

    return { ok: true, text };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("OpenRouter Vision exception:", err);
    return { ok: false, error: `AI parsing error: ${message}`, status: 502 };
  }
}
