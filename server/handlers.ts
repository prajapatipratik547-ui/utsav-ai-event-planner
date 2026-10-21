import { LIMITS } from '../shared/constants.js';
import { daysBetween, todayIso } from '../shared/date.js';
import { offlineAssistantReply } from '../shared/engine/assistantFallback.js';
import { ENHANCEMENT_JSON_SCHEMA, parseEnhancement } from '../shared/engine/enhancement.js';
import { buildPlan } from '../shared/engine/planner.js';
import { assistantRequestSchema, fieldErrors, planRequestSchema } from '../shared/schema.js';
import { cleanModelText } from '../shared/text.js';
import type { AssistantResponse, EventPlan, PlanResponse } from '../shared/types.js';
import { firstSuccessful } from './ai/chain.js';
import { assistantSystemPrompt, planSystemPrompt, planUserPrompt } from './ai/prompts.js';
import type { AiProvider } from './ai/types.js';
import type { DailyQuota, RateLimiter, TtlCache } from './guards.js';
import { assertSameSite, clientKey, HttpError, json, readJsonBody, type Logger } from './http.js';

export interface HandlerDeps {
  providers: readonly AiProvider[];
  planCache: TtlCache<EventPlan>;
  planLimiter: RateLimiter;
  assistantLimiter: RateLimiter;
  quota: DailyQuota;
  timeoutMs: number;
  now: () => Date;
  logger: Logger;
}

type Handler = (request: Request) => Promise<Response>;

const MAX_PLAN_BODY = 8 * 1024;
const MAX_ASSISTANT_BODY = 24 * 1024;

/** Shared method/rate-limit/error envelope so every endpoint fails the same safe way. */
function endpoint(
  method: 'GET' | 'POST',
  limiter: RateLimiter | null,
  logger: Logger,
  run: Handler,
): Handler {
  return async (request) => {
    try {
      if (request.method !== method) {
        return json(405, { error: `Use ${method}.` }, { Allow: method });
      }
      assertSameSite(request);
      if (limiter) {
        const verdict = limiter.check(clientKey(request));
        if (!verdict.allowed) {
          return json(
            429,
            { error: 'You are going a little fast — please wait a moment and try again.' },
            { 'Retry-After': String(verdict.retryAfterSec) },
          );
        }
      }
      return await run(request);
    } catch (error) {
      if (error instanceof HttpError) return json(error.status, { error: error.message });
      logger.error('request.failed', { reason: error instanceof Error ? error.name : 'unknown' });
      return json(500, { error: 'Something went wrong on our side. Please try again.' });
    }
  };
}

/** The browser's date is trusted only within a day of the server's (timezones). */
export function resolveToday(clientToday: string | undefined, now: Date): string {
  const serverToday = todayIso(now);
  if (clientToday && Math.abs(daysBetween(serverToday, clientToday)) <= 1) return clientToday;
  return serverToday;
}

export function createPlanHandler(deps: HandlerDeps): Handler {
  return endpoint('POST', deps.planLimiter, deps.logger, async (request) => {
    const parsed = planRequestSchema.safeParse(await readJsonBody(request, MAX_PLAN_BODY));
    if (!parsed.success) {
      return json(400, {
        error: 'Please check the highlighted fields.',
        fields: fieldErrors(parsed.error),
      });
    }
    const { input } = parsed.data;
    const today = resolveToday(parsed.data.today, deps.now());
    const daysUntil = daysBetween(today, input.date);
    if (daysUntil < 0 || daysUntil > LIMITS.maxDaysAhead) {
      return json(400, {
        error: 'Please check the highlighted fields.',
        fields: {
          'input.date':
            daysUntil < 0
              ? 'Pick a date from today onwards.'
              : 'Pick a date within the next 3 years.',
        },
      });
    }

    const cacheKey = JSON.stringify([today, input]);
    const cached = deps.planCache.get(cacheKey);
    if (cached) return json(200, { plan: cached, cached: true } satisfies PlanResponse);

    const baseline = buildPlan(input, { today });
    let plan = baseline;
    if (deps.providers.length > 0 && deps.quota.tryConsume()) {
      const result = await firstSuccessful(
        deps.providers,
        async (provider, signal) =>
          parseEnhancement(
            await provider.generateJson(
              {
                system: planSystemPrompt(input.language),
                prompt: planUserPrompt(input, baseline),
                schema: ENHANCEMENT_JSON_SCHEMA,
                maxOutputTokens: 2048,
                temperature: 0.8,
              },
              signal,
            ),
          ),
        deps.timeoutMs,
        deps.logger,
      );
      if (result) {
        plan = buildPlan(input, { today, enhancement: result.value, source: result.source });
        // Only model output is worth caching; the offline plan is instant to rebuild.
        deps.planCache.set(cacheKey, plan);
      }
    }
    return json(200, { plan, cached: false } satisfies PlanResponse);
  });
}

export function createAssistantHandler(deps: HandlerDeps): Handler {
  return endpoint('POST', deps.assistantLimiter, deps.logger, async (request) => {
    const parsed = assistantRequestSchema.safeParse(
      await readJsonBody(request, MAX_ASSISTANT_BODY),
    );
    if (!parsed.success) {
      return json(400, {
        error: 'That message could not be sent.',
        fields: fieldErrors(parsed.error),
      });
    }
    const { context, messages } = parsed.data;
    const question = messages.at(-1)?.content ?? '';

    if (deps.providers.length > 0 && deps.quota.tryConsume()) {
      const result = await firstSuccessful(
        deps.providers,
        async (provider, signal) => {
          const text = await provider.generateText(
            {
              system: assistantSystemPrompt(context, resolveToday(undefined, deps.now())),
              messages,
              maxOutputTokens: 600,
              temperature: 0.5,
            },
            signal,
          );
          const reply = cleanModelText(text.replace(/\*\*|__|^#+\s*/gm, ''), 1_500);
          return reply.length > 0 ? reply : null;
        },
        deps.timeoutMs,
        deps.logger,
      );
      if (result)
        return json(200, {
          reply: result.value,
          source: result.source,
        } satisfies AssistantResponse);
    }
    return json(200, {
      reply: offlineAssistantReply(context, question),
      source: 'offline',
    } satisfies AssistantResponse);
  });
}

export function createHealthHandler(
  deps: Pick<HandlerDeps, 'providers' | 'logger' | 'now'>,
): Handler {
  return endpoint('GET', null, deps.logger, async () =>
    json(200, {
      status: 'ok',
      ai: deps.providers.map((p) => p.name),
      time: deps.now().toISOString(),
    }),
  );
}
