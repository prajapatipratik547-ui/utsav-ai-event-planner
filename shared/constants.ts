/**
 * Domain vocabulary shared by the browser and the API.
 * Everything the planner reasons about is declared here once, so the UI, the
 * validation schemas, the deterministic engine and the AI prompts never drift.
 */

export const EVENT_TYPES = [
  'wedding',
  'engagement',
  'birthday',
  'anniversary',
  'baby-shower',
  'festival',
  'community',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const STYLES = ['traditional', 'modern', 'minimal', 'luxury', 'eco'] as const;
export type Style = (typeof STYLES)[number];

export const DIETS = ['vegetarian', 'non-vegetarian', 'mixed', 'jain', 'vegan'] as const;
export type Diet = (typeof DIETS)[number];

export const LANGUAGES = ['en', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];

export const BUDGET_CATEGORIES = [
  'venue',
  'catering',
  'decor',
  'photography',
  'entertainment',
  'attire',
  'invitations',
  'favors',
  'logistics',
  'contingency',
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

/** Categories a user may mark as "most important" (contingency is never optional). */
export const PRIORITY_CATEGORIES = [
  'venue',
  'catering',
  'decor',
  'photography',
  'entertainment',
  'attire',
] as const satisfies readonly BudgetCategory[];
export type PriorityCategory = (typeof PRIORITY_CATEGORIES)[number];

/** Timeline tasks can also be pure planning work that has no budget line. */
export const TASK_CATEGORIES = [...BUDGET_CATEGORIES, 'planning'] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const EVENT_TYPE_META: Record<EventType, { label: string; icon: string; blurb: string }> = {
  wedding: { label: 'Wedding', icon: '💍', blurb: 'Multi-day ceremonies, families and feasts' },
  engagement: { label: 'Engagement', icon: '💐', blurb: 'Ring ceremony, roka or sagai' },
  birthday: { label: 'Birthday', icon: '🎂', blurb: 'Kids, milestones and surprise parties' },
  anniversary: { label: 'Anniversary', icon: '🥂', blurb: 'Silver, golden or just-because' },
  'baby-shower': { label: 'Baby shower', icon: '🍼', blurb: 'Godh bharai and welcome parties' },
  festival: {
    label: 'Festival',
    icon: '🪔',
    blurb: 'Diwali, Ganesh utsav, Navratri, Eid, Christmas',
  },
  community: { label: 'Community', icon: '🤝', blurb: 'Society meets, fundraisers, reunions' },
};

export const STYLE_META: Record<Style, { label: string; description: string }> = {
  traditional: { label: 'Traditional', description: 'Rituals, heritage decor, classic menus' },
  modern: { label: 'Modern', description: 'Clean, contemporary and experience-led' },
  minimal: { label: 'Minimal', description: 'Intimate, simple and cost-conscious' },
  luxury: { label: 'Luxury', description: 'Statement decor and premium vendors' },
  eco: { label: 'Eco-friendly', description: 'Low-waste, local and sustainable' },
};

export const DIET_META: Record<Diet, string> = {
  vegetarian: 'Vegetarian',
  'non-vegetarian': 'Non-vegetarian',
  mixed: 'Mixed (veg + non-veg)',
  jain: 'Jain (no onion/garlic)',
  vegan: 'Vegan',
};

export const LANGUAGE_META: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
};

export const CATEGORY_META: Record<TaskCategory, { label: string; color: string }> = {
  venue: { label: 'Venue', color: '#8a1c3b' },
  catering: { label: 'Catering', color: '#c2410c' },
  decor: { label: 'Decor & flowers', color: '#b7791f' },
  photography: { label: 'Photo & video', color: '#0f766e' },
  entertainment: { label: 'Entertainment', color: '#6d28d9' },
  attire: { label: 'Attire & styling', color: '#be185d' },
  invitations: { label: 'Invitations', color: '#1d4ed8' },
  favors: { label: 'Gifts & favours', color: '#15803d' },
  logistics: { label: 'Travel & logistics', color: '#475569' },
  contingency: { label: 'Contingency', color: '#78716c' },
  planning: { label: 'Planning', color: '#334155' },
};

/** Cities treated as tier-1 for cost estimates (matched case-insensitively). */
export const TIER1_CITIES = [
  'mumbai',
  'delhi',
  'new delhi',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'chennai',
  'kolkata',
  'pune',
  'ahmedabad',
  'gurugram',
  'gurgaon',
  'noida',
  'navi mumbai',
  'thane',
] as const;

export const LIMITS = {
  minBudget: 5_000,
  maxBudget: 100_000_000,
  minGuests: 1,
  maxGuests: 5_000,
  titleMax: 80,
  cityMax: 60,
  notesMax: 500,
  maxPriorities: 3,
  maxDaysAhead: 3 * 365,
  assistantMessageMax: 1_000,
  assistantHistoryMax: 12,
} as const;
