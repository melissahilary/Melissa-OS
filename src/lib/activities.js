// ── Unified Activity model — one source of truth ────────────────────
// Every schedulable item in the app (event, meal item, supplement, protocol)
// is a single Activity stored once in mos:activities. Its `type` decides which
// fields apply and where it shows. Completion is per-day in `completions` so the
// same activity reflects the same state in Calendar and Dream Day.

import { parseKey, startOfWeek, dateKey } from './date'
import { MEAL_SLOTS } from './meals'

const uid = () => Math.random().toString(36).slice(2, 10)

export const ACTIVITY_TYPES = [
  { id: 'event', label: 'Event', blurb: 'Something you do' },
  { id: 'meal_item', label: 'Meal Item', blurb: 'Something you eat or drink' },
  { id: 'supplement', label: 'Supplement', blurb: 'A vitamin, peptide or compound' },
  { id: 'protocol', label: 'Protocol', blurb: 'A practice, treatment or routine' },
]

export const FREQUENCIES = [
  { id: 'daily', label: 'Daily' },
  { id: '2x', label: '2x Week' },
  { id: '3x', label: '3x Week' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'asneeded', label: 'As Needed' },
  { id: 'specific', label: 'Specific Days' },
]

export const PARTS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
]

export const ACTIVITY_CATEGORIES = [
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'skincare', label: 'Skincare' },
  { id: 'facial', label: 'Facial Care' },
  { id: 'haircare', label: 'Haircare' },
  { id: 'body', label: 'Body Care' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'aesthetics', label: 'Aesthetics' },
  { id: 'supplements', label: 'Supplements' },
  { id: 'wellness', label: 'Wellness Practices' },
  { id: 'spirituality', label: 'Spirituality' },
  { id: 'treatments', label: 'Treatments' },
  { id: 'appointments', label: 'Appointments' },
]

export const PHASE_OPTS = [
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
  { id: 'menstrual', label: 'Menstrual' },
  { id: 'any', label: 'Any' },
]

export const WEEKDAYS = [
  { d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' }, { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' },
]
// Frequencies that don't take specific weekdays.
export const NO_DAYS_FREQ = ['daily', 'asneeded']

// Which Dream Day section a protocol category belongs to.
export const SECTION_CATS = {
  ritual: ['skincare', 'facial', 'haircare', 'body', 'fitness', 'aesthetics', 'spirituality', 'treatments', 'wellness'],
  nourishment: ['nutrition', 'supplements'],
  agenda: ['appointments'],
}
export const sectionForCategory = (cat) => {
  if (SECTION_CATS.ritual.includes(cat)) return 'ritual'
  if (SECTION_CATS.nourishment.includes(cat)) return 'nourishment'
  return 'agenda'
}
// The parts of day an activity belongs to. Explicit timeOfDay wins; otherwise an
// AM/PM hint in the title routes it; otherwise it's "Any" → all three columns.
const ALL_PARTS = ['morning', 'afternoon', 'evening']
export const partsOfActivity = (a) => {
  const t = (a.timeOfDay || []).filter((p) => ALL_PARTS.includes(p))
  if (t.length) return t
  const title = (a.title || '').toLowerCase()
  if (/\bam\b/.test(title) || /\bmorning\b/.test(title)) return ['morning']
  if (/\bpm\b/.test(title) || /\bevening\b/.test(title) || /\bnight\b/.test(title)) return ['evening']
  return ALL_PARTS
}

