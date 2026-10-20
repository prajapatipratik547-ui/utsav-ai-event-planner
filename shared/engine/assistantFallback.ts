import { CATEGORY_META, EVENT_TYPE_META, type BudgetCategory } from '../constants.js';
import { formatDate, formatINR, pluralize } from '../format.js';
import type { PlanContext } from '../schema.js';

/** Categories that are usually safe to trim without hurting the guest experience. */
const DISCRETIONARY: BudgetCategory[] = [
  'decor',
  'favors',
  'entertainment',
  'attire',
  'invitations',
  'photography',
];

const has = (question: string, words: string[]) => words.some((w) => question.includes(w));

/**
 * Rule-based assistant used when no model is reachable. It answers the most
 * common planning questions from the user's actual numbers, so the feature
 * degrades gracefully instead of failing.
 */
export function offlineAssistantReply(context: PlanContext, question: string): string {
  const q = question.toLowerCase();
  const lines = [...context.budgetLines].sort((a, b) => b.amount - a.amount);

  if (
    has(q, ['cut', 'reduce', 'cheaper', 'save', 'lower', 'kam', 'bachat', 'over budget', 'trim'])
  ) {
    const target = lines.filter((l) => DISCRETIONARY.includes(l.category)).slice(0, 3);
    const savings = target.map((l) => ({ ...l, save: Math.round((l.amount * 0.15) / 100) * 100 }));
    const total = savings.reduce((sum, l) => sum + l.save, 0);
    return [
      `Here is a gentle 15% trim on your most flexible categories, saving about ${formatINR(total)}:`,
      ...savings.map(
        (l) =>
          `- ${CATEGORY_META[l.category].label}: ${formatINR(l.amount)} → ${formatINR(l.amount - l.save)}`,
      ),
      '- Keep venue, catering and contingency intact — they protect the guest experience.',
      `- Trimming the guest list by 10% would save roughly ${formatINR((context.budget / context.guests) * Math.round(context.guests * 0.1))}.`,
    ].join('\n');
  }

  if (has(q, ['next', 'when', 'deadline', 'timeline', 'schedule', 'first', 'kab'])) {
    if (context.upcoming.length === 0)
      return 'Every timeline task is done — enjoy the celebration!';
    return [
      `Your next ${pluralize(Math.min(3, context.upcoming.length), 'step')}:`,
      ...context.upcoming.slice(0, 3).map((m) => `- ${m.title} — by ${formatDate(m.dueDate)}`),
    ].join('\n');
  }

  if (has(q, ['guest', 'people', 'headcount', 'plate', 'per head'])) {
    const catering = context.budgetLines.find((l) => l.category === 'catering')?.amount ?? 0;
    return [
      `With ${context.guests} guests, your overall budget is ${formatINR(context.budget / context.guests)} per guest.`,
      `- Catering allows about ${formatINR(catering / context.guests)} per plate.`,
      '- Give the caterer a final count 3 weeks out, with a 5% buffer.',
      '- Track RSVPs in the Guests tab to see the confirmed headcount live.',
    ].join('\n');
  }

  if (has(q, ['vendor', 'book', 'caterer', 'photographer', 'decorator', 'venue'])) {
    return [
      'Book in this order — each one depends on the previous:',
      '- Venue (fixes date and capacity)',
      '- Caterer (tasting first) and photographer',
      '- Decorator and entertainment',
      '- Everything else',
      'Open the Vendors tab for the questions to ask each one.',
    ].join('\n');
  }

  const spent = context.budgetLines.reduce((sum, l) => sum + l.spent, 0);
  return [
    `${context.title} — ${EVENT_TYPE_META[context.eventType].label} in ${context.city}, ${context.daysUntil >= 0 ? pluralize(context.daysUntil, 'day') + ' to go' : 'already held'}.`,
    `- Budget ${formatINR(context.budget)}, spent so far ${formatINR(spent)}.`,
    context.upcoming[0]
      ? `- Next up: ${context.upcoming[0].title} (by ${formatDate(context.upcoming[0].dueDate)}).`
      : '- All timeline tasks are complete.',
    'Ask me to cut costs, what to do next, or how to handle guests and vendors.',
  ].join('\n');
}
