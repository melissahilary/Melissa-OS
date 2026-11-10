import * as store from './dataStore'
import { normActivity } from './activities'
import { SITTINGS } from './meals'

// ── The nourishment, as it is actually kept.
//
// Every meal, drink and supplement below is transcribed from the health &
// wellness calendar, where the whole week was written out hour by hour. The
// planner is the record now: it holds the same week, at the same hours, in the
// slots the sittings already use, so nothing has to be kept in two places and
// then kept in step.
//
// It runs once. The flag below is written when it has, and anything already
// filed as food or a supplement is archived rather than deleted first, so the
// old entries are recoverable if this ever turns out to be the wrong week.

export const SEED_FLAG = 'mos:seed:nutrition-2026-09'

// Sun = 0. The calendar's own days.
const EVERY = [0, 1, 2, 3, 4, 5, 6]

// The hours the calendar keeps, which are not the hours the app shipped with.
export const SEED_HOURS = {
  empty: '05:00',
  breakfast: '07:00',
  snackam: '10:00',
  lunch: '11:30',
  snackpm: '14:00',
  dinner: '16:00',
}

// [ slot, kind, title, days ]
const ROWS = [
  // Empty stomach, 5:00
  ['emptydrink', 'food', 'water 1½ cups', EVERY],

  // Breakfast, 7:00 — the plate alternates, the glass does not.
  ['breakfast', 'food', 'sardines, 1 egg, 2 tbsp cottage cheese, 1 slice whole-grain toast', [0, 2, 4]],
  ['breakfast', 'food', 'collagen smoothie — kale, oats, blueberries, strawberries, orange, carrot, 1 tsp flax, 3 walnut halves', [1, 6]],
  ['breakfast', 'food', 'collagen smoothie — spinach, kiwi, cucumber, celery, oats, 1 tsp chia, 4 almonds', [3, 5]],
  ['drink', 'food', 'water 1 cup', EVERY],
  ['drink', 'food', 'electrolyte water 2 cups', EVERY],
  ['drink', 'food', 'green tea 1¼ cup', EVERY],
  ['drink', 'food', 'acv chia water 1 cup', EVERY],

  // Mid-morning, 10:00
  ['snackam', 'food', 'pomegranate seeds ½ cup', EVERY],

  // Lunch, 11:30
  ['lunch', 'food', 'salmon, sweet potato, 2 tbsp avocado, 1 tbsp olive oil', [1, 3]],
  ['lunch', 'food', 'chicken, broccoli, bell peppers, 1 tbsp olive oil', [0, 2, 4]],
  ['lunch', 'food', 'kale, chicken, celery, Greek yogurt, cottage cheese, 1 tbsp olive oil', [5, 6]],
  ['lunchdrink', 'food', 'water 1 cup', EVERY],
  ['lunchdrink', 'food', 'electrolyte water 2 cups', EVERY],

  // Afternoon, 14:00
  ['snackpmdrink', 'food', 'bone broth 1 cup', EVERY],

  // Dinner, 16:00
  ['dinner', 'food', 'lentil soup', [1, 3, 5]],
  ['dinner', 'food', 'tuna tacos', [0, 2, 4]],
  ['dinner', 'food', 'shrimp salad', [6]],
  ['dinnerdrink', 'food', 'water 1 cup', EVERY],
]

// ── Added since.
//
// The week above was written in once and is not written again, so anything
// added to it afterwards comes with a flag of its own and is appended. Each
// one runs once, whatever else has already run.
const PATCHES = [
  {
    flag: 'mos:seed:carrot-juice',
    rows: [['drink', 'food', 'carrot juice ½ cup', [0, 2, 4]]],
  },
  {
    flag: 'mos:seed:brazil-nuts',
    rows: [['snackam', 'food', '2 brazil nuts', EVERY]],
  },
]

const uid = () => Math.random().toString(36).slice(2, 10)
const arr = (v) => (Array.isArray(v) ? v : [])

// Every day of the week, or only some of them — the app's own recurrence.
const recurrence = (days) =>
  days.length === 7
    ? { frequency: 'daily', daysOfWeek: [] }
    : { frequency: 'weekly', daysOfWeek: days }

const build = (rows, startKey) =>
  rows.map(([slot, kind, title, days], i) =>
    normActivity({
      id: `seed-${uid()}`,
      type: kind === 'supp' ? 'supplement' : 'meal_item',
      title,
      category: 'nutrition',
      status: 'active',
      seriesStart: startKey,
      order: i,
      ...recurrence(days),
      details: kind === 'supp'
        ? { slot, dose: '', unit: 'mg' }
        : { slot, beverage: /drink/.test(slot) },
    }),
  )

export const buildNutrition = (startKey) => build(ROWS, startKey)

// ── The one rule.
//
// Her planner does not change unless she changes it. Opening the app is not
// changing it. So this writes in exactly one situation — a planner that has
// never been written to at all — and even then it writes only where there is
// nothing, through `fill`, which refuses to land on anything that exists.
//
// It used to run on every load and decide for itself what was missing. That is
// how a week of meals came to be written over a year of her habits: the rows
// had failed to arrive, the app read the silence as an empty account, and the
// starter week went in on top. The guard against that is not a better test for
// emptiness. It is never writing over her at all.
//
// A planner she has emptied herself is not a planner that was never written:
// `has` asks whether the row exists, not whether it holds anything.
export function runNutritionSeed(todayKey) {
  // Ready is not the same as read. If the rows never came back, the cache is
  // empty for want of an answer rather than for want of a planner.
  if (store.getStatus().phase !== 'ready' || !store.isLoaded()) return false

  // Anything already here is hers, including an empty list she made empty.
  if (store.has('mos:activities')) return false

  let did = false
  did = store.fill('mos:activities', buildNutrition(todayKey)) || did

  // The hours a new week starts with. Never the hours she has set.
  const standing = {}
  SITTINGS.forEach((s) => { if (SEED_HOURS[s.id]) standing[s.id] = SEED_HOURS[s.id] })
  did = store.fill('mos:sittings', { standing, days: {} }) || did

  // The flags that said "this has run". A planner it has never run on carries
  // every one of them from the start, so nothing is ever appended later to a
  // planner she has been keeping.
  did = store.fill(SEED_FLAG, true) || did
  PATCHES.forEach((patch) => { did = store.fill(patch.flag, true) || did })

  return did
}

export default runNutritionSeed
