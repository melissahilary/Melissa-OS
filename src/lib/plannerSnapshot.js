// A compact, grounded snapshot of the whole planner for the concierge (api/ask).
// Reads every mos:* store from the in-memory data cache, trims bulky text, and
// stamps today's date + weekday so answers about "this week" / "today" work.

import { all } from './dataStore'
import { dateKey, parseKey } from './date'
import { phaseForConfig } from './cycle'
import { normActivity, activityOccursOn, isDoneOn } from './activities'
import { normMeal, mealOccursOn } from './meals'

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

// ── What actually happens on a given day.
//
// The stores hold rules, not days: a frequency, a set of weekdays, a start, an
// interval, an end. Handing those over and expecting the answer to be right
// means asking it to run the app's whole recurrence engine in its head — which
// is how "what am I having for breakfast tomorrow" became a nine-item run-on
// sentence with the reasoning showing. The app already has one correct
// implementation of that engine. This calls it.
function dayOf(raw, key) {
  const acts = (Array.isArray(raw['mos:activities']) ? raw['mos:activities'] : [])
    .map(normActivity)
    .filter((a) => activityOccursOn(a, key))
    .map((a) => ({
      title: a.title,
      type: a.type,
      category: a.category || '',
      time: (a.details && a.details.time) || '',
      slot: (a.details && a.details.slot) || '',
      done: isDoneOn(a, key),
    }))
  const meals = (Array.isArray(raw['mos:meals']) ? raw['mos:meals'] : [])
    .map(normMeal)
    .filter((m) => mealOccursOn(m, key))
    .map((m) => ({ name: m.name, kind: m.kind, slot: m.slot, done: !!(m.completions && m.completions[key]) }))
  return { date: key, weekday: WEEKDAYS[parseKey(key).getDay()], activities: acts, meals }
}

export function plannerSnapshot() {
  const raw = all() || {}
  const out = {}
  Object.entries(raw).forEach(([k, v]) => {
    if (k.startsWith('mos:') && !SKIP.has(k)) out[k] = trim(v)
  })
  const now = new Date()
  const todayKey = dateKey(now)
  const tomorrow = new Date(now.getTime() + 86400000)

  // The cycle, computed by the same function that prints LUTEAL DAY 23 on the
  // calendar. Sending the raw start date and letting the answer do the
  // arithmetic produced a planner that disagreed with itself on screen: the
  // calendar said luteal, and Ask said nothing placed her in luteal.
  const cfg = raw['mos:settings:cycle']
  let cycle = null
  try {
    const ph = phaseForConfig(cfg || {}, now)
    if (ph) cycle = { phase: ph.name, day: ph.cycleDay, manual: !!ph.manual, cycleLength: (cfg && cfg.cycleLength) || 28 }
  } catch (_) { cycle = null }

  out._context = {
    today: todayKey,
    weekday: WEEKDAYS[now.getDay()],
    cycle,
    // Already resolved. These are the answer to "today" and "tomorrow"; the
    // recurrence rules in the stores above are working, not findings.
    resolved: { today: dayOf(raw, todayKey), tomorrow: dayOf(raw, dateKey(tomorrow)) },
  }
  return out
}
