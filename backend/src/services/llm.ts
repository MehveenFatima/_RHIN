import type { z } from "zod";

export interface LlmConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
}

/** Raised for every way an LLM call can fail; callers fall back to rules. */
export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export interface LlmClient {
  readonly configured: boolean;
  readonly model: string;
  /** Ask the model for a JSON object and validate it against `schema`. */
  completeJson<T>(options: { system: string; user: string; schema: z.ZodType<T>; maxTokens?: number }): Promise<T>;
}

/**
 * Minimal client for Groq's OpenAI-compatible chat completions endpoint.
 * Uses JSON mode (`response_format: json_object`) so the reply is machine-readable,
 * then validates it with zod — a reply that parses but has the wrong shape is
 * treated the same as a network failure.
 */
export function createGroqClient(config: LlmConfig, fetchImpl: typeof fetch = fetch): LlmClient {
  return {
    configured: config.apiKey.length > 0,
    model: config.model,

    async completeJson({ system, user, schema, maxTokens = 1200 }) {
      if (!config.apiKey) throw new LlmError("GROQ_API_KEY is not configured");

      let response: Response;
      try {
        response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.2,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
          signal: AbortSignal.timeout(config.timeoutMs),
        });
      } catch (error) {
        const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "network error";
        throw new LlmError(`Groq request failed (${reason})`);
      }

      if (!response.ok) {
        throw new LlmError(`Groq returned HTTP ${response.status}`);
      }

      const body = (await response.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[];
      } | null;
      const content = body?.choices?.[0]?.message?.content;
      if (!content) throw new LlmError("Groq response had no content");

      let json: unknown;
      try {
        json = JSON.parse(content);
      } catch {
        throw new LlmError("Groq response was not valid JSON");
      }

      const result = schema.safeParse(json);
      if (!result.success) throw new LlmError("Groq response did not match the expected schema");
      return result.data;
    },
  };
}