export const normActivity = (a) => {
  // Fitness is a ritual now: fold legacy fitness "events" (which stored their
  // part of day under details.partOfDay and the workout under details.description)
  // into ritual protocols so they surface in the Morning/Evening Routine.
  let type = a.type || 'event'
  let timeOfDay = Array.isArray(a.timeOfDay) ? a.timeOfDay : []
  let notes = a.notes || ''
  if (type === 'event' && a.category === 'fitness') {
    const d = a.details && typeof a.details === 'object' ? a.details : {}
    type = 'protocol'
    if (!timeOfDay.length && d.partOfDay) timeOfDay = [d.partOfDay]
    if (!notes && d.description) notes = d.description
  }
  return {
  id: a.id || uid(),
  createdAt: a.createdAt || '',
  type,
  title: a.title || '',
  category: a.category || '',
  phase: Array.isArray(a.phase) ? a.phase : [],
  timeOfDay,
  frequency: a.frequency || 'daily',
  daysOfWeek: Array.isArray(a.daysOfWeek) ? a.daysOfWeek : [],
  seriesStart: a.seriesStart || '',
  seriesEnd: a.seriesEnd || '',
  status: a.status || 'active',
  pinned: !!a.pinned,
  lastCompleted: a.lastCompleted || '',
  notes,
  completions: a.completions && typeof a.completions === 'object' ? a.completions : {},
  details: a.details && typeof a.details === 'object' ? a.details : {},
  order: typeof a.order === 'number' ? a.order : undefined,
  // Interval + unit for the 'custom' frequency (every N days/weeks/months/years).
  // ('nweeks' is legacy and implies a week unit.)
  interval: typeof a.interval === 'number' && a.interval > 0 ? a.interval : undefined,
  intervalUnit: a.intervalUnit || undefined,
  linkedId: a.linkedId || null,
  }
}

export const blankActivity = (type = 'event', overrides = {}) => normActivity({
  id: uid(),
  type,
  frequency: 'daily',
  status: 'active',
  details:
    type === 'event' ? { partOfDay: 'morning', description: '', attendees: '', durationMinutes: '' }
      : type === 'meal_item' ? { slot: 'breakfast', beverage: false }
        : type === 'supplement' ? { dose: '', unit: 'mg', timingNotes: '', cycleLength: '', stackNotes: '', provider: '' }
          : { categoryFields: {} },
  ...overrides,
})

// Does an activity land on a given date key, per its recurrence?
export const activityOccursOn = (a, key) => {
  const start = a.seriesStart || a.createdAt || key
  if (a.seriesStart && key < a.seriesStart) return false
  if (a.seriesEnd && key > a.seriesEnd) return false
  const f = a.frequency || 'daily'
  if (f === 'daily') return true
  if (f === 'asneeded' || f === 'once') return key === start
  const d = parseKey(key)
  const dow = d.getDay()
  if (f === 'weekdays') return dow >= 1 && dow <= 5
  if (f === 'weekends') return dow === 0 || dow === 6
  const days = Array.isArray(a.daysOfWeek) && a.daysOfWeek.length ? a.daysOfWeek : null
  if (f === 'weekly' || f === '2x' || f === '3x' || f === 'specific') {
    return days ? days.includes(dow) : parseKey(start).getDay() === dow
  }
  if (f === 'biweekly' || f === 'nweeks') {
    const okDay = days ? days.includes(dow) : parseKey(start).getDay() === dow
    if (!okDay) return false
    const n = f === 'biweekly' ? 2 : (a.interval && a.interval > 0 ? a.interval : 1)
    const weeks = Math.round((startOfWeek(d).getTime() - startOfWeek(parseKey(start)).getTime()) / (7 * 86400000))
    return weeks % n === 0
  }
  // Monthly on a weekday — same ordinal occurrence as the start (e.g. 2nd Tuesday).
  if (f === 'monthlyday') {
    const okDay = days ? days.includes(dow) : parseKey(start).getDay() === dow
    if (!okDay) return false
    return Math.ceil(d.getDate() / 7) === Math.ceil(parseKey(start).getDate() / 7)
  }
  // Custom — every N days / weeks / months / years from the start date.
  if (f === 'custom') {
    const cs = parseKey(start)
    const n = a.interval && a.interval > 0 ? a.interval : 1
    const unit = a.intervalUnit || 'week'
    const dayDiff = Math.round((d.getTime() - cs.getTime()) / 86400000)
    if (unit === 'day') return dayDiff >= 0 && dayDiff % n === 0
    if (unit === 'week') return dayDiff >= 0 && dayDiff % (n * 7) === 0
    if (unit === 'month' || unit === 'quarter') {
      if (cs.getDate() !== d.getDate()) return false
      const months = (d.getFullYear() - cs.getFullYear()) * 12 + (d.getMonth() - cs.getMonth())
      const step = unit === 'quarter' ? n * 3 : n
      return months >= 0 && months % step === 0
    }
    if (unit === 'year') {
      if (cs.getDate() !== d.getDate() || cs.getMonth() !== d.getMonth()) return false
      const years = d.getFullYear() - cs.getFullYear()
      return years >= 0 && years % n === 0
    }
    return false
  }
  const s = parseKey(start)
  if (f === 'monthly') return s.getDate() === d.getDate()
  if (f === 'quarterly') return s.getDate() === d.getDate() && ((d.getMonth() - s.getMonth() + 12) % 3 === 0)
  if (f === 'yearly') return s.getDate() === d.getDate() && s.getMonth() === d.getMonth()
  return false
}

