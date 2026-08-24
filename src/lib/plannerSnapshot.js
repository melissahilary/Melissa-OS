// A compact, grounded snapshot of the whole planner for the concierge (api/ask).
// Reads every mos:* store from the in-memory data cache, trims bulky text, and
// stamps today's date + weekday so answers about "this week" / "today" work.

import { all } from './dataStore'
import { dateKey } from './date'

// Pure UI state and derived caches — nothing the concierge should reason about.
const SKIP = new Set([
  'mos:active', 'mos:subpages', 'mos:dream:active', 'mos:dream:order',
  'mos:settings:hidden', 'mos:flags:reclassifyV2', 'mos:horoscope',
  'mos:diet:seeded',
])

function trim(v, depth = 0) {
  if (typeof v === 'string') return v.length > 500 ? `${v.slice(0, 500)}…` : v
  if (Array.isArray(v)) return v.slice(0, 500).map((x) => trim(x, depth + 1))
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = trim(v[k], depth + 1); return o }
  return v
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function plannerSnapshot() {
  const raw = all() || {}
  const out = {}
  Object.entries(raw).forEach(([k, v]) => {
    if (k.startsWith('mos:') && !SKIP.has(k)) out[k] = trim(v)
  })
  const now = new Date()
  out._context = { today: dateKey(now), weekday: WEEKDAYS[now.getDay()] }
  return out
}
