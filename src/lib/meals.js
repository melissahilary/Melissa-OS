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
  { id: 'emptydrink', label: 'Drink', part: 'morning', supps: false },
  { id: 'breakfast', label: 'Breakfast', part: 'morning', supps: true },
  { id: 'drink', label: 'Drink', part: 'morning', supps: false },
  { id: 'snackam', label: 'Snack', part: 'morning', supps: true },
  { id: 'snackamdrink', label: 'Drink', part: 'morning', supps: false },
  { id: 'lunch', label: 'Lunch', part: 'afternoon', supps: true },
  { id: 'lunchdrink', label: 'Drink', part: 'afternoon', supps: false },
  { id: 'snackpm', label: 'Snack', part: 'afternoon', supps: true },
  { id: 'snackpmdrink', label: 'Drink', part: 'afternoon', supps: false },
  { id: 'dinner', label: 'Dinner', part: 'evening', supps: true },
  { id: 'dinnerdrink', label: 'Drink', part: 'evening', supps: false },
  { id: 'bed', label: 'Before Bed', part: 'evening', supps: true },
  { id: 'beddrink', label: 'Drink', part: 'evening', supps: false },
]

// ── The day's seven sittings.
//
// The nourishment strip reads across the day in order, and the ground darkens
// as it goes: paper at six in the morning, near-black at ten at night. Each
// sitting owns a food slot and a drink slot; supplements ride the food slot.
//
// The hour is stated the way a person says it — never a twenty-four hour
// readout, which belongs on a departures board.
export const SITTINGS = [
  { id: 'empty', label: 'Empty Stomach', at: '06:40', food: 'empty', drink: 'emptydrink', ground: '#FDFCFA', dark: false },
  { id: 'breakfast', label: 'Breakfast', at: '07:30', food: 'breakfast', drink: 'drink', ground: '#FAFAF7', dark: false },
  { id: 'snackam', label: 'Snack', at: '10:30', food: 'snackam', drink: 'snackamdrink', ground: '#F3EFE4', dark: false },
  { id: 'lunch', label: 'Lunch', at: '12:30', food: 'lunch', drink: 'lunchdrink', ground: '#EEEAE1', dark: false },
  { id: 'snackpm', label: 'Snack', at: '16:00', food: 'snackpm', drink: 'snackpmdrink', ground: '#C0966F', dark: false },
  { id: 'dinner', label: 'Dinner', at: '19:30', food: 'dinner', drink: 'dinnerdrink', ground: '#68472C', dark: true },
  { id: 'bed', label: 'Before Bed', at: '21:50', food: 'bed', drink: 'beddrink', ground: '#151310', dark: true },
]

// An hour, said rather than clocked: 6:40 AM, 12:30 PM, 9:50 PM.
export const spoken = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  if (!m) return ''
  const H = Number(m[1])
  return `${H % 12 || 12}:${m[2]} ${H < 12 ? 'AM' : 'PM'}`
}

// Tags a recipe can carry — used to tag items in the editor and filter the library.
export const RECIPE_TAGS = ['Supplement', 'Beverage', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Follicular', 'Ovulatory', 'Luteal', 'Menstrual']

export const slotsForPart = (partId) => MEAL_SLOTS.filter((s) => s.part === partId)
export const slotMeta = (id) => MEAL_SLOTS.find((s) => s.id === id) || { id, label: id, part: 'morning', supps: false }
export const timeOfDayForSlot = (id) => slotMeta(id).part

// Frequency options for meal items. Days[] (JS getDay indices) drive the actual
// recurrence for everything except Daily.
export const MEAL_FREQ_OPTS = [
  { id: 'once', label: 'Just once' },
  { id: 'daily', label: 'Daily' },
  { id: '2x', label: '2x Week' },
  { id: '3x', label: '3x Week' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
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
  // A one-off sits on the day it was put down and nowhere else — the way to
  // write "tonight" without writing it into every night after it.
  if (item.frequency === 'once') return !!item.startDate && key === item.startDate
  if (item.frequency === 'daily') return true
  if (item.frequency === 'monthly') return !!item.startDate && parseKey(key).getDate() === parseKey(item.startDate).getDate()
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