export const isDoneOn = (a, key) => !!(a.completions && a.completions[key])
export const partOf = (a) => (a.type === 'event' ? a.details?.partOfDay || 'morning' : null)

// Map a meal/supplement activity into the shape MealSlots renders.
export const toMealShape = (a) => ({
  id: a.id,
  name: a.title,
  kind: a.type === 'supplement' ? 'supp' : 'food',
  slot: a.details?.slot || 'breakfast',
})

// ── One-time migration from the legacy stores ───────────────────────
// Folds mos:today:events, mos:meals and mos:menu:recipes (protocols) into
// activities. Originals are NOT deleted (kept as backup); activities is the
// live source of truth going forward.

// Title-driven type/slot overrides from the spec.
const NAME_OVERRIDES = {
  'olive oil shot': { type: 'meal_item', slot: 'empty' },
  '2l of water': { type: 'meal_item', slot: 'drink' },
  '2 l of water': { type: 'meal_item', slot: 'drink' },
  '2l water': { type: 'meal_item', slot: 'drink' },
  '1l of water': { type: 'meal_item', slot: 'drink' },
  '1 l of water': { type: 'meal_item', slot: 'drink' },
  '1l water': { type: 'meal_item', slot: 'drink' },
  'gelatin gummies': { type: 'meal_item', slot: 'breakfast', timeOfDay: ['morning', 'afternoon', 'evening'] },
  'anti aging gelatin gummies': { type: 'meal_item', slot: 'breakfast', timeOfDay: ['morning', 'afternoon', 'evening'] },
  'tomatoe shot': { type: 'meal_item', slot: 'breakfast' },
  'tomato shot': { type: 'meal_item', slot: 'breakfast' },
  'vitamin stack': { type: 'supplement' },
  'peptide stack': { type: 'supplement' },
  'am skincare': { type: 'protocol', category: 'skincare' },
  'pm skincare': { type: 'protocol', category: 'skincare' },
}
const overrideFor = (title) => NAME_OVERRIDES[(title || '').trim().toLowerCase()]

const EVENT_FREQ = { once: 'asneeded', daily: 'daily', weekly: 'weekly', biweekly: 'biweekly', monthly: 'monthly', yearly: 'yearly' }

