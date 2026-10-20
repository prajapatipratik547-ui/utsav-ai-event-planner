import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isValidIsoDate, parseIsoDate, todayIso } from '../../shared/date.js';
import {
  formatDate,
  formatINR,
  formatINRCompact,
  pluralize,
  relativeDays,
} from '../../shared/format.js';
import { buildIcs, escapeIcsText, foldIcsLine } from '../../shared/ics.js';
import { eventInputSchema, fieldErrors, assistantRequestSchema } from '../../shared/schema.js';
import { cleanModelText, cleanUserText, slugify } from '../../shared/text.js';
import { makeInput } from '../fixtures.js';

describe('date helpers', () => {
  it('validates real calendar dates only', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2027-02-29')).toBe(false);
    expect(isValidIsoDate('2027-13-01')).toBe(false);
    expect(isValidIsoDate('14/02/2027')).toBe(false);
  });

  it('does day arithmetic across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-10-20', '2027-02-14')).toBe(117);
    expect(daysBetween('2027-02-14', '2026-10-20')).toBe(-117);
  });

  it('throws on invalid input to parseIsoDate', () => {
    expect(() => parseIsoDate('nope')).toThrow(RangeError);
  });

  it('computes today in India time', () => {
    // 20:00 UTC on 20 Oct is already 21 Oct in IST.
    expect(todayIso(new Date('2026-10-20T20:00:00Z'))).toBe('2026-10-21');
    expect(todayIso(new Date('2026-10-20T20:00:00Z'), 'UTC')).toBe('2026-10-20');
  });
});

describe('formatting', () => {
  it('formats rupees with Indian digit grouping', () => {
    expect(formatINR(1500000)).toBe('₹15,00,000');
  });

  it('formats compact lakh/crore amounts', () => {
    expect(formatINRCompact(950)).toBe('₹950');
    expect(formatINRCompact(85_000)).toBe('₹85K');
    expect(formatINRCompact(450_000)).toBe('₹4.5L');
    expect(formatINRCompact(12_000_000)).toBe('₹1.2Cr');
    expect(formatINRCompact(-200_000)).toBe('-₹2L');
  });

  it('formats dates without timezone drift', () => {
    expect(formatDate('2027-02-14')).toBe('14 Feb 2027');
  });

  it('pluralises and describes relative days', () => {
    expect(pluralize(1, 'day')).toBe('1 day');
    expect(pluralize(3, 'day')).toBe('3 days');
    expect(relativeDays(0)).toBe('today');
    expect(relativeDays(1)).toBe('tomorrow');
    expect(relativeDays(-1)).toBe('yesterday');
    expect(relativeDays(5)).toBe('in 5 days');
    expect(relativeDays(21)).toBe('in 3 weeks');
    expect(relativeDays(90)).toBe('in 3 months');
    expect(relativeDays(-10)).toBe('10 days ago');
  });
});

describe('text sanitising', () => {
  it('removes control characters and angle brackets from user text', () => {
    expect(cleanUserText('  hi\u0000 <b>there</b>   friend ', 50)).toBe('hi bthere/b friend');
  });

  it('clips to the maximum length', () => {
    expect(cleanUserText('abcdef', 3)).toBe('abc');
  });

  it('removes links from model text', () => {
    expect(cleanModelText('See www.scam.example and https://x.y/z ok', 100)).toBe('See and ok');
  });

  it('slugifies unicode titles', () => {
    expect(slugify('Diya’s Mehendi — Night!')).toBe('diya-s-mehendi-night');
  });
});

describe('eventInputSchema', () => {
  it('accepts a valid input and normalises text', () => {
    const parsed = eventInputSchema.parse({
      ...makeInput(),
      title: '  <Big>   Day ',
      priorities: ['decor', 'decor'],
    });
    expect(parsed.title).toBe('Big Day');
    expect(parsed.priorities).toEqual(['decor']);
  });

  it('reports friendly per-field errors', () => {
    const result = eventInputSchema.safeParse({
      ...makeInput(),
      budget: 100,
      guests: 0,
      date: '2027-02-30',
      title: 'x',
    });
    expect(result.success).toBe(false);
    const errors = fieldErrors(result.error!);
    expect(errors.budget).toMatch(/at least ₹5,000/);
    expect(errors.guests).toMatch(/At least 1 guest/);
    expect(errors.date).toMatch(/real calendar date/);
    expect(errors.title).toMatch(/at least 2/);
  });

  it('rejects unknown enum values and too many priorities', () => {
    expect(eventInputSchema.safeParse({ ...makeInput(), eventType: 'rave' }).success).toBe(false);
    expect(
      eventInputSchema.safeParse({
        ...makeInput(),
        priorities: ['decor', 'venue', 'catering', 'attire'],
      }).success,
    ).toBe(false);
  });

  it('requires the last assistant message to come from the user', () => {
    const context = {
      eventType: 'birthday',
      title: 'Party',
      date: '2026-12-01',
      city: 'Pune',
      guests: 20,
      budget: 20000,
      style: 'modern',
      diet: 'vegetarian',
      language: 'en',
      daysUntil: 42,
      budgetLines: [],
      upcoming: [],
    };
    expect(
      assistantRequestSchema.safeParse({
        context,
        messages: [{ role: 'assistant', content: 'hi' }],
      }).success,
    ).toBe(false);
    expect(
      assistantRequestSchema.safeParse({ context, messages: [{ role: 'user', content: 'hi' }] })
        .success,
    ).toBe(true);
  });
});

describe('ics export', () => {
  it('escapes special characters', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long lines at 75 octets', () => {
    const folded = foldIcsLine('SUMMARY:' + 'स'.repeat(40));
    for (const line of folded.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'स'.repeat(40));
  });

  it('builds a valid all-day calendar', () => {
    const ics = buildIcs(
      'My, Party',
      [{ uid: 'venue', title: 'Book venue', description: 'Visit 3', date: '2026-12-13' }],
      new Date('2026-10-20T10:00:00Z'),
    );
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('X-WR-CALNAME:My\\, Party');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261213');
    expect(ics).toContain('DTEND;VALUE=DATE:20261214');
    expect(ics).toContain('DTSTAMP:20261020T100000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
