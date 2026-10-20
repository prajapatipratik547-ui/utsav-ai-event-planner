export interface ServerConfig {
  geminiApiKey?: string;
  geminiModel: string;
  groqApiKey?: string;
  groqModel: string;
  aiTimeoutMs: number;
  dailyAiLimit: number;
}

const positiveInt = (raw: string | undefined, fallback: number) => {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const nonEmpty = (raw: string | undefined) => {
  const value = raw?.trim();
  return value ? value : undefined;
};

/** Reads configuration from the environment. Secrets never leave this module's return value. */
export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return {
    geminiApiKey: nonEmpty(env.GEMINI_API_KEY),
    geminiModel: nonEmpty(env.GEMINI_MODEL) ?? 'gemini-2.5-flash',
    groqApiKey: nonEmpty(env.GROQ_API_KEY),
    groqModel: nonEmpty(env.GROQ_MODEL) ?? 'openai/gpt-oss-20b',
    aiTimeoutMs: positiveInt(env.AI_TIMEOUT_MS, 20_000),
    dailyAiLimit: positiveInt(env.DAILY_AI_LIMIT, 300),
  };
}
