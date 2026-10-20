import type { ChatMessage, EventInput, PlanContext } from '../../shared/schema.js';
import type {
  ApiError as ApiErrorBody,
  AssistantResponse,
  PlanResponse,
} from '../../shared/types.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Network failure or server fault — worth falling back to on-device planning. */
  get recoverable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'You appear to be offline.');
  }
  const data = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!response.ok || data === null) {
    throw new ApiError(
      response.status,
      data?.error ?? 'The planner is unavailable right now.',
      data?.fields,
    );
  }
  return data;
}

export function requestPlan(input: EventInput, today: string, signal?: AbortSignal) {
  return post<PlanResponse>('/api/plan', { input, today }, signal);
}

export function requestAssistant(
  context: PlanContext,
  messages: ChatMessage[],
  signal?: AbortSignal,
) {
  return post<AssistantResponse>('/api/assistant', { context, messages }, signal);
}
