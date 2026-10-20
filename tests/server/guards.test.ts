import { describe, expect, it } from 'vitest';
import { DailyQuota, RateLimiter, TtlCache } from '../../server/guards.js';
import { clientKey } from '../../server/http.js';
import { offlineAssistantReply } from '../../shared/engine/assistantFallback.js';
import type { PlanContext } from '../../shared/schema.js';

describe('TtlCache', () => {
  it('expires entries after the TTL', () => {
    let now = 0;
    const cache = new TtlCache<number>(5, 100, () => now);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    now = 100;
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry', () => {
    const cache = new TtlCache<number>(2, 1_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.size).toBe(2);
  });
});

describe('RateLimiter', () => {
  it('allows up to the limit per window, then resets', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1_000, () => now);
    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').remaining).toBe(0);
    const blocked = limiter.check('ip');
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfterSec: 1 });
    now = 1_000;
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('bounds memory by pruning keys', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 10, () => now, 2);
    limiter.check('a');
    limiter.check('b');
    now = 20;
    expect(limiter.check('c').allowed).toBe(true);
    now = 25;
    limiter.check('d');
    expect(limiter.check('e').allowed).toBe(true);
  });
});

describe('DailyQuota', () => {
  it('caps usage per day and resets on a new day', () => {
    let day = '2026-10-20';
    const quota = new DailyQuota(1, () => day);
    expect(quota.tryConsume()).toBe(true);
    expect(quota.tryConsume()).toBe(false);
    day = '2026-10-21';
    expect(quota.tryConsume()).toBe(true);
  });
});

describe('clientKey', () => {
  it('prefers x-real-ip, then the first forwarded address', () => {
    expect(
      clientKey(
        new Request('http://x', {
          headers: { 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' },
        }),
      ),
    ).toBe('9.9.9.9');
    expect(
      clientKey(new Request('http://x', { headers: { 'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2' } })),
    ).toBe('1.1.1.1');
    expect(clientKey(new Request('http://x'))).toBe('anonymous');
  });
});

describe('offlineAssistantReply', () => {
  const context: PlanContext = {
    eventType: 'wedding',
    title: 'Our Wedding',
    date: '2027-02-14',
    city: 'Pune',
    guests: 200,
    budget: 1_000_000,
    style: 'traditional',
    diet: 'vegetarian',
    language: 'en',
    daysUntil: 117,
    budgetLines: [
      { category: 'venue', amount: 200_000, spent: 50_000 },
      { category: 'catering', amount: 300_000, spent: 0 },
      { category: 'decor', amount: 120_000, spent: 0 },
      { category: 'attire', amount: 100_000, spent: 0 },
      { category: 'photography', amount: 90_000, spent: 0 },
    ],
    upcoming: [
      { title: 'Book the venue', dueDate: '2026-11-01' },
      { title: 'Book photographer', dueDate: '2026-11-10' },
    ],
  };

  it('suggests concrete cuts from discretionary categories', () => {
    const reply = offlineAssistantReply(context, 'How do I reduce costs?');
    expect(reply).toMatch(/Decor & flowers: ₹1,20,000 → ₹1,02,000/);
    expect(reply).not.toMatch(/Venue:/);
  });

  it('lists the next steps', () => {
    expect(offlineAssistantReply(context, 'What should I do next?')).toMatch(
      /Book the venue — by 1 Nov 2026/,
    );
    expect(offlineAssistantReply({ ...context, upcoming: [] }, 'next?')).toMatch(
      /Every timeline task is done/,
    );
  });

  it('answers guest, vendor and general questions', () => {
    expect(offlineAssistantReply(context, 'how many guests per plate')).toMatch(/₹1,500 per plate/);
    expect(offlineAssistantReply(context, 'which vendor to book')).toMatch(/Book in this order/);
    const general = offlineAssistantReply(context, 'hello');
    expect(general).toMatch(/spent so far ₹50,000/);
    expect(offlineAssistantReply({ ...context, upcoming: [], daysUntil: -2 }, 'hello')).toMatch(
      /already held/,
    );
  });
});
