import { ProviderError, type AiProvider, type ChatRequest, type JsonRequest } from './types.js';

export interface GroqOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

interface CompletionResponse {
  choices?: { message?: { content?: string | null } }[];
}

/** Groq's OpenAI-compatible API, used as a fast fallback when Gemini is unavailable. */
export function createGroqProvider({ apiKey, model, fetchImpl = fetch }: GroqOptions): AiProvider {
  const reasoning = model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {};

  async function complete(body: Record<string, unknown>, signal: AbortSignal): Promise<string> {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, ...reasoning, ...body }),
      signal,
    });
    if (!response.ok) {
      throw new ProviderError(
        'groq',
        response.status,
        `Groq request failed with ${response.status}`,
      );
    }
    const data = (await response.json()) as CompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new ProviderError('groq', response.status, 'Empty response');
    return content;
  }

  return {
    name: 'groq',

    async generateJson(request: JsonRequest, signal: AbortSignal) {
      const content = await complete(
        {
          messages: [
            { role: 'system', content: request.system },
            {
              role: 'user',
              content: `${request.prompt}\n\nReturn one JSON object that matches this JSON Schema exactly:\n${JSON.stringify(request.schema)}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: request.temperature,
          max_completion_tokens: request.maxOutputTokens,
        },
        signal,
      );
      try {
        return JSON.parse(content) as unknown;
      } catch {
        throw new ProviderError('groq', undefined, 'Response was not valid JSON');
      }
    },

    async generateText(request: ChatRequest, signal: AbortSignal) {
      return complete(
        {
          messages: [{ role: 'system', content: request.system }, ...request.messages],
          temperature: request.temperature,
          max_completion_tokens: request.maxOutputTokens,
        },
        signal,
      );
    },
  };
}
