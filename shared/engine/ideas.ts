import type { Diet, EventType, Style } from '../constants.js';
import type { Ideas } from '../types.js';

/**
 * Curated, offline idea library. It is used when no model is reachable and as
 * the seed the AI layer personalises, so every plan always has usable ideas.
 */

const PALETTES: Record<Style, string[]> = {
  traditional: ['#8A1C3B', '#F2A007', '#FFF4E0', '#1F5F3F'],
  modern: ['#1F2937', '#E8B4B8', '#F5F5F4', '#C08552'],
  minimal: ['#F7F3EE', '#D6CFC7', '#7D8471', '#2F2F2F'],
  luxury: ['#0B1D3A', '#C9A227', '#F8F1E4', '#7A1F3D'],
  eco: ['#3F6B4E', '#D9C9A3', '#F4EFE6', '#A86B3C'],
};

const STYLE_FEEL: Record<Style, string> = {
  traditional: 'heritage textures, brass, fresh marigolds and live folk music',
  modern: 'clean lines, warm lighting and an experience at every corner',
  minimal: 'a few meaningful details, soft light and room to talk',
  luxury: 'statement florals, layered lighting and white-glove service',
  eco: 'potted plants, reusable decor, local food and zero single-use plastic',
};

// prettier-ignore
const THEME_NAMES: Record<EventType, Record<Style, string>> = {
  wedding: { traditional: 'Marigold & Mogra Mandap', modern: 'Blush Garden Soirée', minimal: 'Intimate Courtyard Vows', luxury: 'Royal Rajwada Nights', eco: 'Banana Leaf & Bloom' },
  engagement: { traditional: 'Gulmohar Sagai', modern: 'Golden Hour Rings', minimal: 'Close-Knit Ring Ceremony', luxury: 'Champagne & Chandeliers', eco: 'Terrace Garden Promise' },
  birthday: { traditional: 'Rangoli Carnival', modern: 'Neon Pop Party', minimal: 'Brunch & Balloons', luxury: 'Starlit Gala', eco: 'Picnic Under the Neem' },
  anniversary: { traditional: 'Wedding Day Revisited', modern: 'Memory Lane Lounge', minimal: 'Candlelit Family Dinner', luxury: 'Golden Jubilee Gala', eco: 'Garden of Years' },
  'baby-shower': { traditional: 'Phoolon Wali Godh Bharai', modern: 'Little Star Shower', minimal: 'Pastel Morning Tea', luxury: 'Cloud Nine Celebration', eco: 'Seeds of Love' },
  festival: { traditional: 'Diyas & Marigolds', modern: 'Festival of Lights Lounge', minimal: 'Clay Lamp Evening', luxury: 'Grand Utsav Pavilion', eco: 'Green Festival, Zero Waste' },
  community: { traditional: 'Mohalla Mela', modern: 'Neighbourhood Block Party', minimal: 'Chai & Conversations', luxury: 'Community Gala Evening', eco: 'Swachh Green Fair' },
};

// prettier-ignore
const DECOR: Record<EventType, string[]> = {
  wedding: ['Marigold and mogra mandap with hanging brass bells', 'Floral entrance arch with welcome signage in both families’ names', 'Fairy-light canopy over the dining area', 'Photo corner with the couple’s journey timeline'],
  engagement: ['Ring-ceremony stage with a floral ring backdrop', 'Hand-lettered welcome board', 'Candle and flower table centrepieces', 'Polaroid guest-book wall'],
  birthday: ['Balloon garland in the theme colours', 'Personalised backdrop with name and age', 'Dessert table styled to the theme', 'Memory wall with photos from every year'],
  anniversary: ['Photo timeline of the couple through the years', 'Recreated wedding colours on the stage', 'Candle-lit long table', 'Message tree where guests hang wishes'],
  'baby-shower': ['Floral swing or cradle backdrop for the mother-to-be', 'Pastel balloon cloud', 'Wishes-for-baby jar with cards', 'Soft lighting and comfortable lounge seating'],
  festival: ['Rangoli at every entrance with eco colours', 'Diyas and string lights along pathways', 'Marigold torans on doors and stage', 'Lantern installation for the evening'],
  community: ['Welcome desk with name tags and a map', 'Bunting in community colours', 'Activity zones marked with signage', 'Photo booth with props'],
};

