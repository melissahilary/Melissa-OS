import { normActivity } from './activities.js'
import { parseKey, dateKey } from './date.js'

const uid = () => Math.random().toString(36).slice(2, 10)

export function isRepeating(a) {
  const f = (a && a.frequency) || 'daily'
  return f !== 'once' && f !== 'asneeded'
}

function shiftKey(key, days) {
  const d = parseKey(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

// How an activity reads on one day. A per-day edit lives in dayOverrides and
// does not change the series underneath.
export function projectActivity(activity, key) {
  const base = normActivity(activity || {})
  const o = base.dayOverrides && base.dayOverrides[key]
  if (!o) return base
  return normActivity({
    ...base,
    ...o,
    id: base.id,
    frequency: base.frequency,
    seriesStart: base.seriesStart,
    seriesEnd: base.seriesEnd,
    dayOverrides: base.dayOverrides,
    completions: base.completions,
    details: { ...base.details, ...(o.details || {}) },
  })
}

// scope: 'one' | 'following' | 'all'
export function applySeriesEdit(activity, key, patch, scope) {
  const base = normActivity(activity || {})
  const mergedDetails = { ...base.details, ...((patch && patch.details) || {}) }
  if (scope === 'all' || !isRepeating(base) || (base.seriesStart && key <= base.seriesStart && scope === 'following')) {
    return [normActivity({ ...base, ...patch, details: mergedDetails, dayOverrides: base.dayOverrides, id: base.id })]
  }
  if (scope === 'one') {
    const prev = (base.dayOverrides && base.dayOverrides[key]) || {}
    const override = {
      ...prev,
      title: patch.title,
      notes: patch.notes,
      timeOfDay: patch.timeOfDay,
      daySections: patch.daySections,
      details: patch.details || prev.details || {},
    }
    return [normActivity({ ...base, dayOverrides: { ...(base.dayOverrides || {}), [key]: override } })]
  }
  const ended = normActivity({ ...base, seriesEnd: shiftKey(key, -1) })
  const next = normActivity({
    ...base,
    ...patch,
    id: uid(),
    seriesStart: key,
    seriesEnd: base.seriesEnd && base.seriesEnd >= key ? base.seriesEnd : '',
    dayOverrides: {},
    completions: {},
    details: mergedDetails,
  })
  return [ended, next]
}
