import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../shared/engine/planner.js';
import { parseRoute, routeHref } from '../../src/lib/browser.js';
import { plansReducer, type PlansState } from '../../src/state/reducer.js';
import {
  budgetSummary,
  chatHistory,
  guestStats,
  planContext,
  progressStats,
  timelineItems,
  upcoming,
} from '../../src/state/selectors.js';
import { loadPlans, savePlans, STORAGE_KEY } from '../../src/state/storage.js';
import { planContextSchema } from '../../shared/schema.js';
import { makeInput, TODAY } from '../fixtures.js';

const AT = '2026-10-20T10:00:00.000Z';
const plan = buildPlan(makeInput(), { today: TODAY });
const seed = (): PlansState => plansReducer([], { type: 'plan/add', id: 'p1', plan, at: AT });
const get = (state: PlansState) => state.find((p) => p.id === 'p1')!;

describe('plansReducer', () => {
  it('adds newest plans first and caps the list', () => {
    let state: PlansState = [];
    for (let i = 0; i < 25; i++)
      state = plansReducer(state, { type: 'plan/add', id: `p${i}`, plan, at: AT });
    expect(state).toHaveLength(20);
    expect(state[0]!.id).toBe('p24');
  });

  it('toggles, adds and removes milestones', () => {
    let state = plansReducer(seed(), { type: 'milestone/toggle', id: 'p1', milestoneId: 'venue' });
    expect(get(state).progress.milestonesDone.venue).toBe(true);
    state = plansReducer(state, { type: 'milestone/toggle', id: 'p1', milestoneId: 'venue' });
    expect(get(state).progress.milestonesDone.venue).toBe(false);
    const milestone = {
      id: 'custom-1',
      title: 'Hampers',
      detail: '',
      category: 'favors' as const,
      daysBefore: 10,
      dueDate: '2027-02-04',
    };
    state = plansReducer(state, { type: 'milestone/add', id: 'p1', milestone });
    state = plansReducer(state, { type: 'milestone/toggle', id: 'p1', milestoneId: 'custom-1' });
    expect(timelineItems(get(state), TODAY).find((m) => m.id === 'custom-1')).toMatchObject({
      custom: true,
      done: true,
    });
    state = plansReducer(state, { type: 'milestone/remove', id: 'p1', milestoneId: 'custom-1' });
    expect(get(state).progress.customMilestones).toHaveLength(0);
    expect(get(state).progress.milestonesDone['custom-1']).toBeUndefined();
  });

  it('tracks vendor status and clips notes', () => {
    let state = plansReducer(seed(), {
      type: 'vendor/status',
      id: 'p1',
      vendorId: 'venue',
      status: 'booked',
    });
    state = plansReducer(state, {
      type: 'vendor/notes',
      id: 'p1',
      vendorId: 'venue',
      notes: 'x'.repeat(900),
    });
    expect(get(state).progress.vendorStatus.venue).toBe('booked');
    expect(get(state).progress.vendorNotes.venue).toHaveLength(500);
    expect(progressStats(get(state), TODAY).vendorsBooked).toBe(1);
  });

  it('sanitises money and supports budget reset', () => {
    let state = plansReducer(seed(), {
      type: 'budget/allocate',
      id: 'p1',
      category: 'decor',
      amount: -50,
    });
    state = plansReducer(state, {
      type: 'budget/spend',
      id: 'p1',
      category: 'venue',
      amount: 1234.6,
    });
    state = plansReducer(state, {
      type: 'budget/spend',
      id: 'p1',
      category: 'favors',
      amount: Number.NaN,
    });
    expect(get(state).progress.budgetOverrides.decor).toBe(0);
    expect(get(state).progress.spent.venue).toBe(1235);
    expect(get(state).progress.spent.favors).toBe(0);
    state = plansReducer(state, { type: 'budget/reset', id: 'p1' });
    expect(get(state).progress.budgetOverrides).toEqual({});
  });

  it('manages guests', () => {
    let state = plansReducer(seed(), {
      type: 'guest/add',
      id: 'p1',
      guests: [
        { id: 'g1', name: 'Sharma family', group: 'Bride', partySize: 4, rsvp: 'yes' },
        { id: 'g2', name: 'Ravi', group: '', partySize: 1, rsvp: 'pending' },
        { id: 'g3', name: 'Asha', group: '', partySize: 2, rsvp: 'no' },
      ],
    });
    state = plansReducer(state, {
      type: 'guest/update',
      id: 'p1',
      guestId: 'g2',
      changes: { partySize: 2 },
    });
    expect(guestStats(get(state))).toEqual({
      invitations: 3,
      people: 8,
      attending: 4,
      pending: 2,
      declined: 2,
    });
    state = plansReducer(state, { type: 'guest/remove', id: 'p1', guestId: 'g3' });
    expect(get(state).progress.guests).toHaveLength(2);
  });

  it('keeps guests, spending and chat when a plan is regenerated', () => {
    let state = plansReducer(seed(), {
      type: 'guest/add',
      id: 'p1',
      guests: [{ id: 'g', name: 'A', group: '', partySize: 1, rsvp: 'yes' }],
    });
    state = plansReducer(state, { type: 'milestone/toggle', id: 'p1', milestoneId: 'venue' });
    state = plansReducer(state, {
      type: 'chat/append',
      id: 'p1',
      entry: { id: 'c', role: 'user', content: 'hi' },
    });
    state = plansReducer(state, {
      type: 'plan/replace',
      id: 'p1',
      plan,
      at: '2026-10-21T00:00:00Z',
    });
    const saved = get(state);
    expect(saved.progress.guests).toHaveLength(1);
    expect(saved.progress.chat).toHaveLength(1);
    expect(saved.progress.milestonesDone).toEqual({});
    expect(saved.updatedAt).toBe('2026-10-21T00:00:00Z');
  });

  it('caps chat history and clears it', () => {
    let state = seed();
    for (let i = 0; i < 45; i++)
      state = plansReducer(state, {
        type: 'chat/append',
        id: 'p1',
        entry: { id: `${i}`, role: i % 2 ? 'assistant' : 'user', content: `m${i}` },
      });
    expect(get(state).progress.chat).toHaveLength(40);
    expect(chatHistory(get(state), 3).map((m) => m.content)).toEqual(['m42', 'm43', 'm44']);
    state = plansReducer(state, { type: 'chat/clear', id: 'p1' });
    expect(get(state).progress.chat).toHaveLength(0);
  });

  it('removes plans and ignores unknown ids', () => {
    expect(plansReducer(seed(), { type: 'plan/remove', id: 'p1' })).toEqual([]);
    expect(
      plansReducer(seed(), { type: 'milestone/toggle', id: 'nope', milestoneId: 'x' }),
    ).toEqual(seed());
  });
});

