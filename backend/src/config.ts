import "dotenv/config";
import { z } from "zod";

const booleanFromEnv = z
  .string()
  .optional()
  .transform((value) => value === undefined || value === "" || value.toLowerCase() === "true");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  GROQ_API_KEY: z.string().optional().default(""),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  DATA_FILE: z.string().default("./data/rhin.json"),
  SEED_DEMO_DATA: booleanFromEnv,
  CORS_ORIGINS: z.string().optional().default(""),
  STATIC_DIR: z.string().optional().default("../dist"),
});

export interface AppConfig {
  port: number;
  groq: { apiKey: string; model: string; baseUrl: string; timeoutMs: number };
  dataFile: string | null;
  seedDemoData: boolean;
  corsOrigins: string[];
  staticDir: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  return {
    port: parsed.PORT,
    groq: {
      apiKey: parsed.GROQ_API_KEY.trim(),
      model: parsed.GROQ_MODEL,
      baseUrl: parsed.GROQ_BASE_URL.replace(/\/$/, ""),
      timeoutMs: parsed.LLM_TIMEOUT_MS,
    },
    dataFile: parsed.DATA_FILE || null,
    seedDemoData: parsed.SEED_DEMO_DATA,
    corsOrigins: parsed.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    staticDir: parsed.STATIC_DIR || null,
  };
}
