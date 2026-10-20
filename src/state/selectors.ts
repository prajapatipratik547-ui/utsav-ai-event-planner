import { BUDGET_CATEGORIES, CATEGORY_META, type BudgetCategory } from '../../shared/constants.js';
import { daysBetween } from '../../shared/date.js';
import type { ChatMessage, PlanContext } from '../../shared/schema.js';
import type { Milestone } from '../../shared/types.js';
import type { SavedPlan } from './types.js';

export interface BudgetRow {
  category: BudgetCategory;
  label: string;
  suggested: number;
  allocated: number;
  spent: number;
  remaining: number;
  note: string;
}

export interface BudgetSummary {
  rows: BudgetRow[];
  total: number;
  allocated: number;
  spent: number;
  /** Positive = money not yet assigned; negative = over-allocated. */
  unallocated: number;
  overspentCategories: BudgetCategory[];
}

export function budgetSummary(saved: SavedPlan): BudgetSummary {
  const { plan, progress } = saved;
  const suggestedBy = new Map(plan.budget.lines.map((l) => [l.category, l]));
  const rows: BudgetRow[] = [];
  for (const category of BUDGET_CATEGORIES) {
    const line = suggestedBy.get(category);
    const override = progress.budgetOverrides[category];
    const spent = progress.spent[category] ?? 0;
    if (!line && override === undefined && spent === 0) continue;
    const suggested = line?.amount ?? 0;
    const allocated = override ?? suggested;
    rows.push({
      category,
      label: CATEGORY_META[category].label,
      suggested,
      allocated,
      spent,
      remaining: allocated - spent,
      note: line?.note ?? '',
    });
  }
  const allocated = rows.reduce((sum, r) => sum + r.allocated, 0);
  const spent = rows.reduce((sum, r) => sum + r.spent, 0);
  return {
    rows,
    total: plan.budget.total,
    allocated,
    spent,
    unallocated: plan.budget.total - allocated,
    overspentCategories: rows.filter((r) => r.remaining < 0).map((r) => r.category),
  };
}

export interface TimelineItem extends Milestone {
  done: boolean;
  custom: boolean;
  overdue: boolean;
}

export function timelineItems(saved: SavedPlan, today: string): TimelineItem[] {
  const custom = new Set(saved.progress.customMilestones.map((m) => m.id));
  return [...saved.plan.timeline, ...saved.progress.customMilestones]
    .map((m) => {
      const done = Boolean(saved.progress.milestonesDone[m.id]);
      return { ...m, done, custom: custom.has(m.id), overdue: !done && m.dueDate < today };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.daysBefore - a.daysBefore);
}

export function upcoming(saved: SavedPlan, today: string, count = 3): TimelineItem[] {
  return timelineItems(saved, today)
    .filter((m) => !m.done)
    .slice(0, count);
}

export interface GuestStats {
  invitations: number;
  people: number;
  attending: number;
  pending: number;
  declined: number;
}

export function guestStats(saved: SavedPlan): GuestStats {
  const stats: GuestStats = { invitations: 0, people: 0, attending: 0, pending: 0, declined: 0 };
  for (const guest of saved.progress.guests) {
    stats.invitations += 1;
    stats.people += guest.partySize;
    if (guest.rsvp === 'yes') stats.attending += guest.partySize;
    else if (guest.rsvp === 'no') stats.declined += guest.partySize;
    else stats.pending += guest.partySize;
  }
  return stats;
}

export interface ProgressStats {
  daysUntil: number;
  tasksDone: number;
  tasksTotal: number;
  vendorsBooked: number;
  vendorsTotal: number;
}

export function progressStats(saved: SavedPlan, today: string): ProgressStats {
  const items = timelineItems(saved, today);
  const vendors = saved.plan.vendors;
  return {
    daysUntil: daysBetween(today, saved.plan.input.date),
    tasksDone: items.filter((m) => m.done).length,
    tasksTotal: items.length,
    vendorsBooked: vendors.filter((v) => {
      const status = saved.progress.vendorStatus[v.id];
      return status === 'booked' || status === 'paid';
    }).length,
    vendorsTotal: vendors.length,
  };
}

/** Compact, validated-shape snapshot sent to the assistant endpoint. */
export function planContext(saved: SavedPlan, today: string): PlanContext {
  const { input } = saved.plan;
  const summary = budgetSummary(saved);
  return {
    eventType: input.eventType,
    title: input.title,
    date: input.date,
    city: input.city,
    guests: input.guests,
    budget: input.budget,
    style: input.style,
    diet: input.diet,
    language: input.language,
    daysUntil: daysBetween(today, input.date),
    budgetLines: summary.rows.map((r) => ({
      category: r.category,
      amount: r.allocated,
      spent: r.spent,
    })),
    upcoming: upcoming(saved, today, 5).map((m) => ({
      title: m.title.slice(0, 120),
      dueDate: m.dueDate,
    })),
    theme: saved.plan.ideas.theme.name.slice(0, 80),
  };
}

/** Last N chat turns, trimmed so the conversation always ends with the user. */
export function chatHistory(saved: SavedPlan, max = 12): ChatMessage[] {
  return saved.progress.chat.slice(-max).map(({ role, content }) => ({ role, content }));
}
