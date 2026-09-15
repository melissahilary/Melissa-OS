// The shape of a goal, in one place.
//
// Two doors open onto the same board — the Dream page and the universal Add —
// and they were each building the object by hand. The quick one left out the
// clock, so a goal added from the + arrived with no start and no due date and
// had to be patched afterwards by a backfill effect. One constructor, both
// doors, no patching.

import { dateKey, parseKey } from './date'

// The columns name a horizon rather than an attitude. "On deck" says nothing
// about when; six to twelve months does, and it is the thing she is actually
// deciding when she drags a goal across.
export const PHASES = [
  { id: 'now', label: 'Now', note: '0–6 months', months: 6 },
  { id: 'next', label: 'Next', note: '6–12 months', months: 12 },
  { id: 'later', label: 'Later', note: '12+ months', months: 18 },
]
export const phaseMeta = (id) => PHASES.find((p) => p.id === id) || PHASES[0]

// The day she enters a goal the clock starts: its horizon sets a due date from
// that day, and moving it to another horizon restarts the clock from today. She
// can then set the date to anything — the horizon is the default, not the rule.
export const addMonths = (key, n) => {
  const d = parseKey(key)
  return dateKey(new Date(d.getFullYear(), d.getMonth() + n, d.getDate()))
}
export const dueFromHorizon = (phase, from) => addMonths(from || dateKey(new Date()), phaseMeta(phase).months)

const uid = () => Math.random().toString(36).slice(2, 10)

// A goal starts active. Nothing else in the app may write `achieved` at birth —
// that word is only ever earned by her pressing the button.
export function newGoal(phase = 'now', title = '') {
  const today = dateKey(new Date())
  return {
    id: uid(),
    title: (title || '').trim(),
    vision: '',
    pillar: 'mindset',
    phase,
    status: 'active',
    milestones: [],
    notes: [],
    createdOn: today,
    target: dueFromHorizon(phase, today),
  }
}
