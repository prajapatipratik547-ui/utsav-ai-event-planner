import type { EventInput } from '../shared/schema.js';

export const TODAY = '2026-10-20';

export function makeInput(overrides: Partial<EventInput> = {}): EventInput {
  return {
    eventType: 'wedding',
    title: 'Aarav & Diya’s Wedding',
    date: '2027-02-14',
    city: 'Pune',
    guests: 250,
    budget: 1_500_000,
    style: 'traditional',
    diet: 'vegetarian',
    priorities: [],
    notes: '',
    language: 'en',
    ...overrides,
  };
}

/** A well-formed model response, as Gemini or Groq would return it. */
export const SAMPLE_ENHANCEMENT = {
  summary: 'A warm, marigold-filled wedding that keeps the focus on family and food.',
  theme: {
    name: 'Haldi Gold',
    description: 'Sunny yellows and fresh flowers.',
    palette: ['#F2A007', '#8A1C3B', '#FFF4E0'],
  },
  decor: ['Marigold torans', 'Brass urli with floating flowers', 'Fairy-light canopy'],
  menu: ['Puran poli', 'Misal pav live counter', 'Shrikhand'],
  activities: ['Lavani performance', 'Antakshari night', 'Haldi flower shower'],
  favors: ['Paithani potli with mithai', 'Seed cards'],
  tips: [
    'Book the hall before Diwali rush',
    'Ask for a Maharashtrian thali tasting',
    'Keep elders’ seating near the stage',
  ],
  budgetEmphasis: { catering: 1.2, decor: 0.9, contingency: 3 },
  extraTasks: [{ title: 'Book nashik dhol pathak', category: 'entertainment', daysBefore: 60 }],
};
