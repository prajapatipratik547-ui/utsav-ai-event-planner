export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

/** Reads and parses a JSON body, enforcing content type and a hard size cap. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Send the request as application/json.');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new HttpError(413, 'Request is too large.');

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes)
    throw new HttpError(413, 'Request is too large.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.');
  }
}

/** Best-effort client identifier for rate limiting (Vercel sets x-real-ip). */
export function clientKey(request: Request): string {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'anonymous';
}

/**
 * Browsers label cross-site requests; refusing them stops other websites from
 * spending this app's model quota through visitors' browsers.
 */
export function assertSameSite(request: Request): void {
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed.');
}

export interface Logger {
  warn(event: string, details?: Record<string, unknown>): void;
  error(event: string, details?: Record<string, unknown>): void;
}

/** Structured JSON logs; callers must never pass user content or secrets. */
export const consoleLogger: Logger = {
  warn: (event, details) => console.warn(JSON.stringify({ level: 'warn', event, ...details })),
  error: (event, details) => console.error(JSON.stringify({ level: 'error', event, ...details })),
};
