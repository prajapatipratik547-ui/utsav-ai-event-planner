import type { ChatMessage } from '../../shared/schema.js';

export type ProviderName = 'gemini' | 'groq';

export interface JsonRequest {
  system: string;
  prompt: string;
  schema: object;
  maxOutputTokens: number;
  temperature: number;
}

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature: number;
}

/** A model backend. Implementations must honour the abort signal (timeouts). */
export interface AiProvider {
  readonly name: ProviderName;
  generateJson(request: JsonRequest, signal: AbortSignal): Promise<unknown>;
  generateText(request: ChatRequest, signal: AbortSignal): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly status: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
