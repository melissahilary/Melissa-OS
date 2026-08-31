// ── What a goal is actually doing.
//
// A percentage bar over milestones measures how much of your own list you have
// crossed off, which is a measure of list-writing. Two things are worth knowing
// instead, and they are different in kind:
//
//   Adherence — the leading indicator. Of the practices this goal recruited,
//   how many actually got done. It moves first, and it is the only part she
//   controls day to day.
//
//   Evidence — the lagging indicator. The number in the body that the whole
//   goal was for. Ferritin 31 → 46. It moves last, and it is the only proof.

import { isDoneOn, activityOccursOn } from './activities'
import { dateKey, addDays } from './date'
import { BY_ID } from './biomarkers'

// Of everything this goal's protocols asked for in the window, how much happened.
export function adherenceOf(steps, days = 30, endDate = new Date()) {
  let due = 0
  let met = 0
  for (let i = 0; i < days; i += 1) {
    const dk = dateKey(addDays(endDate, -i))
    steps.forEach((a) => {
      if (a.status === 'archived') return
      if (!activityOccursOn(a, dk)) return
      due += 1
      if (isDoneOn(a, dk)) met += 1
    })
  }
  return due ? { pct: Math.round((met / due) * 100), due, met } : null
}

// The same measure, week by week — the shape of the effort rather than one
// number, which is what a trajectory actually is.
export function trajectoryOf(steps, weeks = 8, endDate = new Date()) {
  const out = []
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const end = addDays(endDate, -w * 7)
    let due = 0
    let met = 0
    for (let i = 0; i < 7; i += 1) {
      const dk = dateKey(addDays(end, -i))
      steps.forEach((a) => {
        if (a.status === 'archived' || !activityOccursOn(a, dk)) return
        due += 1
        if (isDoneOn(a, dk)) met += 1
      })
    }
    out.push(due ? Math.round((met / due) * 100) : null)
  }
  return out
}

// The lagging indicator, read straight out of the lab record. First reading to
// latest — the only sentence that says whether any of it worked.
export function evidenceOf(goal, labRecord) {
  const markerId = goal && goal.evidence && goal.evidence.marker
  if (!markerId) return null
  const rec = labRecord && typeof labRecord === 'object' ? labRecord : {}
  const readings = (Array.isArray(rec.readings) ? rec.readings : [])
    .filter((r) => r.marker === markerId)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  if (!readings.length) return null
  const marker = BY_ID[markerId]
  const val = (r) => (r.canonical != null ? r.canonical : parseFloat(r.value))
  const first = val(readings[0])
  const last = val(readings[readings.length - 1])
  const round = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10)
  return {
    label: marker ? marker.label : markerId,
    unit: marker ? marker.unit : '',
    first: round(first),
    last: round(last),
    moved: readings.length > 1 && first !== last,
    direction: last > first ? 'up' : last < first ? 'down' : 'flat',
    count: readings.length,
  }
}

// ── Recruiting practices ────────────────────────────────────────────
// The join between intention and behaviour. A goal with no protocols is a wish;
// this is what turns one into the other, and it proposes from the same shared
// activity model everything else in the house runs on.
export const RECRUITS = {
  hormones: [
    { title: 'Take iron with vitamin C, away from coffee', cadence: 'daily' },
    { title: 'Seed cycling', cadence: 'daily' },
    { title: 'Log cycle day and symptoms', cadence: 'daily' },
    { title: 'Day-3 or day-21 draw', cadence: 'once' },
  ],
  skincare: [
    { title: 'Morning routine', cadence: 'daily' },
    { title: 'Evening routine', cadence: 'daily' },
    { title: 'Retinoid', cadence: 'weekly' },
    { title: 'Progress photograph', cadence: 'weekly' },
  ],
  fitness: [
    { title: 'Strength session', cadence: 'weekly' },
    { title: 'Zone 2, 45 minutes', cadence: 'weekly' },
    { title: 'Ten thousand steps', cadence: 'daily' },
    { title: 'Mobility', cadence: 'daily' },
  ],
  nutrition: [
    { title: 'Protein at breakfast', cadence: 'daily' },
    { title: 'Plan the week’s meals', cadence: 'weekly' },
    { title: 'Supplements', cadence: 'daily' },
  ],
  mindset: [
    { title: 'Morning pages', cadence: 'daily' },
    { title: 'Ten minutes of quiet', cadence: 'daily' },
    { title: 'Gratitude', cadence: 'daily' },
  ],
  diagnostics: [
    { title: 'Book the panel', cadence: 'once' },
    { title: 'Retest in twelve weeks', cadence: 'once' },
  ],
  aesthetics: [
    { title: 'Book the consultation', cadence: 'once' },
    { title: 'Baseline photographs', cadence: 'once' },
    { title: 'Aftercare', cadence: 'daily' },
  ],
  haircare: [
    { title: 'Scalp treatment', cadence: 'weekly' },
    { title: 'Bond treatment', cadence: 'weekly' },
  ],
  bodycare: [{ title: 'Dry brush and oil', cadence: 'daily' }, { title: 'Sauna', cadence: 'weekly' }],
  relationships: [{ title: 'One real conversation', cadence: 'weekly' }, { title: 'Plan something together', cadence: 'weekly' }],
  spirituality: [{ title: 'Sit', cadence: 'daily' }, { title: 'Read something old', cadence: 'weekly' }],
  brainhealth: [{ title: 'Omega-3', cadence: 'daily' }, { title: 'Read, not scroll, before bed', cadence: 'daily' }],
}

export const recruitsFor = (pillar) => RECRUITS[pillar] || RECRUITS.mindset
