import { z } from 'zod';
import {
  BUDGET_CATEGORIES,
  DIETS,
  EVENT_TYPES,
  LANGUAGES,
  LIMITS,
  PRIORITY_CATEGORIES,
  STYLES,
} from './constants.js';
import { isValidIsoDate } from './date.js';
import { cleanUserText } from './text.js';

const isoDate = z
  .string()
  .refine(isValidIsoDate, { message: 'Use a real calendar date (YYYY-MM-DD).' });

const userText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((value) => cleanUserText(value, max))
    .pipe(z.string().min(min, `${label} must be at least ${min} characters.`));

/** Everything a user tells us about their event. Validated identically in browser and API. */
export const eventInputSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  title: userText(2, LIMITS.titleMax, 'Event name'),
  date: isoDate,
  city: userText(2, LIMITS.cityMax, 'City'),
  guests: z
    .number({ message: 'Enter the number of guests.' })
    .int('Guests must be a whole number.')
    .min(LIMITS.minGuests, `At least ${LIMITS.minGuests} guest.`)
    .max(LIMITS.maxGuests, `Up to ${LIMITS.maxGuests.toLocaleString('en-IN')} guests.`),
  budget: z
    .number({ message: 'Enter a budget in rupees.' })
    .int('Budget must be a whole number of rupees.')
    .min(LIMITS.minBudget, `Budget must be at least ₹${LIMITS.minBudget.toLocaleString('en-IN')}.`)
    .max(LIMITS.maxBudget, 'Budget is above the supported range.'),
  style: z.enum(STYLES),
  diet: z.enum(DIETS),
  priorities: z
    .array(z.enum(PRIORITY_CATEGORIES))
    .max(LIMITS.maxPriorities, `Pick up to ${LIMITS.maxPriorities} priorities.`)
    .transform((list) => [...new Set(list)]),
  notes: z.string().transform((value) => cleanUserText(value, LIMITS.notesMax)),
  language: z.enum(LANGUAGES),
});

export type EventInput = z.output<typeof eventInputSchema>;

export const planRequestSchema = z.object({
  input: eventInputSchema,
  /** The browser's local calendar date; only trusted within ±1 day of the server's. */
  today: isoDate.optional(),
});

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .transform((value) => cleanUserText(value, LIMITS.assistantMessageMax))
    .pipe(z.string().min(1)),
});
export type ChatMessage = z.output<typeof chatMessageSchema>;

/** Compact, non-sensitive snapshot of a plan that the assistant reasons over. */
export const planContextSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  title: userText(1, LIMITS.titleMax, 'Title'),
  date: isoDate,
  city: userText(1, LIMITS.cityMax, 'City'),
  guests: z.number().int().min(LIMITS.minGuests).max(LIMITS.maxGuests),
  budget: z.number().int().min(0).max(LIMITS.maxBudget),
  style: z.enum(STYLES),
  diet: z.enum(DIETS),
  language: z.enum(LANGUAGES),
  daysUntil: z.number().int().min(-3650).max(3650),
  budgetLines: z
    .array(
      z.object({
        category: z.enum(BUDGET_CATEGORIES),
        amount: z.number().min(0).max(LIMITS.maxBudget),
        spent: z.number().min(0).max(LIMITS.maxBudget),
      }),
    )
    .max(BUDGET_CATEGORIES.length),
  upcoming: z.array(z.object({ title: userText(1, 120, 'Task'), dueDate: isoDate })).max(8),
  theme: userText(0, 80, 'Theme').optional(),
});
export type PlanContext = z.output<typeof planContextSchema>;

export const assistantRequestSchema = z.object({
  context: planContextSchema,
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(LIMITS.assistantHistoryMax)
    .refine((list) => list.at(-1)?.role === 'user', 'The last message must come from the user.'),
});
export type AssistantRequest = z.output<typeof assistantRequestSchema>;

/** Collapses zod issues into a field → message map the UI can render inline. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.filter((p) => typeof p !== 'symbol').join('.') || 'form';
    out[key] ??= issue.message;
  }
  return out;
}
