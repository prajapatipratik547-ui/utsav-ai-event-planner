// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ANGLE_BRACKETS = /[<>]/g;
const URLS = /\b(?:https?:\/\/|www\.)\S+/gi;
const WHITESPACE_RUNS = /[ \t]{2,}/g;

/**
 * Normalises free text typed by a user before it is stored or placed in a prompt.
 * Angle brackets are removed so user text can never close the XML-style
 * delimiters that fence it inside model prompts.
 */
export function cleanUserText(value: string, maxLength: number): string {
  return value
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(ANGLE_BRACKETS, '')
    .replace(WHITESPACE_RUNS, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Normalises a string produced by a model: strips links (no phishing surface),
 * markup characters and control characters, then clips it to a safe length.
 */
export function cleanModelText(value: string, maxLength: number): string {
  return truncateWords(
    value
      .replace(URLS, '')
      .replace(CONTROL_CHARS, '')
      .replace(ANGLE_BRACKETS, '')
      .replace(WHITESPACE_RUNS, ' ')
      .trim(),
    maxLength,
  );
}

/**
 * Shortens text to at most `maxLength` characters without cutting a word in
 * half, ending with an ellipsis. Falls back to a hard cut for unbroken text.
 */
export function truncateWords(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const hard = value.slice(0, maxLength - 1);
  const lastSpace = hard.lastIndexOf(' ');
  const cut = lastSpace >= maxLength * 0.6 ? hard.slice(0, lastSpace) : hard;
  return `${cut.replace(/[\s,;:.\-–—]+$/, '')}…`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