// prettier-ignore
const ACTIVITIES: Record<EventType, string[]> = {
  wedding: ['Sangeet night with family dance performances', 'Mehendi with a live dhol and folk singers', 'Haldi with a flower-shower moment', 'Couple’s story video before the varmala'],
  engagement: ['Ring exchange followed by a family toast', 'How-they-met quiz for guests', 'Short couple dance', 'Open dance floor with a DJ'],
  birthday: ['Theme-based games with small prizes', 'Cake-cutting with a birthday song medley', 'Craft or magic corner for kids', 'Video messages from friends who could not attend'],
  anniversary: ['Toasts from children and old friends', 'Vows renewal moment', 'Couple quiz: who knows them best', 'Slideshow of their journey'],
  'baby-shower': ['Godh bharai ritual with blessings', 'Guess the baby food / baby photo game', 'Advice cards for the parents-to-be', 'Lullaby sing-along'],
  festival: ['Aarti and cultural performances', 'Rangoli or diya-painting competition', 'Garba/dandiya or folk dance session', 'Kids’ fancy-dress parade'],
  community: ['Ice-breaker bingo for neighbours', 'Talent show or open mic', 'Sports or games for all ages', 'Recognition of volunteers and elders'],
};

const FAVORS: Record<Style, string[]> = {
  traditional: ['Mithai boxes with a thank-you card', 'Brass diyas', 'Bandhani or potli pouches'],
  modern: [
    'Personalised mugs or tote bags',
    'Gourmet cookie jars',
    'Instant photo prints from the photo booth',
  ],
  minimal: ['Handwritten thank-you notes', 'Small jars of homemade sweets', 'Single-stem flowers'],
  luxury: [
    'Dry-fruit boxes in keepsake packaging',
    'Silver-plated coins',
    'Scented candles in glass jars',
  ],
  eco: ['Plantable seed cards', 'Potted succulents', 'Jute bags with local snacks'],
};

function menuFor(eventType: EventType, diet: Diet): string[] {
  const starters: Record<Diet, string> = {
    vegetarian: 'Paneer tikka, hara bhara kebab and dahi ke sholay',
    'non-vegetarian': 'Chicken malai tikka, fish amritsari and paneer tikka',
    mixed: 'Paneer tikka and hara bhara kebab, plus chicken malai tikka on a separate counter',
    jain: 'Raw-banana tikki and Jain paneer tikka (no onion, garlic or root vegetables)',
    vegan: 'Tandoori soya chaap and mushroom tikka with mint chutney',
  };
  const mains: Record<Diet, string> = {
    vegetarian: 'Dal makhani, shahi paneer, veg dum biryani and assorted breads',
    'non-vegetarian': 'Butter chicken, mutton rogan josh, chicken dum biryani and dal makhani',
    mixed: 'Dal makhani, shahi paneer and veg biryani, plus butter chicken and mutton biryani',
    jain: 'Jain dal, Jain paneer butter masala, jeera rice and phulka',
    vegan: 'Dal tadka cooked in oil, chana masala, veg pulao and tandoori roti',
  };
  const dessert: Record<Diet, string> = {
    vegetarian: 'Gulab jamun, kesar rasmalai and kulfi',
    'non-vegetarian': 'Gulab jamun, kesar rasmalai and kulfi',
    mixed: 'Gulab jamun, kesar rasmalai and kulfi',
    jain: 'Moong dal halwa and kesar shrikhand',
    vegan: 'Coconut-milk kheer and seasonal fruit platter',
  };
  const menu = [
    diet === 'vegan'
      ? 'Welcome drinks: aam panna, nimbu shikanji and tender coconut water'
      : 'Welcome drinks: aam panna, nimbu shikanji and masala chaas',
    starters[diet],
    mains[diet],
    eventType === 'wedding' || eventType === 'festival' || eventType === 'community'
      ? 'Live chaat and dosa counters'
      : 'Live pasta or chaat counter',
    dessert[diet],
  ];
  if (eventType === 'birthday' || eventType === 'anniversary' || eventType === 'baby-shower') {
    menu.push(
      diet === 'vegan' ? 'Vegan celebration cake' : 'Theme celebration cake (eggless option)',
    );
  }
  return menu;
}

function tipsFor(eventType: EventType, style: Style): string[] {
  const tips = [
    'Book the venue and caterer first — they decide your date and headcount.',
    'Keep the contingency line untouched until the final week.',
    'Get every vendor quote, inclusion and cancellation term in writing.',
    'Name one coordinator who holds the run-of-show and vendor contacts on the day.',
  ];
  if (eventType === 'wedding')
    tips.push('Split payments 30/40/30 across booking, a week before, and after delivery.');
  if (eventType === 'festival' || eventType === 'community')
    tips.push('Apply for loudspeaker and public-space permissions early; they can take weeks.');
  if (style === 'eco')
    tips.push('Ask the caterer for steel cutlery and arrange food donation for leftovers.');
  return tips;
}

export function fallbackIdeas(eventType: EventType, style: Style, diet: Diet): Ideas {
  const name = THEME_NAMES[eventType][style];
  return {
    theme: {
      name,
      description: `A ${style === 'eco' ? 'sustainable' : style} celebration with ${STYLE_FEEL[style]}.`,
      palette: [...PALETTES[style]],
    },
    decor: [...DECOR[eventType]],
    menu: menuFor(eventType, diet),
    activities: [...ACTIVITIES[eventType]],
    favors: [...FAVORS[style]],
    tips: tipsFor(eventType, style),
  };
}
