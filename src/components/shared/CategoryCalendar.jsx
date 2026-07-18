import React, { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import * as store from '../../lib/dataStore'
import { useActivities } from '../../hooks/useActivities'
import { blankActivity, activityOccursOn } from '../../lib/activities'
import { dateKey, parseKey, monthGrid, MONTHS, DOW, isSameDay, longDate } from '../../lib/date'
import { phaseForConfig, PHASES } from '../../lib/cycle'
import { useRegisterAdd } from './AddButton'

const PHASE_TINT = { menstrual: '#F4DEDE', follicular: '#E4EDE1', ovulation: '#F2E7CF', luteal: '#E4E0EC' }
const PARTS = [{ id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Evening' }]
const partOf = (a) => {
  const t = a.timeOfDay || []
  if (t.includes('evening')) return 'evening'
  if (t.includes('afternoon')) return 'afternoon'
  return 'morning'
}
const firstLine = (t, fallback) => (t || '').split('\n').map((s) => s.trim()).find(Boolean) || fallback

// Calendar occurrence check. A weekly / weekdays / weekends ritual with no end
// date is ongoing — it should land on EVERY matching weekday across the whole
// calendar, not just from the day it was created. Those frequencies recur purely
// by weekday, so we drop the start floor for them (still honoring any end date).
const occursOnCal = (a, k) => {
  const f = a.frequency
  if (!a.seriesEnd && (f === 'weekly' || f === 'weekdays' || f === 'weekends')) {
    const dows = f === 'weekly'
      ? (Array.isArray(a.daysOfWeek) && a.daysOfWeek.length ? a.daysOfWeek : (a.seriesStart ? [parseKey(a.seriesStart).getDay()] : []))
      : a.daysOfWeek
    return activityOccursOn({ ...a, seriesStart: '', daysOfWeek: dows }, k)
  }
  return activityOccursOn(a, k)
}

// The full recurrence set — matches the Fitness workout form so every Monthly
// subsection offers the same options.
const PATTERNS = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
]
const UNITS = [
  { id: 'day', label: 'days' },
  { id: 'week', label: 'weeks' },
  { id: 'month', label: 'months' },
  { id: 'quarter', label: 'quarters' },
  { id: 'year', label: 'years' },
]
// Weekday chips, Monday-first (value is JS getDay()).
const WD_CHIPS = [
  { d: 1, l: 'M' }, { d: 2, l: 'T' }, { d: 3, l: 'W' }, { d: 4, l: 'T' }, { d: 5, l: 'F' }, { d: 6, l: 'S' }, { d: 0, l: 'S' },
]
const usesDays = (p) => p === 'weekly' || p === 'biweekly'
const initialPattern = (a) => {
  const f = a.frequency
  if (f === 'daily') return 'daily'
  if (f === 'weekdays') return 'weekdays'
  if (f === 'weekends') return 'weekends'
  if (f === 'weekly' || f === '2x' || f === '3x' || f === 'specific') return 'weekly'
  if (f === 'biweekly' || f === 'nweeks') return 'biweekly'
  if (f === 'monthly' || f === 'monthlyday') return 'monthly'
  if (f === 'quarterly') return 'quarterly'
  if (f === 'yearly') return 'yearly'
  if (f === 'custom') return 'custom'
  return 'once'
}

// A real, navigable month calendar for one category. Days carry the cycle phase
// overlay; clicking a day lists everything scheduled that day by time of day.
// Weekly items from the same category populate here automatically. Navigation is
// floored at the account's signup month and open-ended into the future.
export default function CategoryCalendar({ category, cycleConfig = {}, noun = 'Item' }) {
  const { activities, add, update, remove } = useActivities()
  const today = new Date()
  const todayKey = dateKey(today)

  const [st, setSt] = useState(store.getStatus())
  useEffect(() => store.subscribeStatus(setSt), [])
  const signupKey = st.createdAt ? dateKey(new Date(st.createdAt)) : ''

  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [editing, setEditing] = useState(null)

  const items = useMemo(
    () => activities.filter((a) => a.type === 'protocol' && a.category === category && a.status !== 'archived'),
    [activities, category],
  )
  const forDay = (k) => items.filter((a) => occursOnCal(a, k))
  const beforeSignup = (k) => signupKey && k < signupKey

  const signupYear = signupKey ? parseKey(signupKey).getFullYear() : today.getFullYear() - 1
  const years = []
  for (let y = signupYear; y <= today.getFullYear() + 10; y++) years.push(y)
  const signupMonthStart = signupKey ? new Date(parseKey(signupKey).getFullYear(), parseKey(signupKey).getMonth(), 1) : null
  const atFloor = signupMonthStart && month <= signupMonthStart

  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const setYM = (y, mo) => setMonth(new Date(y, mo, 1))

  const cells = monthGrid(month)

  const openNew = (k) => setEditing({ dayKey: k, activity: blankActivity('protocol', { category, frequency: 'asneeded', timeOfDay: ['morning'], seriesStart: k }) })
  const openEdit = (a) => setEditing({ dayKey: a.seriesStart || selectedKey, activity: a })
  const save = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }
  useRegisterAdd(() => openNew(selectedKey), [selectedKey])

  const dayItems = forDay(selectedKey)

  return (
    <div className="mb-10">
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => !atFloor && shift(-1)} disabled={atFloor} className={`px-3 py-1 text-base ${atFloor ? 'text-stone-200' : 'text-stone-500 hover:text-stone-900'}`}>‹</button>
        <div className="flex items-center gap-2">
          <select value={month.getMonth()} onChange={(e) => setYM(month.getFullYear(), Number(e.target.value))} className="appearance-none bg-transparent font-serif text-lg text-stone-900 outline-none">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={month.getFullYear()} onChange={(e) => setYM(Number(e.target.value), month.getMonth())} className="appearance-none bg-transparent font-serif text-lg text-stone-900 outline-none">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={() => shift(1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">›</button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border-l border-t border-stone-200">
        {DOW.map((d) => <div key={d} className="border-b border-r border-stone-200 px-1 py-1.5 text-center kicker text-stone-400">{d[0]}</div>)}
        {cells.map((cell) => {
          const k = dateKey(cell)
          const inMonth = cell.getMonth() === month.getMonth()
          const locked = beforeSignup(k)
          const isSel = k === selectedKey
          const isTod = isSameDay(cell, today)
          const phase = phaseForConfig(cycleConfig, cell)
          const tint = phase ? PHASE_TINT[phase.id] : undefined
          const count = inMonth && !locked ? forDay(k).length : 0
          return (
            <button
              key={k}
              onClick={() => !locked && setSelectedKey(k)}
              disabled={locked}
              style={inMonth && !locked && tint ? { backgroundColor: tint } : undefined}
              className={`relative min-h-[62px] border-b border-r border-stone-200 px-1.5 py-1 text-left align-top transition-colors ${locked ? 'bg-stone-50 text-stone-300' : inMonth ? 'text-stone-700 hover:brightness-95' : 'text-stone-300'} ${isSel && !locked ? 'ring-1 ring-inset ring-stone-900' : ''}`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center text-xs ${isTod ? 'rounded-full bg-stone-900 text-cream' : ''}`}>{cell.getDate()}</span>
              {count > 0 && (
                <span className="mt-1 flex flex-wrap gap-0.5">
                  {Array.from({ length: Math.min(count, 4) }).map((_, i) => <span key={i} className="h-1 w-1 rounded-full bg-stone-500" />)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Phase legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {['menstrual', 'follicular', 'ovulation', 'luteal'].map((id) => (
          <span key={id} className="flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-stone-500">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: id === 'menstrual' ? PHASES.menstrual.color : PHASE_TINT[id] }} />
            {id === 'ovulation' ? 'Ovulatory' : id.charAt(0).toUpperCase() + id.slice(1)}
          </span>
        ))}
      </div>

      {/* Selected day detail */}
      <section className="mt-8 border-t border-stone-200 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif italic text-2xl text-stone-900">{longDate(parseKey(selectedKey))}</h3>
        </div>
        {dayItems.length === 0 ? (
          <p className="text-sm italic text-stone-400">Nothing scheduled.</p>
        ) : (
          <div className="space-y-5">
            {PARTS.map((pt) => {
              const list = dayItems.filter((a) => partOf(a) === pt.id)
              if (!list.length) return null
              return (
                <div key={pt.id}>
                  <p className="kicker text-stone-400 mb-2">{pt.label}</p>
                  <div className="space-y-2">
                    {list.map((a) => (
                      <div key={a.id} className="group flex items-start gap-3 border border-stone-200 bg-white/40 px-4 py-2.5">
                        <button onClick={() => openEdit(a)} className="min-w-0 flex-1 text-left">
                          <p className="text-sm text-stone-800">{a.title || noun}</p>
                          {a.notes && a.notes.trim() && <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-stone-500">{a.notes}</p>}
                        </button>
                        <button onClick={() => remove(a.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {editing && (
        <DayItemForm
          entry={editing}
          noun={noun}
          category={category}
          isNew={!activities.some((x) => x.id === editing.activity.id)}
          onSave={save}
          onDelete={() => { remove(editing.activity.id); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function DayItemForm({ entry, noun, category, isNew, onSave, onDelete, onClose }) {
  const dayKey = entry.dayKey
  const a0 = entry.activity
  const [name, setName] = useState(a0.title || '')
  const [text, setText] = useState(a0.notes || '')
  const [part, setPart] = useState(partOf(a0))
  const [pattern, setPattern] = useState(initialPattern(a0))
  const [days, setDays] = useState(Array.isArray(a0.daysOfWeek) && a0.daysOfWeek.length ? a0.daysOfWeek : [parseKey(dayKey).getDay()])
  const [num, setNum] = useState(a0.interval && a0.interval > 0 ? a0.interval : 2)
  const [unit, setUnit] = useState(a0.intervalUnit || 'week')
  const [start, setStart] = useState(a0.seriesStart || dayKey)
  const [end, setEnd] = useState(a0.seriesEnd || '')
  const [noEnd, setNoEnd] = useState(!a0.seriesEnd)

  const toggleDay = (d) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
  const recurring = pattern !== 'once'
  const needDays = usesDays(pattern)
  const customValid = pattern !== 'custom' || (Number(num) >= 1 && !!unit)
  const seriesValid = !!start && (!needDays || days.length > 0) && (!recurring || noEnd || !!end) && customValid
  const canSave = (name.trim() || firstLine(text, '')) && seriesValid

  const submit = () => {
    if (!canSave) return
    const nm = name.trim() || firstLine(text, noun)
    const startK = start || dayKey
    const base = { ...a0, title: nm, category, timeOfDay: [part], notes: text.trim() }
    if (pattern === 'once') {
      Object.assign(base, { frequency: 'asneeded', daysOfWeek: [], interval: undefined, intervalUnit: undefined, seriesStart: startK, seriesEnd: '' })
    } else if (pattern === 'custom') {
      Object.assign(base, { frequency: 'custom', daysOfWeek: [], interval: Math.max(1, Number(num) || 1), intervalUnit: unit, seriesStart: startK, seriesEnd: noEnd ? '' : end })
    } else if (usesDays(pattern)) {
      // Weekly with no end date is ongoing — leave the start empty so it recurs on
      // every matching weekday across the calendar (bi-weekly keeps its anchor).
      const ongoing = pattern === 'weekly' && noEnd
      Object.assign(base, { frequency: pattern, daysOfWeek: [...days].sort((x, y) => x - y), interval: undefined, intervalUnit: undefined, seriesStart: ongoing ? '' : startK, seriesEnd: noEnd ? '' : end })
    } else {
      // Daily / weekdays / weekends / monthly / quarterly / yearly. Weekday-based
      // ongoing patterns don't need a start floor.
      const ongoing = (pattern === 'weekdays' || pattern === 'weekends') && noEnd
      Object.assign(base, { frequency: pattern, daysOfWeek: [], interval: undefined, intervalUnit: undefined, seriesStart: ongoing ? '' : startK, seriesEnd: noEnd ? '' : end })
    }
    onSave(base)
  }

  const chip = (on) => `px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
          <span className="kicker text-stone-400">{longDate(parseKey(dayKey))}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>
        <div className="max-h-[64vh] overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <span className="kicker text-stone-400 mb-1.5 block">Name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={noun} className="w-full bg-transparent border-b border-stone-300 pb-1.5 font-serif text-2xl text-stone-900 placeholder-stone-300 outline-none focus:border-stone-900" />
          </div>
          <div>
            <span className="kicker text-stone-400 mb-1.5 block">Details</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Notes…" className="w-full min-h-[100px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-stone-900" />
          </div>
          <div>
            <span className="kicker text-stone-400 mb-2 block">Time of day</span>
            <div className="flex gap-1.5">
              {PARTS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPart(p.id)} className={chip(part === p.id)}>{p.label}</button>
              ))}
            </div>
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
              <span className="kicker text-stone-400 mb-2 block">On days</span>
              <div className="flex flex-wrap gap-1.5">
                {WD_CHIPS.map((w) => (
                  <button key={w.d} type="button" onClick={() => toggleDay(w.d)} className={`h-8 w-8 text-xs border transition-colors ${days.includes(w.d) ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{w.l}</button>
                ))}
              </div>
            </div>
          )}

          {recurring && (
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
            <p className="text-xs italic text-phase-menstrual">Pick a start date{needDays ? ', at least one day,' : ''} and an end date (or “No end date”).</p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? <span /> : <button onClick={onDelete} className="text-sm text-stone-400 hover:text-phase-menstrual">Delete</button>}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button onClick={submit} disabled={!canSave} className={`px-5 py-2 text-sm text-cream ${canSave ? 'bg-stone-900 hover:bg-stone-700' : 'bg-stone-300 cursor-not-allowed'}`}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
