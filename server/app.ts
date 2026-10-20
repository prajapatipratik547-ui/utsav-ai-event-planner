import { todayIso } from '../shared/date.js';
import type { EventPlan } from '../shared/types.js';
import { createGeminiProvider } from './ai/gemini.js';
import { createGroqProvider } from './ai/groq.js';
import type { AiProvider } from './ai/types.js';
import { loadConfig, type ServerConfig } from './config.js';
import { DailyQuota, RateLimiter, TtlCache } from './guards.js';
import {
  createAssistantHandler,
  createHealthHandler,
  createPlanHandler,
  type HandlerDeps,
} from './handlers.js';
import { consoleLogger } from './http.js';

const MINUTE = 60_000;

/** Provider order: Gemini first, Groq as fallback; the engine is the final fallback. */
export function providersFrom(config: ServerConfig): AiProvider[] {
  const providers: AiProvider[] = [];
  if (config.geminiApiKey) {
    providers.push(
      createGeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel }),
    );
  }
  if (config.groqApiKey) {
    providers.push(createGroqProvider({ apiKey: config.groqApiKey, model: config.groqModel }));
  }
  return providers;
}

export function createDeps(config: ServerConfig = loadConfig()): HandlerDeps {
  const now = () => new Date();
  return {
    providers: providersFrom(config),
    planCache: new TtlCache<EventPlan>(200, 60 * MINUTE),
    planLimiter: new RateLimiter(8, MINUTE),
    assistantLimiter: new RateLimiter(20, MINUTE),
    quota: new DailyQuota(config.dailyAiLimit, () => todayIso(now())),
    timeoutMs: config.aiTimeoutMs,
    now,
    logger: consoleLogger,
  };
}

let handlers:
  | {
      plan: ReturnType<typeof createPlanHandler>;
      assistant: ReturnType<typeof createAssistantHandler>;
      health: ReturnType<typeof createHealthHandler>;
    }
  | undefined;

/** Lazily-built singletons so a warm serverless instance reuses caches and limiters. */
export function getHandlers() {
  if (!handlers) {
    const deps = createDeps();
    handlers = {
      plan: createPlanHandler(deps),
      assistant: createAssistantHandler(deps),
      health: createHealthHandler(deps),
    };
  }
  return handlers;
}
