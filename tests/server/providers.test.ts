import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function GoogleGenAI() {
    return { models: { generateContent } };
  }),
}));

const { createGeminiProvider } = await import('../../server/ai/gemini.js');
const { createGroqProvider } = await import('../../server/ai/groq.js');
const { providersFrom, createDeps, getHandlers } = await import('../../server/app.js');
const { loadConfig } = await import('../../server/config.js');
const { planSystemPrompt, planUserPrompt, assistantSystemPrompt } =
  await import('../../server/ai/prompts.js');
const { buildPlan } = await import('../../shared/engine/planner.js');
const { makeInput, TODAY } = await import('../fixtures.js');

const signal = new AbortController().signal;
const jsonRequest = {
  system: 'sys',
  prompt: 'p',
  schema: { type: 'object' },
  maxOutputTokens: 100,
  temperature: 0.5,
};
const chatRequest = {
  system: 'sys',
  messages: [
    { role: 'user' as const, content: 'hi' },
    { role: 'assistant' as const, content: 'hello' },
    { role: 'user' as const, content: 'cut costs' },
  ],
  maxOutputTokens: 100,
  temperature: 0.5,
};

beforeEach(() => generateContent.mockReset());

describe('Gemini provider', () => {
  it('requests schema-constrained JSON with thinking disabled on 2.5 Flash', async () => {
    generateContent.mockResolvedValue({ text: '{"ok":true}' });
    const provider = createGeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash' });
    expect(await provider.generateJson(jsonRequest, signal)).toEqual({ ok: true });
    const call = generateContent.mock.calls[0]![0];
    expect(call.config.responseMimeType).toBe('application/json');
    expect(call.config.responseJsonSchema).toEqual({ type: 'object' });
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(call.config.abortSignal).toBe(signal);
  });

  it('leaves thinking alone on other models', async () => {
    generateContent.mockResolvedValue({ text: '{}' });
    await createGeminiProvider({ apiKey: 'k', model: 'gemini-3-flash' }).generateJson(
      jsonRequest,
      signal,
    );
    expect(generateContent.mock.calls[0]![0].config.thinkingConfig).toBeUndefined();
  });

  it('maps chat roles to Gemini roles', async () => {
    generateContent.mockResolvedValue({ text: ' answer ' });
    const reply = await createGeminiProvider({
      apiKey: 'k',
      model: 'gemini-2.5-flash',
    }).generateText(chatRequest, signal);
    expect(reply).toBe('answer');
    expect(generateContent.mock.calls[0]![0].contents.map((c: { role: string }) => c.role)).toEqual(
      ['user', 'model', 'user'],
    );
  });

  it.each([undefined, '', 'not json'])('throws on unusable JSON text %#', async (text) => {
    generateContent.mockResolvedValue({ text });
    await expect(
      createGeminiProvider({ apiKey: 'k', model: 'm' }).generateJson(jsonRequest, signal),
    ).rejects.toThrow();
  });

  it('throws on an empty chat reply', async () => {
    generateContent.mockResolvedValue({ text: '  ' });
    await expect(
      createGeminiProvider({ apiKey: 'k', model: 'm' }).generateText(chatRequest, signal),
    ).rejects.toThrow(/Empty/);
  });
});

describe('Groq provider', () => {
  const reply = (content: string | null, status = 200) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

  it('sends JSON mode with the schema and bearer auth', async () => {
    const fetchImpl = vi.fn(async () => reply('{"a":1}'));
    const provider = createGroqProvider({
      apiKey: 'secret',
      model: 'openai/gpt-oss-20b',
      fetchImpl,
    });
    expect(await provider.generateJson(jsonRequest, signal)).toEqual({ a: 1 });
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.reasoning_effort).toBe('low');
    expect(body.messages[1].content).toContain('"type":"object"');
  });

  it('prepends the system prompt to chat history', async () => {
    const fetchImpl = vi.fn(async () => reply('Sure'));
    const provider = createGroqProvider({ apiKey: 'k', model: 'qwen/qwen3', fetchImpl });
    expect(await provider.generateText(chatRequest, signal)).toBe('Sure');
    const body = JSON.parse(
      (fetchImpl.mock.calls[0]! as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.messages).toHaveLength(4);
    expect(body.reasoning_effort).toBeUndefined();
  });

  it('surfaces HTTP errors with status', async () => {
    const provider = createGroqProvider({
      apiKey: 'k',
      model: 'm',
      fetchImpl: vi.fn(async () => reply(null, 429)),
    });
    await expect(provider.generateText(chatRequest, signal)).rejects.toMatchObject({ status: 429 });
  });

  it('rejects empty and non-JSON content', async () => {
    await expect(
      createGroqProvider({
        apiKey: 'k',
        model: 'm',
        fetchImpl: vi.fn(async () => reply(null)),
      }).generateText(chatRequest, signal),
    ).rejects.toThrow(/Empty/);
    await expect(
      createGroqProvider({
        apiKey: 'k',
        model: 'm',
        fetchImpl: vi.fn(async () => reply('nope')),
      }).generateJson(jsonRequest, signal),
    ).rejects.toThrow(/valid JSON/);
  });
});

describe('configuration & wiring', () => {
  it('applies defaults and ignores blank or invalid values', () => {
    const config = loadConfig({ GEMINI_API_KEY: '  ', AI_TIMEOUT_MS: 'abc', DAILY_AI_LIMIT: '-3' });
    expect(config).toEqual({
      geminiApiKey: undefined,
      geminiModel: 'gemini-2.5-flash',
      groqApiKey: undefined,
      groqModel: 'openai/gpt-oss-20b',
      aiTimeoutMs: 20_000,
      dailyAiLimit: 300,
    });
  });

  it('orders providers Gemini first, then Groq', () => {
    const providers = providersFrom(loadConfig({ GEMINI_API_KEY: 'a', GROQ_API_KEY: 'b' }));
    expect(providers.map((p) => p.name)).toEqual(['gemini', 'groq']);
    expect(providersFrom(loadConfig({ GROQ_API_KEY: 'b' })).map((p) => p.name)).toEqual(['groq']);
  });

  it('builds dependencies and memoises handlers', () => {
    const deps = createDeps(loadConfig({}));
    expect(deps.providers).toEqual([]);
    expect(deps.quota.tryConsume()).toBe(true);
    expect(getHandlers()).toBe(getHandlers());
  });
});

describe('prompts', () => {
  it('asks for Hindi output when requested', () => {
    expect(planSystemPrompt('hi')).toMatch(/Devanagari/);
    expect(planSystemPrompt('en')).toMatch(/Indian English/);
  });

  it('includes the baseline numbers and priorities', () => {
    const input = makeInput({ priorities: ['decor'], notes: '' });
    const prompt = planUserPrompt(input, buildPlan(input, { today: TODAY }));
    expect(prompt).toContain('₹15,00,000');
    expect(prompt).toContain('Top priorities: Decor & flowers');
    expect(prompt).toContain('(none)');
  });

  it('wraps assistant context in plan tags', () => {
    const system = assistantSystemPrompt(
      {
        eventType: 'birthday',
        title: 'T',
        date: '2026-12-01',
        city: 'Pune',
        guests: 3,
        budget: 9000,
        style: 'modern',
        diet: 'vegan',
        language: 'hi',
        daysUntil: 4,
        budgetLines: [],
        upcoming: [],
      },
      '2026-10-21',
    );
    expect(system).toContain('Today is Wednesday, 21 October 2026');
    expect(system).toMatch(/<plan>\n\{.*\}\n<\/plan>/);
    expect(system).toMatch(/Hindi/);
  });
});
