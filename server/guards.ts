/**
 * In-memory protection primitives. On serverless platforms each warm instance
 * keeps its own copy, which is an acceptable best-effort shield for a demo-scale
 * app; swap in Redis/Upstash behind the same interfaces for strict global limits.
 */

type Clock = () => number;

/** Least-recently-used cache with per-entry expiry. */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: Clock = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Fixed-window limiter keyed by client. */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: Clock = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      if (this.windows.size >= this.maxKeys) this.prune(now);
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    const allowed = window.count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - window.count),
      retryAfterSec: allowed ? 0 : Math.ceil((window.resetAt - now) / 1000),
    };
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    if (this.windows.size >= this.maxKeys) this.windows.clear();
  }
}

/** Caps model calls per calendar day so a traffic spike cannot exhaust free-tier quota. */
export class DailyQuota {
  private day = '';
  private used = 0;

  constructor(
    private readonly limit: number,
    private readonly currentDay: () => string,
  ) {}

  tryConsume(): boolean {
    const today = this.currentDay();
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
}
