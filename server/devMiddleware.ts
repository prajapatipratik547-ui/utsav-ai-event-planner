import type { IncomingMessage, ServerResponse } from 'node:http';
import { getHandlers } from './app.js';

type Next = (error?: unknown) => void;

const ROUTES = {
  '/api/plan': 'plan',
  '/api/assistant': 'assistant',
  '/api/health': 'health',
} as const;

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`http://${req.headers.host ?? '127.0.0.1'}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
}

/**
 * Connect middleware that serves the same Web-standard handlers Vercel runs,
 * so `npm run dev` exercises the real API without the Vercel CLI.
 */
export async function apiDevMiddleware(req: IncomingMessage, res: ServerResponse, next: Next) {
  const path = (req.url ?? '').split('?')[0] as keyof typeof ROUTES;
  const route = ROUTES[path];
  if (!route) return next();
  try {
    const response = await getHandlers()[route](await toRequest(req));
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    next(error);
  }
}
