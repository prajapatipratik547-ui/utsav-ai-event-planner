import type { BudgetCategory, TaskCategory } from './constants.js';
import type { EventInput } from './schema.js';

export type PlanSource = 'gemini' | 'groq' | 'offline';

export interface BudgetLine {
  category: BudgetCategory;
  label: string;
  amount: number;
  /** Share of the total budget, 0–100, one decimal place. */
  percent: number;
  note: string;
}

export type BudgetHealth = 'comfortable' | 'balanced' | 'tight';

export interface BudgetPlan {
  total: number;
  perGuest: number;
  /** Catering allocation divided by guests. */
  perPlate: number;
  /** Indicative market plate cost for this city, style and diet. */
  typicalPlateCost: number;
  health: BudgetHealth;
  lines: BudgetLine[];
  warnings: string[];
}

export interface Milestone {
  id: string;
  title: string;
  detail: string;
  category: TaskCategory;
  /** Days before the event (negative = after the event). */
  daysBefore: number;
  dueDate: string;
}

export interface VendorTask {
  id: string;
  vendor: string;
  category: BudgetCategory;
  dueDate: string;
  checks: string[];
}

export interface Ideas {
  theme: { name: string; description: string; palette: string[] };
  decor: string[];
  menu: string[];
  activities: string[];
  favors: string[];
  tips: string[];
}

export interface EventPlan {
  version: 1;
  input: EventInput;
  generatedOn: string;
  daysUntil: number;
  /** True when the standard lead times did not fit and the timeline was squeezed. */
  compressed: boolean;
  summary: string;
  source: PlanSource;
  budget: BudgetPlan;
  timeline: Milestone[];
  vendors: VendorTask[];
  ideas: Ideas;
}

export interface PlanResponse {
  plan: EventPlan;
  cached: boolean;
}

export interface AssistantResponse {
  reply: string;
  source: PlanSource;
}

export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}