describe('selectors', () => {
  it('summarises budget with overrides, spending and over-allocation', () => {
    let state = plansReducer(seed(), {
      type: 'budget/allocate',
      id: 'p1',
      category: 'decor',
      amount: 900_000,
    });
    state = plansReducer(state, {
      type: 'budget/spend',
      id: 'p1',
      category: 'venue',
      amount: 10_000_000,
    });
    const summary = budgetSummary(get(state));
    expect(summary.unallocated).toBeLessThan(0);
    expect(summary.overspentCategories).toEqual(['venue']);
    expect(summary.spent).toBe(10_000_000);
  });

  it('marks overdue tasks and lists upcoming ones in date order', () => {
    const items = timelineItems(get(seed()), '2026-11-15');
    expect(items.find((m) => m.id === 'venue')?.overdue).toBe(true);
    const next = upcoming(get(seed()), TODAY, 2);
    expect(next).toHaveLength(2);
    expect(next[0]!.dueDate <= next[1]!.dueDate).toBe(true);
  });

  it('produces an assistant context that passes server validation', () => {
    const context = planContext(get(seed()), TODAY);
    expect(planContextSchema.safeParse(context).success).toBe(true);
    expect(context.upcoming.length).toBeLessThanOrEqual(5);
  });
});

describe('storage', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  };

  it('round-trips plans', () => {
    const store = memory();
    expect(savePlans(seed(), store)).toBe(true);
    expect(loadPlans(store)).toEqual(seed());
  });

  it('ignores corrupt or foreign data', () => {
    const store = memory();
    store.setItem(STORAGE_KEY, '{not json');
    expect(loadPlans(store)).toEqual([]);
    store.setItem(STORAGE_KEY, JSON.stringify([{ id: 1 }, null, ...seed()]));
    expect(loadPlans(store)).toHaveLength(1);
    store.setItem(STORAGE_KEY, JSON.stringify({ a: 1 }));
    expect(loadPlans(store)).toEqual([]);
    expect(loadPlans(undefined)).toEqual([]);
  });

  it('reports failure when storage throws', () => {
    expect(
      savePlans(seed(), {
        setItem: () => {
          throw new Error('quota');
        },
      }),
    ).toBe(false);
  });
});

describe('routing', () => {
  it('parses and builds hash routes', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/plan/abc/budget')).toEqual({ name: 'plan', id: 'abc', tab: 'budget' });
    expect(parseRoute('#/plan/abc')).toEqual({ name: 'plan', id: 'abc', tab: undefined });
    expect(routeHref({ name: 'plan', id: 'a b', tab: 'ideas' })).toBe('#/plan/a%20b/ideas');
    expect(routeHref({ name: 'home' })).toBe('#/');
  });
});
