import { addDays } from './date.js';

export interface CalendarItem {
  uid: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD, all-day
}

/** Escapes text per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds content lines longer than 75 octets per RFC 5545 §3.1. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compact = (isoDate: string) => isoDate.replaceAll('-', '');

export function buildIcs(
  calendarName: string,
  items: CalendarItem[],
  now: Date = new Date(),
): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Utsav//Event Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];
  for (const item of items) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.uid}@utsav-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(item.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(item.date, 1))}`,
      `SUMMARY:${escapeIcsText(item.title)}`,
    );
    if (item.description) lines.push(`DESCRIPTION:${escapeIcsText(item.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
