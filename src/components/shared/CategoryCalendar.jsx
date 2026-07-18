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
const REPEATS = [{ id: 'once', label: 'Once' }, { id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }]

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
  const forDay = (k) => items.filter((a) => activityOccursOn(a, k))
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
          <button onClick={() => openNew(selectedKey)} className="text-sm text-stone-500 hover:text-stone-900">Add</button>
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
  const [repeat, setRepeat] = useState(a0.frequency === 'weekly' ? 'weekly' : a0.frequency === 'monthly' ? 'monthly' : 'once')

  const submit = () => {
    const nm = name.trim() || firstLine(text, noun)
    if (!nm) return
    const base = { ...a0, title: nm, category, timeOfDay: [part], notes: text.trim() }
    if (repeat === 'weekly') Object.assign(base, { frequency: 'weekly', daysOfWeek: [parseKey(dayKey).getDay()], seriesStart: dayKey })
    else if (repeat === 'monthly') Object.assign(base, { frequency: 'monthly', daysOfWeek: [], seriesStart: dayKey })
    else Object.assign(base, { frequency: 'asneeded', daysOfWeek: [], seriesStart: dayKey })
    onSave(base)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
          <span className="kicker text-stone-400">{longDate(parseKey(dayKey))}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
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
                <button key={p.id} type="button" onClick={() => setPart(p.id)} className={`px-2.5 py-1 text-xs border transition-colors ${part === p.id ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="kicker text-stone-400 mb-2 block">Repeat</span>
            <div className="flex gap-1.5">
              {REPEATS.map((r) => (
                <button key={r.id} type="button" onClick={() => setRepeat(r.id)} className={`px-2.5 py-1 text-xs border transition-colors ${repeat === r.id ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{r.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? <span /> : <button onClick={onDelete} className="text-sm text-stone-400 hover:text-phase-menstrual">Delete</button>}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button onClick={submit} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