export function migrateToActivities({ events = {}, meals = [], protocols = [] }) {
  const out = []
  const seen = new Set() // dedupe by type|title
  const push = (a) => {
    const act = normActivity(a)
    const key = `${act.type}|${act.title.trim().toLowerCase()}`
    if (act.title && seen.has(key)) return
    if (act.title) seen.add(key)
    out.push(act)
  }

  // Protocols (mos:menu:recipes) — type protocol, unless name says supplement/meal.
  ;(Array.isArray(protocols) ? protocols : []).forEach((p) => {
    const title = p.title || p.name || ''
    const ov = overrideFor(title)
    if (ov && ov.type === 'meal_item') {
      push({ type: 'meal_item', title, category: 'nutrition', frequency: 'daily', timeOfDay: ov.timeOfDay || [], notes: p.notes || p.prep || '', details: { slot: ov.slot || 'breakfast', beverage: false } })
    } else if (ov && ov.type === 'supplement') {
      push({ type: 'supplement', title, category: 'supplements', frequency: p.frequency || 'daily', phase: p.phases || [], notes: p.notes || p.prep || '', details: { dose: p.dose || '', unit: p.doseUnit || 'mg', timingNotes: p.suppTiming || '', cycleLength: p.cycleLength || '', stackNotes: p.stackNotes || '', provider: p.provider || '' } })
    } else {
      push({
        type: 'protocol', title,
        category: ov?.category || p.category || 'nutrition',
        phase: Array.isArray(p.phases) ? p.phases : [],
        timeOfDay: Array.isArray(p.timesOfDay) ? p.timesOfDay : p.timeOfDay && p.timeOfDay !== 'any' ? [p.timeOfDay] : [],
        frequency: p.frequency || 'daily',
        daysOfWeek: Array.isArray(p.days) ? p.days : [],
        seriesStart: p.startDate || '',
        seriesEnd: p.noEndDate ? '' : p.endDate || '',
        status: p.status || 'active',
        pinned: !!p.pinned,
        lastCompleted: p.lastCompleted || '',
        notes: p.notes || p.prep || '',
        details: { categoryFields: p },
      })
    }
  })

  // Meals (mos:meals) — meal items / supplements.
  ;(Array.isArray(meals) ? meals : []).forEach((m) => {
    const title = m.name || ''
    const ov = overrideFor(title)
    const isSupp = m.kind === 'supp' || (ov && ov.type === 'supplement')
    if (isSupp) {
      push({ type: 'supplement', title, category: 'supplements', frequency: m.frequency || 'daily', daysOfWeek: Array.isArray(m.days) ? m.days : [], seriesStart: m.startDate || '', notes: m.notes || '', details: { dose: '', unit: 'mg', timingNotes: '', cycleLength: '', stackNotes: '', provider: '', slot: m.slot || 'breakfast' } })
    } else {
      push({ type: 'meal_item', title, category: 'nutrition', frequency: m.frequency || 'daily', daysOfWeek: Array.isArray(m.days) ? m.days : [], seriesStart: m.startDate || '', timeOfDay: ov?.timeOfDay || [], notes: m.notes || '', details: { slot: ov?.slot || m.slot || 'breakfast', beverage: m.slot === 'drink' || ov?.slot === 'drink' } })
    }
  })

  // Events (mos:today:events) keyed by date → list.
  Object.keys(events || {}).forEach((k) => {
    ;(events[k] || []).forEach((ev) => {
      const title = ev.title != null ? ev.title : ev.text || ''
      const ov = overrideFor(title)
      if (ov && ov.type === 'meal_item') {
        push({ type: 'meal_item', title, category: 'nutrition', frequency: 'daily', seriesStart: '', timeOfDay: ov.timeOfDay || [], details: { slot: ov.slot || 'breakfast', beverage: ov.slot === 'drink' } })
        return
      }
      push({
        type: 'event', title,
        frequency: EVENT_FREQ[ev.frequency] || 'asneeded',
        daysOfWeek: Array.isArray(ev.days) ? ev.days : [],
        seriesStart: k,
        seriesEnd: ev.endDate || '',
        notes: '',
        completions: ev.done ? { [k]: true } : {},
        details: { partOfDay: ev.part || 'morning', description: ev.description || '', attendees: ev.attendees || '', durationMinutes: '', time: ev.time || '' },
      })
    })
  })

  return out
}

export { uid, MEAL_SLOTS, dateKey }
