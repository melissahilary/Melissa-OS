// Unified meal-item model shared by My Dream Day and Meal Planning.
//
// THREE ITEM TYPES across the app:
//   EVENT      — something you do (lives in mos:today:events, shows as a calendar
//                checkbox + in Morning/Afternoon/Evening columns).
//   MEAL ITEM  — something you eat/drink (lives here in mos:meals, shows ONLY in
//                meal slots; never as a calendar checkbox).
//   PROTOCOL   — a recurring practice (Protocols page) that, on "Add to calendar",
//                routes to either an EVENT or a MEAL ITEM.

import { parseKey } from './date'

// Canonical meal slots, in daily order. `part` drives which Dream Day column the
// slot appears under; `supps` marks slots that also carry a supplements list.
export const MEAL_SLOTS = [
  { id: 'empty', label: 'Empty Stomach', part: 'morning', supps: true },
  { id: 'breakfast', label: 'Breakfast', part: 'morning', supps: true },
  { id: 'drink', label: 'Drink', part: 'morning', supps: false },
  { id: 'snack', label: 'Snack', part: 'afternoon', supps: false },
  { id: 'lunch', label: 'Lunch', part: 'afternoon', supps: true },
  { id: 'snack2', label: 'Snack', part: 'afternoon', supps: false },
  { id: 'dinner', label: 'Dinner', part: 'evening', supps: true },
  { id: 'bed', label: 'Before Bed', part: 'evening', supps: true },
]

export const slotsForPart = (partId) => MEAL_SLOTS.filter((s) => s.part === partId)
export const slotMeta = (id) => MEAL_SLOTS.find((s) => s.id === id) || { id, label: id, part: 'morning', supps: false }
export const timeOfDayForSlot = (id) => slotMeta(id).part

// Frequency options for meal items. Days[] (JS getDay indices) drive the actual
// recurrence for everything except Daily.
export const MEAL_FREQ_OPTS = [
  { id: 'daily', label: 'Daily' },
  { id: '2x', label: '2x Week' },
  { id: '3x', label: '3x Week' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'specific', label: 'Specific days' },
]

export const WEEKDAYS = [
  { d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' }, { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' },
]

const uid = () => Math.random().toString(36).slice(2, 10)

export const normMeal = (m) => ({
  id: m.id || uid(),
  name: m.name || '',
  kind: m.kind === 'supp' ? 'supp' : 'food',
  slot: m.slot || 'breakfast',
  frequency: m.frequency || 'daily',
  days: Array.isArray(m.days) ? m.days : [],
  startDate: m.startDate || '',
  notes: m.notes || '',
})

export const blankMeal = (slot = 'breakfast', kind = 'food') => ({
  id: uid(), name: '', kind, slot, frequency: 'daily', days: [], startDate: '', notes: '',
})

// Does a meal item land on the given date key?
export const mealOccursOn = (item, key) => {
  if (item.startDate && key < item.startDate) return false
  if (item.frequency === 'daily') return true
  const days = Array.isArray(item.days) ? item.days : []
  if (days.length) return days.includes(parseKey(key).getDay())
  // Weekly with no specific day chosen → same weekday as its start.
  if (item.startDate) return parseKey(key).getDay() === parseKey(item.startDate).getDay()
  return true
}

// One-time migration of the old per-day mos:menu:weekplan into mos:meals.
// Collapses duplicates by (slot, kind, name); maps the old two snacks → snack.
export function migrateWeekPlan(weekPlan) {
  if (!weekPlan || typeof weekPlan !== 'object') return []
  const SLOT_MAP = { empty: 'empty', breakfast: 'breakfast', snack1: 'snack', snack2: 'snack', lunch: 'lunch', dinner: 'dinner', bed: 'bed' }
  const seen = new Map()
  Object.values(weekPlan).forEach((day) => {
    if (!day) return
    Object.entries(day).forEach(([slotId, slot]) => {
      const target = SLOT_MAP[slotId] || slotId
      ;['foods', 'supps'].forEach((listKey) => {
        const kind = listKey === 'supps' ? 'supp' : 'food'
        ;(slot[listKey] || []).forEach((it) => {
          const name = (it.name || '').trim()
          if (!name) return
          const key = `${target}|${kind}|${name.toLowerCase()}`
          if (seen.has(key)) return
          const days = Array.isArray(it.days) ? it.days : []
          seen.set(key, normMeal({ name, kind, slot: target, frequency: it.freq === 'daily' || !days.length ? 'daily' : 'specific', days, notes: '' }))
        })
      })
    })
  })
  return [...seen.values()]
}
