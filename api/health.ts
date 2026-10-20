import { getHandlers } from '../server/app.js';

export function GET(request: Request): Promise<Response> {
  return getHandlers().health(request);
}
