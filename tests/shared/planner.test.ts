import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, STYLES, DIETS } from '../../shared/constants.js';
import { parseEnhancement, ENHANCEMENT_JSON_SCHEMA } from '../../shared/engine/enhancement.js';
import { fallbackIdeas } from '../../shared/engine/ideas.js';
import { buildPlan } from '../../shared/engine/planner.js';
import { makeInput, SAMPLE_ENHANCEMENT, TODAY } from '../fixtures.js';

describe('parseEnhancement', () => {
  it('accepts a well-formed model response', () => {
    const parsed = parseEnhancement(SAMPLE_ENHANCEMENT);
    expect(parsed?.theme.name).toBe('Haldi Gold');
    expect(parsed?.extraTasks).toHaveLength(1);
  });

  it('drops contingency and unknown keys from budget emphasis', () => {
    const parsed = parseEnhancement({
      ...SAMPLE_ENHANCEMENT,
      budgetEmphasis: { catering: 1.2, contingency: 3, hacking: 9 },
    });
    expect(parsed?.budgetEmphasis).toEqual({ catering: 1.2 });
  });

  it('strips links, markup and invalid colours from model output', () => {
    const parsed = parseEnhancement({
      ...SAMPLE_ENHANCEMENT,
      decor: ['<script>alert(1)</script>Lanterns', 'Visit https://evil.example now', 42, ''],
      theme: {
        ...SAMPLE_ENHANCEMENT.theme,
        palette: ['#F2A007', 'red', '#12345', '#8A1C3B', '#FFFFFF'],
      },
    });
    expect(parsed?.decor).toEqual(['scriptalert(1)/scriptLanterns', 'Visit now']);
    expect(parsed?.theme.palette).toEqual(['#F2A007', '#8A1C3B', '#FFFFFF']);
  });

  it('clips over-long strings and lists', () => {
    const parsed = parseEnhancement({
      ...SAMPLE_ENHANCEMENT,
      tips: Array.from({ length: 20 }, () => 'x'.repeat(500)),
    });
    expect(parsed?.tips).toHaveLength(6);
    expect(parsed?.tips[0]).toHaveLength(260);
  });

  it('keeps valid extra tasks and discards malformed ones', () => {
    const parsed = parseEnhancement({
      ...SAMPLE_ENHANCEMENT,
      extraTasks: [
        { title: 'Valid', category: 'decor', daysBefore: 10 },
        { title: 'Unknown category', category: 'spaceship', daysBefore: 5 },
        { title: 'Negative', category: 'decor', daysBefore: -4 },
        'nonsense',
      ],
    });
    expect(parsed?.extraTasks).toEqual([
      { title: 'Valid', category: 'decor', daysBefore: 10 },
      { title: 'Unknown category', category: 'planning', daysBefore: 5 },
    ]);
  });

  it.each([
    null,
    'text',
    {},
    { summary: 'only a summary' },
    { ...SAMPLE_ENHANCEMENT, decor: [], menu: [], activities: [] },
  ])('returns null for unusable output %#', (raw) => {
    expect(parseEnhancement(raw)).toBeNull();
  });

  it('publishes a JSON schema whose required keys exist in the parser output', () => {
    const parsed = parseEnhancement(SAMPLE_ENHANCEMENT)!;
    for (const key of ENHANCEMENT_JSON_SCHEMA.required) expect(parsed).toHaveProperty(key);
  });
});

describe('fallbackIdeas', () => {
  it.each(EVENT_TYPES.flatMap((e) => STYLES.map((s) => [e, s] as const)))(
    'has complete ideas for %s / %s',
    (eventType, style) => {
      const ideas = fallbackIdeas(eventType, style, 'vegetarian');
      expect(ideas.theme.name.length).toBeGreaterThan(0);
      expect(ideas.theme.palette.length).toBeGreaterThanOrEqual(3);
      expect(ideas.decor.length).toBeGreaterThanOrEqual(3);
      expect(ideas.activities.length).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(DIETS)('menu respects %s diet', (diet) => {
    const menu = fallbackIdeas('wedding', 'traditional', diet).menu.join(' ').toLowerCase();
    if (diet === 'vegetarian' || diet === 'jain' || diet === 'vegan') {
      expect(menu).not.toMatch(/chicken|mutton|fish/);
    }
    if (diet === 'vegan')
      expect(menu).not.toMatch(/paneer|ghee|rasmalai|chaas|dahi|kulfi|shrikhand/);
    if (diet === 'jain') expect(menu).not.toMatch(/onion pakora|garlic naan|aloo/);
  });
});

describe('buildPlan', () => {
  it('builds a complete offline plan', () => {
    const plan = buildPlan(makeInput(), { today: TODAY });
    expect(plan.source).toBe('offline');
    expect(plan.daysUntil).toBe(117);
    expect(plan.summary).toMatch(/250 guests in Pune/);
    expect(plan.timeline.length).toBeGreaterThan(10);
    expect(plan.vendors.length).toBeGreaterThan(5);
    expect(plan.compressed).toBe(true);
  });

  it('is deterministic for the same input and date', () => {
    expect(buildPlan(makeInput(), { today: TODAY })).toEqual(
      buildPlan(makeInput(), { today: TODAY }),
    );
  });

  it('layers AI ideas on top while keeping budget math exact', () => {
    const enhancement = parseEnhancement(SAMPLE_ENHANCEMENT)!;
    const plan = buildPlan(makeInput(), { today: TODAY, enhancement, source: 'gemini' });
    expect(plan.source).toBe('gemini');
    expect(plan.ideas.theme.name).toBe('Haldi Gold');
    expect(plan.summary).toBe(SAMPLE_ENHANCEMENT.summary);
    expect(plan.budget.lines.reduce((s, l) => s + l.amount, 0)).toBe(1_500_000);
    expect(plan.timeline.some((m) => m.title === 'Book nashik dhol pathak')).toBe(true);
    const offline = buildPlan(makeInput(), { today: TODAY });
    const cateringAi = plan.budget.lines.find((l) => l.category === 'catering')!.amount;
    const cateringOffline = offline.budget.lines.find((l) => l.category === 'catering')!.amount;
    expect(cateringAi).toBeGreaterThan(cateringOffline);
  });

  it('falls back to the library palette when the model gives too few colours', () => {
    const enhancement = parseEnhancement({
      ...SAMPLE_ENHANCEMENT,
      theme: { ...SAMPLE_ENHANCEMENT.theme, palette: ['#000000'] },
    })!;
    const plan = buildPlan(makeInput(), { today: TODAY, enhancement, source: 'groq' });
    expect(plan.ideas.theme.palette.length).toBeGreaterThanOrEqual(3);
  });

  it('warns about short lead times', () => {
    const plan = buildPlan(makeInput({ eventType: 'birthday', date: '2026-10-27' }), {
      today: TODAY,
    });
    expect(plan.budget.warnings.join(' ')).toMatch(/Only 7 days to go/);
  });

  it('summarises an event happening today', () => {
    const plan = buildPlan(makeInput({ date: TODAY }), { today: TODAY });
    expect(plan.summary).toMatch(/It is today/);
  });
});
