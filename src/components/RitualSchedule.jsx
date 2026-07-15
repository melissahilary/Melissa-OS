import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import { parseKey } from '../lib/date'
import { useRegisterAdd } from './shared/AddButton'

const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday-first
const PARTS = [{ id: 'morning', label: 'AM' }, { id: 'evening', label: 'PM' }]
const FREQ_OPTS = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'daily', label: 'Daily' },
]

const firstLine = (t, fallback) => (t || '').split('\n').map((s) => s.trim()).find(Boolean) || fallback
const isRecurring = (a) => a.frequency !== 'asneeded' && a.frequency !== 'once'
const itemPart = (a) => ((a.timeOfDay || []).includes('evening') ? 'evening' : 'morning')
// Daily = every day, Mon–Sun. ('weekdays' is legacy — treat it as daily too.)
const freqOf = (a) => (a.frequency === 'daily' || a.frequency === 'weekdays' ? 'daily' : 'weekly')
// Manual drag order wins; items without an order fall to the end. Same field
// the home page (Today) sorts rituals by, so a reorder here is reflected there.
const byOrder = (a, b) => {
  const ao = a.order, bo = b.order
  if (ao != null && bo != null) return ao - bo
  if (ao != null) return -1
  if (bo != null) return 1
  return 0
}
// Which weekdays a recurring item lands on.
const recurWeekdays = (a) => {
  if (a.frequency === 'daily' || a.frequency === 'weekdays') return [0, 1, 2, 3, 4, 5, 6]
  if (Array.isArray(a.daysOfWeek) && a.daysOfWeek.length) return a.daysOfWeek
  if (a.seriesStart) return [parseKey(a.seriesStart).getDay()]
  return []
}

// A reusable weekly schedule with AM / PM columns per day. Each entry is a ritual
// protocol in `category` (AM → Morning Routine, PM → Evening Routine on Today).
// `noun` names the entry (e.g. "Treatment", "Step", "Practice") and `placeholder`
// hints the name field.
export default function RitualSchedule({ category = 'body', noun = 'Treatment', placeholder = '' }) {
  const { activities, add, update, remove, setOrder } = useActivities()
  const [editing, setEditing] = useState(null) // { weekday, activity }

  const items = activities.filter((a) => a.type === 'protocol' && a.category === category && a.status !== 'archived')
  const forDayPart = (wd, part) =>
    items
      .filter((a) => itemPart(a) === part && (isRecurring(a) ? recurWeekdays(a).includes(wd) : a.seriesStart && parseKey(a.seriesStart).getDay() === wd))
      .sort(byOrder)

  const openNew = (wd, part) => setEditing({ weekday: wd, activity: blankActivity('protocol', { category, frequency: 'weekly', daysOfWeek: [wd], timeOfDay: [part] }) })
  const openEdit = (a) => setEditing({ weekday: (a.daysOfWeek || [])[0] != null ? a.daysOfWeek[0] : (a.seriesStart ? parseKey(a.seriesStart).getDay() : 1), activity: a })
  const save = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  useRegisterAdd(() => openNew(new Date().getDay(), 'morning'), [category])

  return (
    <div className="mb-10 space-y-6">
      {WEEK.map((wd) => (
        <section key={wd} className="border-t border-stone-200 pt-4">
          <h3 className="font-serif italic text-2xl text-stone-900 mb-3">{DOW_LONG[wd]}</h3>
          <div className="grid grid-cols-2 gap-4">
            {PARTS.map((p) => (
              <DayColumn key={p.id} label={p.label} noun={noun} items={forDayPart(wd, p.id)} onAdd={() => openNew(wd, p.id)} onOpen={openEdit} onRemove={remove} onReorder={setOrder} />
            ))}
          </div>
        </section>
      ))}

      {editing && (
        <ItemForm
          entry={editing}
          noun={noun}
          placeholder={placeholder}
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

// A single AM or PM column. Rows are numbered and drag-to-reorder; a reorder
// rewrites the `order` field, which the home page also sorts by.
function DayColumn({ label, noun, items, onAdd, onOpen, onRemove, onReorder }) {
  const [drag, setDrag] = useState(null)
  const ids = items.map((i) => i.id)
  const dropBefore = (targetId) => {
    if (!drag || drag === targetId) { setDrag(null); return }
    const arr = ids.filter((id) => id !== drag)
    const at = arr.indexOf(targetId)
    arr.splice(at < 0 ? arr.length : at, 0, drag)
    onReorder(arr); setDrag(null)
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="kicker text-stone-400">{label}</span>
        <button onClick={onAdd} className="text-xs text-stone-400 hover:text-stone-900">Add</button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs italic text-stone-300">Nothing.</p>
      ) : (
        <div className="max-h-24 space-y-1 overflow-y-auto pr-1" onDragOver={(e) => e.preventDefault()}>
          {items.map((a, idx) => (
            <div
              key={a.id}
              draggable
              onDragStart={() => setDrag(a.id)}
              onDragEnd={() => setDrag(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.stopPropagation(); dropBefore(a.id) }}
              className={`group flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${drag === a.id ? 'opacity-40' : ''}`}
            >
              <span className="shrink-0 text-xs tabular-nums text-stone-400">{idx + 1}</span>
              <button onClick={() => onOpen(a)} className="min-w-0 flex-1 truncate text-left text-sm text-stone-700">{a.title || noun}</button>
              <button onClick={() => onRemove(a.id)} className="shrink-0 text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemForm({ entry, noun, placeholder, category, isNew, onSave, onDelete, onClose }) {
  const { weekday } = entry
  const [name, setName] = useState(entry.activity.title || '')
  const [text, setText] = useState(entry.activity.notes || '')
  const [part, setPart] = useState(itemPart(entry.activity))
  const [freq, setFreq] = useState(freqOf(entry.activity))

  const submit = () => {
    const nm = name.trim() || firstLine(text, noun)
    if (!nm) return
    const base = { ...entry.activity, title: nm, category, timeOfDay: [part], notes: text.trim() }
    if (freq === 'daily') Object.assign(base, { frequency: 'daily', daysOfWeek: [], seriesStart: '' })
    else Object.assign(base, { frequency: 'weekly', daysOfWeek: [weekday], seriesStart: '' })
    onSave(base)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
          <span className="kicker text-stone-400">{DOW_LONG[weekday]} · {noun.toLowerCase()}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <span className="kicker text-stone-400 mb-1.5 block">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder || noun}
              className="w-full bg-transparent border-b border-stone-300 pb-1.5 font-serif text-2xl text-stone-900 placeholder-stone-300 outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <span className="kicker text-stone-400 mb-1.5 block">Details</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="How to do it, how long…"
              className="w-full min-h-[110px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-stone-900"
            />
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
            <div className="flex flex-wrap gap-1.5">
              {FREQ_OPTS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFreq(f.id)} className={`px-2.5 py-1 text-xs border transition-colors ${freq === f.id ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>
                  {f.id === 'weekly' ? `Weekly · ${DOW_LONG[weekday]}` : f.label}
                </button>
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
