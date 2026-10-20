import { TIER1_CITIES, type Diet, type EventType, type Style } from '../constants.js';

export type CityTier = 1 | 2;

export function cityTier(city: string): CityTier {
  const normalised = city.trim().toLowerCase();
  return TIER1_CITIES.some((name) => normalised === name || normalised.startsWith(`${name} `))
    ? 1
    : 2;
}

const BASE_PLATE: Record<CityTier, number> = { 1: 1000, 2: 700 };
const DIET_FACTOR: Record<Diet, number> = {
  vegetarian: 1,
  'non-vegetarian': 1.25,
  mixed: 1.15,
  jain: 1.05,
  vegan: 1.1,
};
const STYLE_FACTOR: Record<Style, number> = {
  traditional: 1,
  modern: 1.1,
  minimal: 0.85,
  luxury: 1.8,
  eco: 0.95,
};
/** Weddings serve elaborate multi-course spreads; festivals and community events lean on simpler fare. */
const EVENT_FACTOR: Record<EventType, number> = {
  wedding: 1.3,
  engagement: 1.15,
  anniversary: 1,
  birthday: 0.8,
  'baby-shower': 0.8,
  festival: 0.6,
  community: 0.5,
};

/**
 * Indicative per-plate catering cost in rupees, rounded to ₹10.
 * These are deliberately conservative planning numbers, not quotes.
 */
export function typicalPlateCost(
  eventType: EventType,
  city: string,
  style: Style,
  diet: Diet,
): number {
  const raw =
    BASE_PLATE[cityTier(city)] * DIET_FACTOR[diet] * STYLE_FACTOR[style] * EVENT_FACTOR[eventType];
  return Math.round(raw / 10) * 10;
}

/** Recommended minimum lead time (days) before the timeline counts as compressed. */
export const COMFORTABLE_LEAD_DAYS: Record<EventType, number> = {
  wedding: 120,
  engagement: 45,
  birthday: 21,
  anniversary: 30,
  'baby-shower': 21,
  festival: 30,
  community: 30,
};
