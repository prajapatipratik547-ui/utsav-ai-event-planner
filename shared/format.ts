import { parseIsoDate } from './date.js';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  return inr.format(Math.round(amount));
}

/** Indian short scale: ₹85K, ₹4.5L, ₹1.2Cr. */
export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
  if (abs >= 10_000_000) return `${sign}₹${trim(abs / 10_000_000)}Cr`;
  if (abs >= 100_000) return `${sign}₹${trim(abs / 100_000)}L`;
  if (abs >= 1_000) return `${sign}₹${trim(abs / 1_000)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

const longDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const weekdayDate = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(isoDate: string): string {
  return longDate.format(parseIsoDate(isoDate));
}

export function formatLongDate(isoDate: string): string {
  return weekdayDate.format(parseIsoDate(isoDate));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Human phrase for a relative day offset, e.g. "in 3 weeks", "today", "5 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  const abs = Math.abs(days);
  const phrase =
    abs >= 60
      ? pluralize(Math.round(abs / 30), 'month')
      : abs >= 14
        ? pluralize(Math.round(abs / 7), 'week')
        : pluralize(abs, 'day');
  return days > 0 ? `in ${phrase}` : `${phrase} ago`;
}
