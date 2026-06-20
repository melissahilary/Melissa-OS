// Date + moon helpers shared across the planner.

export const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Stable yyyy-mm-dd key in local time (not UTC, to avoid off-by-one).
export function dateKey(d) {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isSameDay(a, b) {
  return dateKey(a) === dateKey(b)
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// Sunday-anchored start of the week containing `d`.
export function startOfWeek(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export function weekDays(anchor) {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// "May 11–17, 2026" / spans months + years gracefully.
export function weekRangeLabel(anchor) {
  const days = weekDays(anchor)
  const a = days[0]
  const b = days[6]
  const sameMonth = a.getMonth() === b.getMonth()
  const sameYear = a.getFullYear() === b.getFullYear()
  if (sameMonth && sameYear) {
    return `${MONTHS[a.getMonth()]} ${a.getDate()}–${b.getDate()}, ${a.getFullYear()}`
  }
  if (sameYear) {
    return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}, ${a.getFullYear()}`
  }
  return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()}, ${a.getFullYear()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
}

export function longDate(d) {
  const x = new Date(d)
  return `${DOW_LONG[x.getDay()]}, ${MONTHS[x.getMonth()]} ${x.getDate()}`
}

// Calendar grid (array of 42 cells) for the month containing `d`.
export function monthGrid(d) {
  const x = new Date(d)
  const first = new Date(x.getFullYear(), x.getMonth(), 1)
  const startPad = first.getDay()
  const cells = []
  const gridStart = addDays(first, -startPad)
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i))
  return cells
}

// ── Moon phase ───────────────────────────────────────────────────
// 8 phases, index 0..7. Uses a known new moon reference.
const SYNODIC = 29.53058867
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14) // 2000-01-06 18:14 UTC

export const MOON_NAMES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
]

export function moonPhaseIndex(date) {
  const diffDays = (new Date(date).getTime() - NEW_MOON_REF) / 86400000
  const age = ((diffDays % SYNODIC) + SYNODIC) % SYNODIC
  return Math.round(age / (SYNODIC / 8)) % 8
}
