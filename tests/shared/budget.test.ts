import { describe, expect, it } from 'vitest';
import { BUDGET_CATEGORIES, EVENT_TYPES, STYLES } from '../../shared/constants.js';
import {
  allocate,
  BASE_WEIGHTS,
  budgetHealth,
  buildBudget,
  computeWeights,
} from '../../shared/engine/budget.js';
import { cityTier, typicalPlateCost } from '../../shared/engine/costs.js';
import { makeInput } from '../fixtures.js';

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe('BASE_WEIGHTS', () => {
  it.each(EVENT_TYPES)('%s sums to 100%%', (type) => {
    expect(sum(Object.values(BASE_WEIGHTS[type]))).toBe(100);
  });
});

describe('computeWeights', () => {
  it.each(STYLES)('always sums to 100 for style %s', (style) => {
    const weights = computeWeights(makeInput({ style, priorities: ['decor', 'catering'] }));
    expect(sum(Object.values(weights))).toBeCloseTo(100, 8);
  });

  it('boosts prioritised categories', () => {
    const plain = computeWeights(makeInput());
    const boosted = computeWeights(makeInput({ priorities: ['photography'] }));
    expect(boosted.photography).toBeGreaterThan(plain.photography);
    expect(boosted.venue).toBeLessThan(plain.venue);
  });

  it('clamps AI emphasis to the allowed range', () => {
    const extreme = computeWeights(makeInput(), { emphasis: { decor: 50 } });
    const capped = computeWeights(makeInput(), { emphasis: { decor: 1.4 } });
    expect(extreme.decor).toBeCloseTo(capped.decor, 8);
  });

  it('ignores non-finite emphasis values', () => {
    const plain = computeWeights(makeInput());
    const weird = computeWeights(makeInput(), { emphasis: { decor: Number.NaN } });
    expect(weird.decor).toBeCloseTo(plain.decor, 8);
  });

  it('keeps contingency within 5–10%', () => {
    for (const eventType of EVENT_TYPES) {
      const { contingency } = computeWeights(makeInput({ eventType }));
      expect(contingency).toBeGreaterThanOrEqual(5);
      expect(contingency).toBeLessThanOrEqual(10);
    }
  });
});

describe('allocate', () => {
  it.each([5_000, 12_345, 99_999, 1_500_000, 73_456_789])(
    'splits ₹%i so the amounts add up exactly',
    (total) => {
      const amounts = allocate(total, computeWeights(makeInput({ budget: total })));
      expect(sum(Object.values(amounts))).toBe(total);
      for (const category of BUDGET_CATEGORIES) expect(amounts[category]).toBeGreaterThanOrEqual(0);
    },
  );

  it('gives nothing to zero-weight categories', () => {
    const input = makeInput({ eventType: 'community' });
    const amounts = allocate(input.budget, computeWeights(input));
    expect(amounts.attire).toBe(0);
  });
});

describe('buildBudget', () => {
  it('returns lines whose amounts sum to the total and percents to ~100', () => {
    const budget = buildBudget(makeInput());
    expect(sum(budget.lines.map((l) => l.amount))).toBe(1_500_000);
    expect(sum(budget.lines.map((l) => l.percent))).toBeCloseTo(100, 0);
    expect(budget.perGuest).toBe(6000);
  });

  it('omits unfunded categories', () => {
    const budget = buildBudget(makeInput({ eventType: 'community' }));
    expect(budget.lines.find((l) => l.category === 'attire')).toBeUndefined();
  });

  it('flags a tight catering budget with an actionable warning', () => {
    const budget = buildBudget(makeInput({ budget: 100_000, guests: 400, city: 'Mumbai' }));
    expect(budget.health).toBe('tight');
    expect(budget.warnings.join(' ')).toMatch(/per plate/);
  });

  it('warns when the per-guest budget is extremely lean', () => {
    const budget = buildBudget(makeInput({ budget: 10_000, guests: 100 }));
    expect(budget.warnings.join(' ')).toMatch(/very lean/);
  });

  it('describes per-plate cost on the catering line', () => {
    const catering = buildBudget(makeInput()).lines.find((l) => l.category === 'catering');
    expect(catering?.note).toMatch(/per plate for 250 guests/);
  });
});

describe('budgetHealth', () => {
  it('classifies by ratio of allocation to typical cost', () => {
    expect(budgetHealth(1300, 1000)).toBe('comfortable');
    expect(budgetHealth(950, 1000)).toBe('balanced');
    expect(budgetHealth(500, 1000)).toBe('tight');
    expect(budgetHealth(10, 0)).toBe('comfortable');
  });
});

describe('cost model', () => {
  it('recognises tier-1 cities case-insensitively', () => {
    expect(cityTier('  MUMBAI ')).toBe(1);
    expect(cityTier('New Delhi')).toBe(1);
    expect(cityTier('Indore')).toBe(2);
  });

  it('prices non-veg, luxury and metro plates higher', () => {
    const base = typicalPlateCost('birthday', 'Indore', 'traditional', 'vegetarian');
    expect(typicalPlateCost('birthday', 'Mumbai', 'traditional', 'vegetarian')).toBeGreaterThan(
      base,
    );
    expect(typicalPlateCost('birthday', 'Indore', 'luxury', 'vegetarian')).toBeGreaterThan(base);
    expect(typicalPlateCost('birthday', 'Indore', 'traditional', 'non-vegetarian')).toBeGreaterThan(
      base,
    );
  });
});
