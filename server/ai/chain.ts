import type { Logger } from '../http.js';
import type { AiProvider, ProviderName } from './types.js';

export interface ChainResult<T> {
  value: T;
  source: ProviderName;
}

/**
 * Tries each provider in order with its own timeout and returns the first
 * usable result. `attempt` returns null for responses that parsed but were
 * unusable, which also moves on to the next provider.
 */
export async function firstSuccessful<T>(
  providers: readonly AiProvider[],
  attempt: (provider: AiProvider, signal: AbortSignal) => Promise<T | null>,
  timeoutMs: number,
  logger: Logger,
): Promise<ChainResult<T> | null> {
  for (const provider of providers) {
    const started = Date.now();
    try {
      const value = await attempt(provider, AbortSignal.timeout(timeoutMs));
      if (value !== null) return { value, source: provider.name };
      logger.warn('ai.unusable_response', { provider: provider.name, ms: Date.now() - started });
    } catch (error) {
      logger.warn('ai.provider_failed', {
        provider: provider.name,
        ms: Date.now() - started,
        reason: error instanceof Error ? error.name : 'unknown',
        status: (error as { status?: number }).status,
      });
    }
  }
  return null;
}
