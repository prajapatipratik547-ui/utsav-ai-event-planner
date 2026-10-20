import { EVENT_TYPE_META, STYLE_META } from '../constants.js';
import { daysBetween } from '../date.js';
import { formatINR, formatLongDate, pluralize } from '../format.js';
import type { EventInput } from '../schema.js';
import type { EventPlan, Ideas, PlanSource } from '../types.js';
import { buildBudget } from './budget.js';
import { COMFORTABLE_LEAD_DAYS } from './costs.js';
import type { AiEnhancement } from './enhancement.js';
import { fallbackIdeas } from './ideas.js';
import { buildTimeline } from './timeline.js';
import { buildVendors } from './vendors.js';

export interface BuildPlanOptions {
  /** Calendar date the plan is generated on (YYYY-MM-DD). */
  today: string;
  enhancement?: AiEnhancement | null;
  source?: PlanSource;
}

function offlineSummary(input: EventInput, daysUntil: number): string {
  const kind = `${STYLE_META[input.style].label.toLowerCase()} ${EVENT_TYPE_META[input.eventType].label.toLowerCase()}`;
  const countdown =
    daysUntil > 0
      ? `${pluralize(daysUntil, 'day')} to go`
      : daysUntil === 0
        ? 'It is today'
        : 'It has passed';
  return `${input.title} is a ${kind} for ${input.guests} guests in ${input.city} on ${formatLongDate(input.date)}, with a budget of ${formatINR(input.budget)} (about ${formatINR(input.budget / input.guests)} per guest). ${countdown} — here is a balanced plan to get you there.`;
}

function mergeIdeas(base: Ideas, ai: AiEnhancement | null | undefined): Ideas {
  if (!ai) return base;
  const pick = (aiList: string[], fallback: string[]) => (aiList.length > 0 ? aiList : fallback);
  return {
    theme: {
      name: ai.theme.name,
      description: ai.theme.description,
      palette: ai.theme.palette.length >= 3 ? ai.theme.palette : base.theme.palette,
    },
    decor: pick(ai.decor, base.decor),
    menu: pick(ai.menu, base.menu),
    activities: pick(ai.activities, base.activities),
    favors: pick(ai.favors, base.favors),
    tips: pick(ai.tips, base.tips),
  };
}

/**
 * Builds a complete plan. Pure and deterministic for a given input, date and
 * enhancement, which is what makes it cacheable and easy to test.
 */
export function buildPlan(input: EventInput, options: BuildPlanOptions): EventPlan {
  const { today, enhancement } = options;
  const daysUntil = daysBetween(today, input.date);

  const budget = buildBudget(input, { emphasis: enhancement?.budgetEmphasis });
  const { milestones, compressed } = buildTimeline(
    input.eventType,
    input.date,
    daysUntil,
    enhancement?.extraTasks,
  );
  const vendors = buildVendors(
    input.eventType,
    input.diet,
    input.date,
    daysUntil,
    budget.lines,
    milestones,
  );
  const ideas = mergeIdeas(fallbackIdeas(input.eventType, input.style, input.diet), enhancement);

  if (daysUntil >= 0 && daysUntil < COMFORTABLE_LEAD_DAYS[input.eventType]) {
    budget.warnings.push(
      `Only ${pluralize(daysUntil, 'day')} to go — the timeline has been compressed. Lock the venue and caterer this week; popular vendors book out early.`,
    );
  }

  return {
    version: 1,
    input,
    generatedOn: today,
    daysUntil,
    compressed,
    summary: enhancement?.summary ?? offlineSummary(input, daysUntil),
    source: enhancement ? (options.source ?? 'offline') : 'offline',
    budget,
    timeline: milestones,
    vendors,
    ideas,
  };
}
