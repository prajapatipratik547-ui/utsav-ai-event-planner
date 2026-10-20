import {
  BUDGET_CATEGORIES,
  CATEGORY_META,
  type BudgetCategory,
  type EventType,
  type Style,
} from '../constants.js';
import { formatINR } from '../format.js';
import type { EventInput } from '../schema.js';
import type { BudgetHealth, BudgetLine, BudgetPlan } from '../types.js';
import { typicalPlateCost } from './costs.js';

type Weights = Record<BudgetCategory, number>;

/** Baseline allocation (percent) per event type; each row sums to 100. */
// prettier-ignore
export const BASE_WEIGHTS: Record<EventType, Weights> = {
  wedding: { venue: 20, catering: 28, decor: 12, photography: 9, entertainment: 6, attire: 10, invitations: 2, favors: 3, logistics: 4, contingency: 6 },
  engagement: { venue: 20, catering: 30, decor: 12, photography: 9, entertainment: 6, attire: 8, invitations: 2, favors: 3, logistics: 3, contingency: 7 },
  birthday: { venue: 18, catering: 32, decor: 14, photography: 6, entertainment: 12, attire: 2, invitations: 1, favors: 6, logistics: 2, contingency: 7 },
  anniversary: { venue: 22, catering: 32, decor: 12, photography: 8, entertainment: 9, attire: 4, invitations: 1, favors: 4, logistics: 2, contingency: 6 },
  'baby-shower': { venue: 16, catering: 32, decor: 16, photography: 7, entertainment: 8, attire: 2, invitations: 2, favors: 8, logistics: 2, contingency: 7 },
  festival: { venue: 12, catering: 30, decor: 18, photography: 5, entertainment: 12, attire: 4, invitations: 2, favors: 5, logistics: 4, contingency: 8 },
  community: { venue: 18, catering: 30, decor: 10, photography: 5, entertainment: 12, attire: 0, invitations: 3, favors: 4, logistics: 10, contingency: 8 },
};

const STYLE_MULTIPLIERS: Record<Style, Partial<Weights>> = {
  traditional: { attire: 1.1, decor: 1.1 },
  modern: { entertainment: 1.15, photography: 1.1 },
  minimal: { decor: 0.6, favors: 0.6, entertainment: 0.8, invitations: 0.7 },
  luxury: { decor: 1.3, attire: 1.25, photography: 1.2, venue: 1.15 },
  eco: { decor: 0.8, favors: 0.7, invitations: 0.4, logistics: 1.1 },
};

export const PRIORITY_BOOST = 1.35;
export const EMPHASIS_RANGE = { min: 0.7, max: 1.4 } as const;
const CONTINGENCY_RANGE = { min: 5, max: 10 } as const;
const ROUNDING_UNIT = 100;

export interface BudgetOptions {
  /** Optional per-category multipliers suggested by the AI layer (clamped). */
  emphasis?: Partial<Record<BudgetCategory, number>>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Final percentage weights after style, priorities and AI emphasis; sums to 100. */
export function computeWeights(input: EventInput, options: BudgetOptions = {}): Weights {
  const base = BASE_WEIGHTS[input.eventType];
  const style = STYLE_MULTIPLIERS[input.style];
  const contingency = clamp(base.contingency, CONTINGENCY_RANGE.min, CONTINGENCY_RANGE.max);

  const raw = {} as Weights;
  for (const category of BUDGET_CATEGORIES) {
    if (category === 'contingency') continue;
    let weight = base[category] * (style[category] ?? 1);
    if ((input.priorities as readonly string[]).includes(category)) weight *= PRIORITY_BOOST;
    const emphasis = options.emphasis?.[category];
    if (typeof emphasis === 'number' && Number.isFinite(emphasis)) {
      weight *= clamp(emphasis, EMPHASIS_RANGE.min, EMPHASIS_RANGE.max);
    }
    raw[category] = weight;
  }

  const rawSum = BUDGET_CATEGORIES.reduce(
    (sum, c) => (c === 'contingency' ? sum : sum + raw[c]),
    0,
  );
  const weights = {} as Weights;
  for (const category of BUDGET_CATEGORIES) {
    weights[category] =
      category === 'contingency' ? contingency : (raw[category] / rawSum) * (100 - contingency);
  }
  return weights;
}

/**
 * Splits `total` across categories in ₹100 units using the largest-remainder
 * method, so the rounded amounts always add up to exactly `total`.
 */
export function allocate(total: number, weights: Weights): Record<BudgetCategory, number> {
  const units = Math.floor(total / ROUNDING_UNIT);
  const leftoverRupees = total - units * ROUNDING_UNIT;
  const exact = BUDGET_CATEGORIES.map((category) => ({
    category,
    exact: (weights[category] / 100) * units,
  }));
  const floored = exact.map((entry) => ({ ...entry, units: Math.floor(entry.exact) }));
  let remaining = units - floored.reduce((sum, entry) => sum + entry.units, 0);
  const byRemainder = [...floored].sort(
    (a, b) => b.exact - b.units - (a.exact - a.units) || a.category.localeCompare(b.category),
  );
  for (const entry of byRemainder) {
    if (remaining <= 0) break;
    entry.units += 1;
    remaining -= 1;
  }
  const result = {} as Record<BudgetCategory, number>;
  for (const entry of floored) result[entry.category] = entry.units * ROUNDING_UNIT;
  result.contingency += leftoverRupees;
  return result;
}

export function budgetHealth(perPlate: number, typical: number): BudgetHealth {
  const ratio = typical === 0 ? Infinity : perPlate / typical;
  if (ratio >= 1.3) return 'comfortable';
  if (ratio >= 0.9) return 'balanced';
  return 'tight';
}

function lineNote(category: BudgetCategory, amount: number, input: EventInput): string {
  const perGuest = amount / input.guests;
  switch (category) {
    case 'catering':
      return `≈ ${formatINR(perGuest)} per plate for ${input.guests} guests`;
    case 'favors':
      return `≈ ${formatINR(perGuest)} per guest`;
    case 'invitations':
      return input.style === 'eco'
        ? 'Digital-first invites keep this low'
        : 'Printed + digital invites';
    case 'contingency':
      return 'Keep untouched until the final week';
    default:
      return '';
  }
}

export function buildBudget(input: EventInput, options: BudgetOptions = {}): BudgetPlan {
  const weights = computeWeights(input, options);
  const amounts = allocate(input.budget, weights);

  const lines: BudgetLine[] = BUDGET_CATEGORIES.filter((c) => amounts[c] > 0).map((category) => ({
    category,
    label: CATEGORY_META[category].label,
    amount: amounts[category],
    percent: Math.round((amounts[category] / input.budget) * 1000) / 10,
    note: lineNote(category, amounts[category], input),
  }));

  const typical = typicalPlateCost(input.eventType, input.city, input.style, input.diet);
  const perPlate = Math.round(amounts.catering / input.guests);
  const health = budgetHealth(perPlate, typical);

  const warnings: string[] = [];
  if (health === 'tight') {
    warnings.push(
      `Catering works out to about ${formatINR(perPlate)} per plate, below the typical ${formatINR(typical)} in ${input.city}. Consider a shorter guest list, a lunch instead of dinner, or moving money from decor.`,
    );
  }
  if (input.budget / input.guests < 300) {
    warnings.push(
      `${formatINR(input.budget / input.guests)} per guest is very lean — a potluck, community kitchen or home venue will stretch it furthest.`,
    );
  }

  return {
    total: input.budget,
    perGuest: Math.round(input.budget / input.guests),
    perPlate,
    typicalPlateCost: typical,
    health,
    lines,
    warnings,
  };
}
