// ── What a goal is actually doing.
//
// One measure, and it is about effort rather than list-writing: of the practices
// this goal recruited, how many actually got done. It moves first, and it is the
// only part she controls day to day.
//
// There is deliberately no reading of the body here. Her health runs in the
// pillars — the labs, the markers, the panels — and that is a separate system
// with its own record. A goal does not reach into it for proof, and the two are
// not joined behind her back.

import { isDoneOn, activityOccursOn } from './activities'
import { dateKey, addDays } from './date'

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
