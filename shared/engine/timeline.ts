import type { EventType, TaskCategory } from '../constants.js';
import { addDays } from '../date.js';
import { slugify } from '../text.js';
import type { Milestone } from '../types.js';

export interface MilestoneTemplate {
  key: string;
  title: string;
  detail: string;
  daysBefore: number;
  category: TaskCategory;
}

const t = (
  key: string,
  daysBefore: number,
  category: TaskCategory,
  title: string,
  detail: string,
): MilestoneTemplate => ({ key, daysBefore, category, title, detail });

const WRAP_UP = t(
  'wrap-up',
  -3,
  'planning',
  'Settle dues & send thank-yous',
  'Clear final vendor payments, return rentals and thank guests and helpers.',
);

// prettier-ignore
export const TIMELINE_TEMPLATES: Record<EventType, MilestoneTemplate[]> = {
  wedding: [
    t('budget', 180, 'planning', 'Lock budget & draft guest list', 'Agree the total with both families and split it by side if needed.'),
    t('muhurat', 175, 'planning', 'Fix dates & muhurat', 'Confirm auspicious dates with the family priest before booking anything.'),
    t('venue', 170, 'venue', 'Book the venue', 'Visit at least three venues; check capacity, parking, power backup and curfew.'),
    t('photo', 160, 'photography', 'Book photographer & videographer', 'Review full wedding albums, not highlight reels; agree delivery dates in writing.'),
    t('catering', 150, 'catering', 'Taste-test and book caterer', 'Schedule a tasting; confirm per-plate price, counters and service staff.'),
    t('decor', 120, 'decor', 'Book decorator & finalise theme', 'Share the colour palette and get a 3D mock-up of the mandap and stage.'),
    t('entertainment', 100, 'entertainment', 'Book DJ, band & mehendi artist', 'Confirm sound limits at the venue and the sangeet run-of-show.'),
    t('attire', 90, 'attire', 'Shop outfits & jewellery', 'Leave 6+ weeks for tailoring and alterations.'),
    t('invite-design', 75, 'invitations', 'Design invitations & e-invites', 'Collect addresses and phone numbers while the design is in progress.'),
    t('invite-send', 60, 'invitations', 'Send invitations', 'Send e-invites with a map pin; post printed cards to elders.'),
    t('travel', 45, 'logistics', 'Arrange guest travel & rooms', 'Block hotel rooms and plan airport/station pickups.'),
    t('fittings', 30, 'attire', 'Final outfit fittings', 'Do a full trial with footwear and jewellery.'),
    t('headcount', 21, 'catering', 'Confirm menu & headcount', 'Chase RSVPs and give the caterer a final count with a 5% buffer.'),
    t('run-of-show', 14, 'planning', 'Share run-of-show with vendors', 'One timeline document with every vendor contact and arrival time.'),
    t('payments', 7, 'planning', 'Schedule final payments', 'Prepare payment envelopes/UPI list and name one person to handle them.'),
    t('kit', 3, 'logistics', 'Pack emergency kit & brief coordinators', 'Safety pins, medicines, chargers, snacks; brief one coordinator per side.'),
    t('setup', 1, 'decor', 'Decor setup & sound check', 'Walk the venue with the decorator and DJ the day before.'),
    t('event', 0, 'planning', 'Celebrate!', 'Hand the phone to your coordinator and enjoy the day.'),
    WRAP_UP,
  ],
  engagement: [
    t('budget', 60, 'planning', 'Agree budget & guest list', 'Decide who hosts and whether it is a ring ceremony, roka or both.'),
    t('venue', 50, 'venue', 'Book venue', 'Banquet hall, home or restaurant — check capacity and timings.'),
    t('catering', 42, 'catering', 'Book caterer', 'A tasting is worth it even for a small menu.'),
    t('photo', 40, 'photography', 'Book photographer', 'Candid coverage of the ring exchange matters most.'),
    t('attire', 35, 'attire', 'Buy outfits & rings', 'Get ring sizes right; allow time for resizing.'),
    t('decor', 28, 'decor', 'Finalise decor', 'Stage backdrop, entrance and photo corner.'),
    t('invite-send', 21, 'invitations', 'Send invitations', 'E-invites with RSVP link and map.'),
    t('headcount', 7, 'catering', 'Confirm headcount', 'Final numbers to caterer and venue.'),
    t('setup', 1, 'decor', 'Setup & rehearsal', 'Run through the ring ceremony order with the families.'),
    t('event', 0, 'planning', 'Celebrate!', 'Enjoy the moment.'),
    WRAP_UP,
  ],
  birthday: [
    t('budget', 30, 'planning', 'Set budget, theme & guest list', 'Pick a theme the guest of honour will love.'),
    t('venue', 25, 'venue', 'Book venue or prepare home', 'Party hall, café, play area or home terrace.'),
    t('entertainment', 21, 'entertainment', 'Book entertainer or activities', 'Magician, games host, DJ or karaoke depending on age.'),
    t('invite-send', 18, 'invitations', 'Send invitations', 'E-invites with RSVP date; mention allergies question.'),
    t('catering', 14, 'catering', 'Order food & cake', 'Confirm flavours, eggless options and delivery time.'),
    t('decor', 10, 'decor', 'Buy or book decorations', 'Balloons, backdrop, table setup and lighting.'),
    t('favors', 7, 'favors', 'Prepare return gifts', 'Pack and label them in advance.'),
    t('headcount', 3, 'catering', 'Confirm headcount', 'Update food and cake quantities.'),
    t('setup', 1, 'decor', 'Decorate & prep', 'Charge speakers, set up the photo corner.'),
    t('event', 0, 'planning', 'Party time!', 'Cut the cake and enjoy.'),
    WRAP_UP,
  ],
  anniversary: [
    t('budget', 40, 'planning', 'Plan format & guest list', 'Intimate dinner, family gathering or full celebration?'),
    t('venue', 30, 'venue', 'Book venue', 'Restaurant private room, banquet hall or home.'),
    t('photo', 25, 'photography', 'Book photographer', 'Plan a short couple shoot and a family portrait.'),
    t('entertainment', 21, 'entertainment', 'Plan entertainment & tributes', 'Collect messages, photos or a video montage from family.'),
    t('invite-send', 18, 'invitations', 'Send invitations', 'Keep it a surprise? Coordinate with one family member.'),
    t('catering', 14, 'catering', 'Finalise menu', 'Include the couple’s favourite dishes from their wedding.'),
    t('decor', 7, 'decor', 'Decor & flowers', 'Recreate the wedding colours.'),
    t('headcount', 3, 'catering', 'Confirm headcount', 'Final numbers to venue.'),
    t('event', 0, 'planning', 'Celebrate!', 'Raise a toast.'),
    WRAP_UP,
  ],
  'baby-shower': [
    t('budget', 30, 'planning', 'Set budget & guest list', 'Check what suits the parents-to-be, including timing and comfort.'),
    t('venue', 25, 'venue', 'Book venue or prepare home', 'Ground-floor, comfortable seating, easy restroom access.'),
    t('invite-send', 21, 'invitations', 'Send invitations', 'Mention gift registry or “no gifts” preference.'),
    t('entertainment', 18, 'entertainment', 'Plan games & rituals', 'Godh bharai rituals, games and a wishes jar.'),
    t('catering', 14, 'catering', 'Order food', 'Light, fresh menu; confirm dietary needs of the mother-to-be.'),
    t('decor', 10, 'decor', 'Decor & photo corner', 'Soft palette, floral swing or cradle backdrop.'),
    t('favors', 7, 'favors', 'Prepare return gifts', 'Plantable seed cards, sweets or mini candles.'),
    t('headcount', 3, 'catering', 'Confirm headcount', 'Update food order.'),
    t('event', 0, 'planning', 'Celebrate!', 'Keep the mother-to-be comfortable and rested.'),
    WRAP_UP,
  ],
  festival: [
    t('budget', 45, 'planning', 'Form committee & set budget', 'Assign owners for decor, food, cultural program and finance.'),
    t('permits', 40, 'logistics', 'Get permissions', 'Society/RWA approval, police permission for loudspeakers and pandal if public.'),
    t('venue', 35, 'venue', 'Book venue or pandal', 'Confirm power load, water and fire safety.'),
    t('entertainment', 30, 'entertainment', 'Plan cultural program', 'Book artists, dhol, garba/dandiya instructor or kids’ performances.'),
    t('decor', 21, 'decor', 'Order decor & puja items', 'Lights, rangoli colours, flowers and puja samagri.'),
    t('catering', 14, 'catering', 'Book caterer or bhog/prasad', 'Plan quantities per day if it is a multi-day festival.'),
    t('invite-send', 10, 'invitations', 'Announce & invite', 'WhatsApp posters, notice board and a schedule.'),
    t('volunteers', 5, 'planning', 'Brief volunteers', 'Shifts for welcome desk, food counter, safety and clean-up.'),
    t('setup', 1, 'decor', 'Setup & safety check', 'Check wiring, fire extinguishers and exits.'),
    t('event', 0, 'planning', 'Celebrate!', 'Shubh utsav!'),
    WRAP_UP,
  ],
  community: [
    t('budget', 45, 'planning', 'Define goal, budget & team', 'Is it a get-together, a fundraiser or a reunion? Assign owners.'),
    t('venue', 38, 'venue', 'Book venue', 'Clubhouse, school hall or park — confirm permissions and accessibility.'),
    t('sponsors', 32, 'planning', 'Reach out to sponsors', 'Local businesses can sponsor food, prizes or printing.'),
    t('entertainment', 28, 'entertainment', 'Plan program & activities', 'Games for all ages, talent show, guest speaker.'),
    t('invite-send', 21, 'invitations', 'Announce & open registrations', 'Simple RSVP form; share in community groups.'),
    t('catering', 14, 'catering', 'Book food', 'Potluck, food stalls or a caterer per headcount.'),
    t('logistics', 10, 'logistics', 'Arrange seating, sound & first aid', 'Rentals list with quantities.'),
    t('volunteers', 5, 'planning', 'Brief volunteers', 'Registration desk, crowd flow, clean-up crew.'),
    t('setup', 1, 'logistics', 'Setup & walk-through', 'Test mic, signage and wheelchair access.'),
    t('event', 0, 'planning', 'Event day', 'Take photos for your community newsletter.'),
    WRAP_UP,
  ],
};

