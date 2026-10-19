/**
 * Minimal Google Gemini client for the /discutir refinement loop.
 *
 * We call the public generativelanguage.googleapis.com endpoint with the
 * x-goog-api-key header. The free tier of AI Studio is enough for the
 * conversational refinement; no SDK dependency is pulled in.
 */

export interface GeminiMessage {
  role: "user" | "model";
  text: string;
}

export interface GeminiResponse {
  text: string;
  usage: {
    promptTokens: number;
    outputTokens: number;
    thoughtTokens: number;
    totalTokens: number;
  };
}

export interface GeminiClient {
  generate(opts: {
    system: string;
    messages: GeminiMessage[];
    maxOutputTokens?: number;
  }): Promise<GeminiResponse>;
}

export function createGeminiClient(apiKey: string, model: string): GeminiClient {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const base = "https://generativelanguage.googleapis.com/v1beta/models";
  return {
    async generate(opts) {
      const body = {
        systemInstruction: {
          parts: [{ text: opts.system }]
        },
        contents: opts.messages.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        generationConfig: {
          maxOutputTokens: opts.maxOutputTokens ?? 2048,
          temperature: 0.4
        }
      };
      const res = await fetch(`${base}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(body)
      });
      const data = (await res.json().catch(() => ({}))) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          thoughtsTokenCount?: number;
          totalTokenCount?: number;
        };
        error?: { message?: string; status?: string };
      };
      if (!res.ok || data.error) {
        throw new Error(
          `Gemini ${model} failed: ${res.status} ${data.error?.message ?? ""}`.trim()
        );
      }
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      const usage = data.usageMetadata ?? {};
      return {
        text,
        usage: {
          promptTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          thoughtTokens: usage.thoughtsTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0
        }
      };
    }
  };
}
