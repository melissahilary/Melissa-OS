import React, { useState } from 'react'
import { X, Calendar } from 'lucide-react'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import { parseKey, dateKey, addDays, MONTHS, MONTHS_SHORT, isSameDay } from '../lib/date'
import { useRegisterAdd } from './shared/AddButton'
import CategoryCalendar, { occursOnCal } from './shared/CategoryCalendar'

const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtDate = (k) => { if (!k) return '—'; const d = parseKey(k); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }
const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday-first
const PARTS = [{ id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Evening' }]
const PART_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }
// Weekday chips, Monday-first (value is JS getDay()).
const WD_CHIPS = [
  { d: 1, l: 'M' }, { d: 2, l: 'T' }, { d: 3, l: 'W' }, { d: 4, l: 'T' }, { d: 5, l: 'F' }, { d: 6, l: 'S' }, { d: 0, l: 'S' },
]
// Repeat patterns offered in the workout form.
const PATTERNS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'monthlyday', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
]
// Units for the Custom "every N ___" interval.
const UNITS = [
  { id: 'day', label: 'days' },
  { id: 'week', label: 'weeks' },
  { id: 'month', label: 'months' },
  { id: 'quarter', label: 'quarters' },
  { id: 'year', label: 'years' },
]
const usesDays = (p) => p === 'weekly' || p === 'biweekly' || p === 'monthlyday'
const isSeries = () => true
const initialPattern = (a) => {
  const f = a.frequency
  if (f === 'daily') return 'daily'
  if (f === 'weekdays') return 'weekdays'
  if (f === 'weekends') return 'weekends'
  if (f === 'biweekly') return 'biweekly'
  if (f === 'monthlyday') return 'monthlyday'
  if (f === 'quarterly') return 'quarterly'
  if (f === 'yearly') return 'yearly'
  if (f === 'custom' || f === 'nweeks') return 'custom'
  return 'weekly'
}

const firstLine = (t) => (t || '').split('\n').map((s) => s.trim()).find(Boolean) || 'Workout'
const isRecurring = (a) => a.frequency !== 'asneeded' && a.frequency !== 'once'
// A workout's part of day (timeOfDay wins; falls back to the legacy event field).
const workoutPart = (a) => (a.timeOfDay && a.timeOfDay[0]) || (a.details && a.details.partOfDay) || 'morning'
// The workout body — protocol notes, falling back to the legacy event description.
const workoutBody = (a) => a.notes || (a.details && a.details.description) || ''
// Human label for the recurrence, shown under each workout.
const patternLabel = (a) => {
  const f = a.frequency
  if (f === 'daily') return 'Daily'
  if (f === 'weekdays') return 'Weekdays'
  if (f === 'weekends') return 'Weekends'
  if (f === 'biweekly') return 'Bi-weekly'
  if (f === 'monthlyday') return 'Monthly'
  if (f === 'quarterly') return 'Quarterly'
  if (f === 'yearly') return 'Yearly'
  if (f === 'nweeks') return `Every ${a.interval || 1} weeks`
  if (f === 'custom') { const n = a.interval || 1; const u = a.intervalUnit || 'week'; return `Every ${n} ${u}${n === 1 ? '' : 's'}` }
  if (f === 'asneeded' || f === 'once') return 'One-time'
  return 'Weekly'
}
// The date of the given weekday within the current week.
const thisWeekDate = (weekday) => { const d = new Date(); d.setDate(d.getDate() + (weekday - d.getDay())); return dateKey(d) }
// Which weekdays a recurring workout lands on.
const recurWeekdays = (a) => {
  if (a.frequency === 'daily') return [0, 1, 2, 3, 4, 5, 6]
  if (a.frequency === 'weekdays') return [1, 2, 3, 4, 5]
  if (a.frequency === 'weekends') return [0, 6]
  if (Array.isArray(a.daysOfWeek) && a.daysOfWeek.length) return a.daysOfWeek
  if (a.seriesStart) return [parseKey(a.seriesStart).getDay()]
  return []
}

