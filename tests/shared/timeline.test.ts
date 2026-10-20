import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '../../shared/constants.js';
import { daysBetween } from '../../shared/date.js';
import { buildTimeline, TIMELINE_TEMPLATES } from '../../shared/engine/timeline.js';
import { buildVendors } from '../../shared/engine/vendors.js';
import { buildBudget } from '../../shared/engine/budget.js';
import { makeInput, TODAY } from '../fixtures.js';

describe('buildTimeline', () => {
  it('uses template lead times when there is enough time', () => {
    const { milestones, compressed } = buildTimeline('wedding', '2027-06-01', 224);
    expect(compressed).toBe(false);
    const venue = milestones.find((m) => m.id === 'venue');
    expect(venue?.daysBefore).toBe(170);
    expect(venue?.dueDate).toBe('2026-12-13');
  });

  it('compresses into the remaining days and never schedules work in the past', () => {
    const eventDate = '2026-11-19';
    const daysUntil = daysBetween(TODAY, eventDate); // 30
    const { milestones, compressed } = buildTimeline('wedding', eventDate, daysUntil);
    expect(compressed).toBe(true);
    for (const m of milestones.filter((x) => x.daysBefore >= 0)) {
      expect(daysBetween(TODAY, m.dueDate)).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps milestones ordered from earliest to latest', () => {
    const { milestones } = buildTimeline('birthday', '2026-11-30', 41);
    const dates = milestones.map((m) => m.dueDate);
    expect([...dates].sort()).toEqual(dates);
  });

  it('puts everything on the day when the event is today', () => {
    const { milestones } = buildTimeline('birthday', TODAY, 0);
    expect(milestones.filter((m) => m.daysBefore > 0)).toHaveLength(0);
  });

  it('adds AI extra tasks, deduplicated and clamped to the horizon', () => {
    const { milestones } = buildTimeline('birthday', '2026-12-31', 72, [
      { title: 'Book a magician', category: 'entertainment', daysBefore: 999 },
      { title: 'book a magician', category: 'entertainment', daysBefore: 10 },
      { title: 'Celebrate!', category: 'planning', daysBefore: 0 },
      { title: 'Party time!', category: 'planning', daysBefore: 0 },
    ]);
    const extras = milestones.filter((m) => m.id.startsWith('ai-'));
    expect(extras).toHaveLength(2);
    expect(extras.find((m) => m.title === 'Book a magician')?.daysBefore).toBe(30);
  });

  it.each(EVENT_TYPES)('%s template has an event-day milestone', (type) => {
    expect(TIMELINE_TEMPLATES[type].some((m) => m.daysBefore === 0)).toBe(true);
  });
});

describe('buildVendors', () => {
  it('links vendor due dates to the matching booking milestone', () => {
    const input = makeInput();
    const daysUntil = daysBetween(TODAY, input.date);
    const { milestones } = buildTimeline(input.eventType, input.date, daysUntil);
    const vendors = buildVendors(
      input.eventType,
      input.diet,
      input.date,
      daysUntil,
      buildBudget(input).lines,
      milestones,
    );
    const venue = vendors.find((v) => v.id === 'venue');
    expect(venue?.dueDate).toBe(milestones.find((m) => m.id === 'venue')?.dueDate);
    expect(vendors.some((v) => v.id === 'mehendi')).toBe(true);
    expect(vendors.some((v) => v.id === 'baker')).toBe(false);
  });

  it('adds a diet-specific check for Jain menus', () => {
    const input = makeInput({ diet: 'jain' });
    const { milestones } = buildTimeline(input.eventType, input.date, 117);
    const caterer = buildVendors(
      input.eventType,
      'jain',
      input.date,
      117,
      buildBudget(input).lines,
      milestones,
    ).find((v) => v.id === 'caterer');
    expect(caterer?.checks[0]).toMatch(/Jain/);
  });

  it('skips vendors for unfunded categories', () => {
    const input = makeInput({ eventType: 'community' });
    const { milestones } = buildTimeline(input.eventType, input.date, 117);
    const vendors = buildVendors(
      input.eventType,
      input.diet,
      input.date,
      117,
      buildBudget(input).lines,
      milestones,
    );
    expect(vendors.every((v) => v.category !== 'attire')).toBe(true);
    expect(vendors.some((v) => v.id === 'rentals')).toBe(true);
  });
});
