import type { BudgetCategory, Diet, EventType } from '../constants.js';
import { addDays } from '../date.js';
import type { BudgetLine, Milestone, VendorTask } from '../types.js';

interface VendorTemplate {
  id: string;
  vendor: string;
  category: BudgetCategory;
  checks: string[];
  only?: EventType[];
}

// prettier-ignore
const VENDORS: VendorTemplate[] = [
  { id: 'venue', vendor: 'Venue', category: 'venue', checks: ['Capacity for your guest count (seated and standing)', 'Parking, power backup and restroom count', 'Step-free access for elderly and wheelchair users', 'Music curfew, outside-caterer and decor rules', 'Cancellation and date-change policy in writing'] },
  { id: 'caterer', vendor: 'Caterer', category: 'catering', checks: ['Tasting session before booking', 'Per-plate price, minimum guarantee and extra-plate rate', 'Separate counters/labelling for dietary needs', 'Service staff count and uniform', 'Leftover food donation arrangement'] },
  { id: 'baker', vendor: 'Cake & desserts', category: 'catering', only: ['birthday', 'anniversary', 'baby-shower', 'engagement'], checks: ['Flavour, size (kg) and eggless option', 'Delivery time and cold storage at venue', 'Message and topper details'] },
  { id: 'decorator', vendor: 'Decorator & florist', category: 'decor', checks: ['3D mock-up or reference photos', 'Fresh vs artificial flowers and their cost', 'Setup and teardown timings', 'Lighting and power requirements'] },
  { id: 'photographer', vendor: 'Photographer & videographer', category: 'photography', checks: ['Full past albums, not just highlights', 'Hours covered and number of shooters', 'Edited delivery timeline and format', 'Raw footage ownership'] },
  { id: 'entertainment', vendor: 'DJ / band / performers', category: 'entertainment', checks: ['Sound equipment included and power needs', 'Playlist or set list approval', 'Overtime charges', 'Venue sound-limit compliance'] },
  { id: 'mehendi', vendor: 'Mehendi artist', category: 'entertainment', only: ['wedding', 'engagement', 'festival'], checks: ['Natural henna (no chemical/black mehendi)', 'Number of artists vs guests', 'Per-hand pricing for guests'] },
  { id: 'makeup', vendor: 'Makeup & hair artist', category: 'attire', only: ['wedding', 'engagement', 'anniversary'], checks: ['Trial session', 'Products used and skin sensitivities', 'Arrival time and travel charges'] },
  { id: 'priest', vendor: 'Priest / officiant', category: 'logistics', only: ['wedding', 'engagement', 'festival', 'baby-shower'], checks: ['Muhurat timings', 'Samagri list — who arranges it', 'Language and duration of rituals'] },
  { id: 'tailor', vendor: 'Designer / tailor', category: 'attire', only: ['wedding', 'engagement'], checks: ['Fitting schedule', 'Delivery at least two weeks before', 'Alteration policy'] },
  { id: 'invitations', vendor: 'Invitation designer / printer', category: 'invitations', checks: ['Digital proof approval', 'Print quantity with 10% spare', 'E-invite with map link and RSVP'] },
  { id: 'gifts', vendor: 'Return gifts supplier', category: 'favors', checks: ['Sample before bulk order', 'Packaging and name tags', 'Delivery date with buffer'] },
  { id: 'transport', vendor: 'Transport & stay', category: 'logistics', only: ['wedding', 'engagement', 'community'], checks: ['Vehicle count and routes', 'Room block and check-in times', 'Driver contacts shared with coordinator'] },
  { id: 'rentals', vendor: 'Tent, sound & rentals', category: 'logistics', only: ['festival', 'community'], checks: ['Permissions for pandal/loudspeaker', 'Fire extinguishers and first-aid kit', 'Generator backup'] },
];

const DIET_CHECK: Partial<Record<Diet, string>> = {
  jain: 'Jain menu prepared without onion, garlic or root vegetables, cooked separately',
  vegan: 'Vegan dishes free of ghee, paneer, curd and honey',
  mixed: 'Separate veg and non-veg kitchens, counters and serving staff',
};

export function buildVendors(
  eventType: EventType,
  diet: Diet,
  eventDate: string,
  daysUntil: number,
  lines: BudgetLine[],
  timeline: Milestone[],
): VendorTask[] {
  const funded = new Set(lines.filter((l) => l.amount > 0).map((l) => l.category));
  const fallbackDue = addDays(eventDate, -Math.min(14, Math.max(0, daysUntil)));

  return VENDORS.filter(
    (v) => funded.has(v.category) && (!v.only || v.only.includes(eventType)),
  ).map((v) => {
    const booking = timeline
      .filter((m) => m.category === v.category && m.daysBefore > 0)
      .sort((a, b) => b.daysBefore - a.daysBefore)[0];
    const dietCheck = v.id === 'caterer' ? DIET_CHECK[diet] : undefined;
    return {
      id: v.id,
      vendor: v.vendor,
      category: v.category,
      dueDate: booking?.dueDate ?? fallbackDue,
      checks: dietCheck ? [dietCheck, ...v.checks] : [...v.checks],
    };
  });
}