export default function Fitness({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="fitness" cycleConfig={cycleConfig} noun="Workout" />
    : <Workouts />
}

// ── Workouts — a Monday–Sunday weekly schedule. Each workout is a ritual
// protocol, so it shows in the home Morning/Evening Routine (not Agenda).
function Workouts() {
  const { activities, add, update, remove } = useActivities()
  const [editing, setEditing] = useState(null) // { weekday, activity }
  const today = new Date()
  const todayKey = dateKey(today)
  const [anchorKey, setAnchorKey] = useState(todayKey)

  // Monday of the viewed week → the seven day dates.
  const anchor = parseKey(anchorKey)
  const monday = addDays(anchor, -((anchor.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = days[6]
  const shiftWeek = (n) => setAnchorKey(dateKey(addDays(anchor, n * 7)))
  const fullDay = (d) => `${DOW_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  const weekLabel = `${fullDay(monday)} - ${fullDay(sunday)}`

  const workouts = activities.filter((a) => a.type === 'protocol' && a.category === 'fitness' && a.status !== 'archived')
  const forDay = (d) => workouts.filter((a) => occursOnCal(a, dateKey(d)))

  const openNew = (wd) => setEditing({ weekday: wd, activity: blankActivity('protocol', { category: 'fitness', frequency: 'weekly', daysOfWeek: [wd], timeOfDay: ['morning'] }) })
  const openEdit = (a) => setEditing({ weekday: (a.daysOfWeek || [])[0] != null ? a.daysOfWeek[0] : (a.seriesStart ? parseKey(a.seriesStart).getDay() : 1), activity: a })
  const save = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  useRegisterAdd(() => openNew(new Date().getDay()), [])

  return (
    <div className="mb-10">
      {/* Week navigation — prev · range + jump-to-date · next */}
      <div className="mb-6 flex items-center justify-between gap-2">
        <button onClick={() => shiftWeek(-1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">‹</button>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="font-serif text-lg text-stone-900">{weekLabel}</span>
          <label className="relative inline-flex cursor-pointer items-center text-stone-400 hover:text-stone-900">
            <Calendar size={16} />
            <input type="date" value={anchorKey} onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()} onChange={(e) => e.target.value && setAnchorKey(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
        </div>
        <button onClick={() => shiftWeek(1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">›</button>
      </div>

      <div className="space-y-6">
      {days.map((d) => {
        const items = forDay(d)
        const isTod = isSameDay(d, today)
        return (
          <section key={dateKey(d)} className="border-t border-stone-200 pt-4">
            <h3 className={`font-serif italic text-2xl mb-3 ${isTod ? 'text-stone-900' : 'text-stone-800'}`}>
              {DOW_LONG[d.getDay()]}
              <span className="ml-2 text-base not-italic text-stone-400">{MONTHS_SHORT[d.getMonth()]} {d.getDate()}</span>
            </h3>
            {items.length === 0 ? (
              <p className="text-sm italic text-stone-400">Rest day.</p>
            ) : (
              <div className="space-y-2">
                {items.map((a) => (
                  <div key={a.id} className="group flex items-start gap-3 border border-stone-200 bg-white/40 px-4 py-3">
                    <button onClick={() => openEdit(a)} className="min-w-0 flex-1 text-left">
                      <p className="font-serif text-lg text-stone-900">{a.title || 'Workout'}</p>
                      {workoutBody(a).trim() && (
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-500">{workoutBody(a)}</p>
                      )}
                      <p className="kicker text-stone-400 mt-2">{PART_LABEL[workoutPart(a)]} · {patternLabel(a)}</p>
                    </button>
                    <button onClick={() => remove(a.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
      </div>

      {editing && (
        <WorkoutForm
          entry={editing}
          isNew={!activities.some((x) => x.id === editing.activity.id)}
          onSave={save}
          onDelete={() => { remove(editing.activity.id); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function WorkoutForm({ entry, isNew, onSave, onDelete, onClose }) {
  const { weekday } = entry
  const a0 = entry.activity
  const [name, setName] = useState(a0.title || '')
  const [text, setText] = useState(workoutBody(a0))
  const [parts, setParts] = useState(Array.isArray(a0.timeOfDay) && a0.timeOfDay.length ? a0.timeOfDay : [workoutPart(a0)])
  const togglePart = (id) => setParts((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const [pattern, setPattern] = useState(initialPattern(a0))
  const [days, setDays] = useState(Array.isArray(a0.daysOfWeek) && a0.daysOfWeek.length ? a0.daysOfWeek : [weekday])
  const [num, setNum] = useState(a0.interval && a0.interval > 0 ? a0.interval : 2)
  const [unit, setUnit] = useState(a0.intervalUnit || 'week')
  const [start, setStart] = useState(a0.seriesStart || thisWeekDate(weekday))
  const [end, setEnd] = useState(a0.seriesEnd || '')
  const [noEnd, setNoEnd] = useState(!a0.seriesEnd)
  // Existing workouts open read-only; the Edit button unlocks the fields.
  const [readOnly, setReadOnly] = useState(!isNew)
  const daysStr = usesDays(initialPattern(a0)) && Array.isArray(a0.daysOfWeek) && a0.daysOfWeek.length
    ? [...a0.daysOfWeek].sort((x, y) => x - y).map((d) => DOW_SHORT[d]).join(', ')
    : ''

  const toggleDay = (d) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
  const needDays = usesDays(pattern)
  // Every schedule is a series: start + days (when relevant) + interval (Custom) +
  // an end choice are mandatory.
  const customValid = pattern !== 'custom' || (Number(num) >= 1 && !!unit)
  const seriesValid = !!start && (!needDays || days.length > 0) && (noEnd || !!end) && customValid
  const canSave = (name.trim() || firstLine(text)) && seriesValid

  const submit = () => {
    if (!canSave) return
    const nm = name.trim() || firstLine(text)
    const base = { ...a0, type: 'protocol', title: nm, category: 'fitness', timeOfDay: parts.length ? parts : ['morning'], notes: text.trim() }
    if (pattern === 'custom') {
      Object.assign(base, { frequency: 'custom', daysOfWeek: [], interval: Math.max(1, Number(num) || 1), intervalUnit: unit, seriesStart: start, seriesEnd: noEnd ? '' : end })
    } else if (usesDays(pattern)) {
      Object.assign(base, { frequency: pattern, daysOfWeek: [...days].sort((x, y) => x - y), interval: undefined, intervalUnit: undefined, seriesStart: start, seriesEnd: noEnd ? '' : end })
    } else {
      // daily / weekdays / weekends / quarterly — no day picker, no interval.
      Object.assign(base, { frequency: pattern, daysOfWeek: [], interval: undefined, intervalUnit: undefined, seriesStart: start, seriesEnd: noEnd ? '' : end })
    }
    onSave(base)
  }

  const chip = (on) => `px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
          <span className="kicker text-stone-400">{isNew ? 'New Workout' : 'Workout'}</span>
          <div className="flex items-center gap-4">
            {readOnly && <button onClick={() => setReadOnly(false)} className="text-sm text-stone-600 hover:text-stone-900">Edit</button>}
            <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={20} /></button>
          </div>
        </div>

        {readOnly ? (
          <div className="px-6 py-5 space-y-5">
            <div>
              <span className="kicker text-stone-400 mb-1.5 block">Name</span>
              <p className="font-serif text-2xl text-stone-900">{a0.title || 'Workout'}</p>
            </div>
            {workoutBody(a0).trim() && (
              <div>
                <span className="kicker text-stone-400 mb-1.5 block">Exercises</span>
                <p className="whitespace-pre-line text-sm leading-relaxed text-stone-600">{workoutBody(a0)}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <span className="kicker text-stone-400 mb-1 block">Time of day</span>
                <span className="text-sm text-stone-700">{(Array.isArray(a0.timeOfDay) && a0.timeOfDay.length ? a0.timeOfDay : [workoutPart(a0)]).map((p) => PART_LABEL[p]).join(', ')}</span>
              </div>
              <div>
                <span className="kicker text-stone-400 mb-1 block">Repeat</span>
                <span className="text-sm text-stone-700">{patternLabel(a0)}{daysStr ? ` · ${daysStr}` : ''}</span>
              </div>
              <div>
                <span className="kicker text-stone-400 mb-1 block">Series</span>
                <span className="text-sm text-stone-700">{fmtDate(a0.seriesStart)} · {a0.seriesEnd ? `ends ${fmtDate(a0.seriesEnd)}` : 'no end date'}</span>
              </div>
            </div>
          </div>
        ) : (
        <div className="px-6 py-5 space-y-5">
          <div>
            <span className="kicker text-stone-400 mb-1.5 block">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lower Power"
              className="w-full bg-transparent border-b border-stone-300 pb-1.5 font-serif text-2xl text-stone-900 placeholder-stone-300 outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <span className="kicker text-stone-400 mb-1.5 block">Exercises</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Squats: 4x5-8 (heavy), 2-3 min rest\nDeadlifts: 4x5 (heavy), 3 min rest\nHip thrusts: 4x8 (heavy), 90 sec rest'}
              className="w-full min-h-[160px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <span className="kicker text-stone-400 mb-2 block">Time of day</span>
            <div className="flex gap-1.5">
              {PARTS.map((p) => (
                <button key={p.id} type="button" onClick={() => togglePart(p.id)} className={chip(parts.includes(p.id))}>{p.label}</button>
              ))}
            </div>
            <p className="mt-1.5 text-xs italic text-stone-400">Pick one or more.</p>
          </div>

          <div>
            <span className="kicker text-stone-400 mb-2 block">Repeat</span>
            <div className="flex flex-wrap gap-1.5">
              {PATTERNS.map((f) => (
                <button key={f.id} type="button" onClick={() => setPattern(f.id)} className={chip(pattern === f.id)}>{f.label}</button>
              ))}
            </div>
            {pattern === 'custom' && (
              <div className="mt-3 flex items-center gap-2 text-sm text-stone-700">
                Every
                <input type="number" min="1" value={num} onChange={(e) => setNum(e.target.value)} className="w-14 bg-transparent border-b border-stone-300 pb-1 text-center outline-none focus:border-stone-900" />
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900">
                  {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {needDays && (
            <div>
              <span className="kicker text-stone-400 mb-2 block">On {pattern === 'monthlyday' ? 'weekday' : 'days'}</span>
              <div className="flex flex-wrap gap-1.5">
                {WD_CHIPS.map((w) => (
                  <button key={w.d} type="button" onClick={() => toggleDay(w.d)} className={`h-8 w-8 text-xs border transition-colors ${days.includes(w.d) ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{w.l}</button>
                ))}
              </div>
              {pattern === 'monthlyday' && <p className="mt-2 text-xs italic text-stone-400">Repeats monthly on the same week-of-month as the start date (e.g. 2nd Tuesday).</p>}
            </div>
          )}

          {isSeries(pattern) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="kicker text-stone-400 mb-1.5 block">Starts</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
              </div>
              <div>
                <span className="kicker text-stone-400 mb-1.5 block">Ends</span>
                <label className="mb-1.5 flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} /> No end date
                </label>
                {!noEnd && (
                  <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
                )}
              </div>
            </div>
          )}

          {!seriesValid && (
            <p className="text-xs italic text-phase-menstrual">Pick a start date, at least one day, and an end date (or “No end date”).</p>
          )}
        </div>
        )}

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? <span /> : <button onClick={onDelete} className="text-sm text-stone-400 hover:text-phase-menstrual">Delete</button>}
          <div className="flex items-center gap-3">
            {readOnly ? (
              <button onClick={onClose} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Close</button>
            ) : (
              <>
                <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
                <button onClick={submit} disabled={!canSave} className={`px-5 py-2 text-sm text-cream ${canSave ? 'bg-stone-900 hover:bg-stone-700' : 'bg-stone-300 cursor-not-allowed'}`}>Save</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
