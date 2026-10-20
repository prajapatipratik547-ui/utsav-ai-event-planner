import { z } from 'zod';
import { BUDGET_CATEGORIES, TASK_CATEGORIES, type BudgetCategory } from '../constants.js';
import { cleanModelText } from '../text.js';
import type { ExtraTask } from './timeline.js';

/**
 * The creative layer a language model adds on top of the deterministic plan.
 * Models never produce rupee amounts or dates directly: they can only nudge
 * category emphasis and suggest extra tasks, which the engine then clamps,
 * rounds and dates. This keeps money and deadlines correct even if a model
 * hallucinates.
 */
export interface AiEnhancement {
  summary: string;
  theme: { name: string; description: string; palette: string[] };
  decor: string[];
  menu: string[];
  activities: string[];
  favors: string[];
  tips: string[];
  budgetEmphasis: Partial<Record<BudgetCategory, number>>;
  extraTasks: ExtraTask[];
}

const HEX = /^#[0-9a-f]{6}$/i;

const text = (max: number) =>
  z
    .string()
    .transform((value) => cleanModelText(value, max))
    .pipe(z.string().min(1));

/** A list that silently drops bad items instead of rejecting the whole response. */
const list = (maxItems: number, maxLength: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .filter((item): item is string => typeof item === 'string')
        .map((item) => cleanModelText(item, maxLength))
        .filter((item) => item.length > 0)
        .slice(0, maxItems),
    );

const extraTaskSchema = z.object({
  title: text(90),
  category: z.enum(TASK_CATEGORIES).catch('planning'),
  daysBefore: z.number().int().min(0).max(400),
});

const enhancementSchema = z.object({
  summary: text(600),
  theme: z.object({
    name: text(60),
    description: text(240),
    palette: z
      .array(z.unknown())
      .catch([])
      .transform((items) =>
        items.filter((c): c is string => typeof c === 'string' && HEX.test(c.trim())).slice(0, 5),
      ),
  }),
  decor: list(6, 160),
  menu: list(8, 160),
  activities: list(6, 160),
  favors: list(5, 120),
  tips: list(6, 200),
  budgetEmphasis: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((record) => {
      const out: Partial<Record<BudgetCategory, number>> = {};
      for (const category of BUDGET_CATEGORIES) {
        const value = record[category];
        if (category !== 'contingency' && typeof value === 'number' && Number.isFinite(value)) {
          out[category] = value;
        }
      }
      return out;
    }),
  extraTasks: z
    .array(z.unknown())
    .catch([])
    .transform((items) => {
      const tasks: ExtraTask[] = [];
      for (const item of items) {
        const parsed = extraTaskSchema.safeParse(item);
        if (parsed.success) tasks.push(parsed.data);
        if (tasks.length === 5) break;
      }
      return tasks;
    }),
});

/**
 * Validates and normalises raw model JSON. Returns `null` when the response is
 * unusable (e.g. missing a summary), so callers can fall back cleanly.
 */
export function parseEnhancement(raw: unknown): AiEnhancement | null {
  const result = enhancementSchema.safeParse(raw);
  if (!result.success) return null;
  const value = result.data;
  const ideaCount = value.decor.length + value.menu.length + value.activities.length;
  return ideaCount === 0 ? null : value;
}

/** JSON Schema handed to the model so it returns exactly the shape we parse. */
export const ENHANCEMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two or three warm sentences summarising the plan.' },
    theme: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        palette: {
          type: 'array',
          items: { type: 'string', description: 'Hex colour like #A1B2C3' },
          minItems: 3,
          maxItems: 5,
        },
      },
      required: ['name', 'description', 'palette'],
    },
    decor: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
    menu: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 8 },
    activities: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
    favors: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    tips: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
    budgetEmphasis: {
      type: 'object',
      description:
        'Optional multipliers between 0.7 and 1.4 for categories that deserve more or less money for this specific event.',
      properties: Object.fromEntries(
        BUDGET_CATEGORIES.filter((c) => c !== 'contingency').map((c) => [c, { type: 'number' }]),
      ),
    },
    extraTasks: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: [...TASK_CATEGORIES] },
          daysBefore: { type: 'integer' },
        },
        required: ['title', 'category', 'daysBefore'],
      },
    },
  },
  required: ['summary', 'theme', 'decor', 'menu', 'activities', 'favors', 'tips'],
} as const;
