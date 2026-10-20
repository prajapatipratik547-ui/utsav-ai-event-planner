import { getHandlers } from '../server/app.js';

export const maxDuration = 30;

export function POST(request: Request): Promise<Response> {
  return getHandlers().plan(request);
}
