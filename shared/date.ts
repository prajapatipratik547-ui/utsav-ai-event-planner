/**
 * Date-only helpers. Event dates are calendar days ("2026-12-14"), not instants,
 * so all arithmetic is done in UTC to stay independent of the runtime's timezone.
 */

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parseIsoDate(value: string): number {
  if (!isValidIsoDate(value)) throw new RangeError(`Invalid ISO date: ${value}`);
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function toIsoDate(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  return toIsoDate(parseIsoDate(isoDate) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to) - parseIsoDate(from)) / DAY_MS);
}

/** The calendar date of `now` in the given IANA timezone (defaults to India). */
export function todayIso(now: Date = new Date(), timeZone = 'Asia/Kolkata'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}
