import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import { ProviderError, type AiProvider, type ChatRequest, type JsonRequest } from './types.js';

export interface GeminiOptions {
  apiKey: string;
  model: string;
}

/** 2.5 Flash models think by default; disabling it cuts latency ~5x for this task. */
function thinkingFor(model: string): GenerateContentConfig['thinkingConfig'] {
  return /2\.5-flash/.test(model) ? { thinkingBudget: 0 } : undefined;
}

function parseJson(text: string | undefined): unknown {
  if (!text) throw new ProviderError('gemini', undefined, 'Empty response');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError('gemini', undefined, 'Response was not valid JSON');
  }
}

/** Google Gemini via the official @google/genai SDK, using native JSON-schema output. */
export function createGeminiProvider({ apiKey, model }: GeminiOptions): AiProvider {
  const client = new GoogleGenAI({ apiKey });

  return {
    name: 'gemini',

    async generateJson(request: JsonRequest, signal: AbortSignal) {
      const response = await client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: request.schema,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          thinkingConfig: thinkingFor(model),
          abortSignal: signal,
        },
      });
      return parseJson(response.text);
    },

    async generateText(request: ChatRequest, signal: AbortSignal) {
      const response = await client.models.generateContent({
        model,
        contents: request.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction: request.system,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          thinkingConfig: thinkingFor(model),
          abortSignal: signal,
        },
      });
      const text = response.text?.trim();
      if (!text) throw new ProviderError('gemini', undefined, 'Empty response');
      return text;
    },
  };
}