export interface ExtraTask {
  title: string;
  category: TaskCategory;
  daysBefore: number;
}

export interface TimelineResult {
  milestones: Milestone[];
  compressed: boolean;
}

/**
 * Builds a dated timeline. When the event is closer than the template's horizon,
 * pre-event milestones are scaled proportionally into the time that is left,
 * preserving order, so nothing is ever due in the past.
 */
export function buildTimeline(
  eventType: EventType,
  eventDate: string,
  daysUntil: number,
  extras: ExtraTask[] = [],
): TimelineResult {
  const template = TIMELINE_TEMPLATES[eventType];
  const horizon = Math.max(...template.map((m) => m.daysBefore));
  const available = Math.max(0, daysUntil);
  const compressed = available < horizon;
  const scale = compressed ? available / horizon : 1;

  const fitted = (daysBefore: number) =>
    daysBefore > 0 ? Math.min(available, Math.round(daysBefore * scale)) : daysBefore;

  const seen = new Set(template.map((m) => m.title.toLowerCase()));
  const extraTemplates: MilestoneTemplate[] = [];
  for (const extra of extras) {
    const key = extra.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    extraTemplates.push({
      key: `ai-${extraTemplates.length + 1}-${slugify(extra.title)}`,
      title: extra.title,
      detail: 'Suggested for your event by the AI planner.',
      category: extra.category,
      daysBefore: Math.min(Math.max(0, Math.round(extra.daysBefore)), horizon),
    });
  }

  const milestones = [...template, ...extraTemplates]
    .map((m) => {
      const daysBefore = fitted(m.daysBefore);
      return {
        id: m.key,
        title: m.title,
        detail: m.detail,
        category: m.category,
        daysBefore,
        dueDate: addDays(eventDate, -daysBefore),
      } satisfies Milestone;
    })
    .sort((a, b) => b.daysBefore - a.daysBefore || a.id.localeCompare(b.id));

  return { milestones, compressed };
}
