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

const uid = () => Math.random().toString(36).slice(2, 10)
const arr = (v) => (Array.isArray(v) ? v : [])

// Every day of the week, or only some of them — the app's own recurrence.
const recurrence = (days) =>
  days.length === 7
    ? { frequency: 'daily', daysOfWeek: [] }
    : { frequency: 'weekly', daysOfWeek: days }

export function buildNutrition(startKey) {
  return ROWS.map(([slot, kind, title, days], i) =>
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
}

// Runs once, and only with the store loaded — seeding an empty cache would
// write the week in twice the moment the real rows arrived.
export function runNutritionSeed(todayKey) {
  if (store.getStatus().phase !== 'ready') return false
  if (store.get(SEED_FLAG, false)) return false

  const current = arr(store.get('mos:activities', []))
  const kept = current.map((a) => (
    a && (a.type === 'meal_item' || a.type === 'supplement') && a.status !== 'archived'
      ? { ...a, status: 'archived' }
      : a
  ))
  store.set('mos:activities', [...kept, ...buildNutrition(todayKey)])

  // The sittings keep the calendar's hours from now on.
  const clock = store.get('mos:sittings', { standing: {}, days: {} })
  const base = clock && typeof clock === 'object' ? clock : {}
  const standing = { ...(base.standing || {}) }
  SITTINGS.forEach((s) => { if (SEED_HOURS[s.id]) standing[s.id] = SEED_HOURS[s.id] })
  store.set('mos:sittings', { ...base, standing })

  store.set(SEED_FLAG, true)
  return true
}

export default runNutritionSeed
