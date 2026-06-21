import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DOW_LONG, monthGrid, dateKey, parseKey, isSameDay, MONTHS, DOW, moonPhaseIndex } from '../lib/date'
import MoonIcon from './shared/MoonIcon'
import InlineText from './shared/InlineText'
import Recipes, { HAIRCARE_RECIPES_CONFIG } from './Recipes'

const uid = () => Math.random().toString(36).slice(2, 10)

// Full set of Manifestations subsections (Overview removed).
export const DREAM_PAGES = [
  { id: 'goals', label: 'Goals' },
  { id: 'week', label: 'Dream Week' },
  { id: 'calendar', label: 'Dream Calendar' },
  { id: 'outings', label: 'Dream Outings' },
  { id: 'skincare', label: 'Dream Skincare' },
  { id: 'wardrobe', label: 'Dream Wardrobe' },
  { id: 'devices', label: 'Dream Cars' },
  { id: 'home', label: 'Dream Home' },
  { id: 'investments', label: 'Dream Investments & Assets' },
  { id: 'haircare', label: 'Dream Haircare' },
]

// Fixed (non-reorderable) pages, shown first and in this order.
export const DREAM_FIXED = ['goals', 'week', 'calendar']
// Draggable-to-reorder pages, default order.
export const DREAM_REORDER = ['outings', 'skincare', 'wardrobe', 'devices', 'home', 'investments', 'haircare']

const CATEGORIES = [
  { id: 'personal', label: 'Personal', color: '#B8849A' },
  { id: 'work', label: 'Work', color: '#5A6B7B' },
  { id: 'wellness', label: 'Wellness', color: '#7B8B5F' },
  { id: 'social', label: 'Social', color: '#C4A882' },
]
const FREQS = ['once', 'daily', 'weekly', 'monthly', 'yearly']

export default function DreamWorld({ page, cycleConfig }) {
  return (
    <div>
      {page === 'goals' && <ListPage storageKey="mos:dream:goals" placeholder="A goal worth the climb" checkable />}
      {page === 'week' && <DreamWeek />}
      {page === 'calendar' && <DreamCalendar />}
      {page === 'outings' && <ListPage storageKey="mos:dream:outings" placeholder="A restaurant, trip, or experience to do" checkable />}
      {page === 'skincare' && <ListPage storageKey="mos:dream:skincare" placeholder="A step in the routine" checkable />}
      {page === 'wardrobe' && <ListPage storageKey="mos:dream:wardrobe" placeholder="A piece to acquire" checkable />}
      {page === 'devices' && <ListPage storageKey="mos:dream:devices" placeholder="A car on the wishlist" checkable />}
      {page === 'home' && <ListPage storageKey="mos:dream:home" placeholder="Something for the home" checkable />}
      {page === 'investments' && <ListPage storageKey="mos:dream:investments" placeholder="An asset or investment to acquire" checkable />}
      {page === 'haircare' && <ListPage storageKey="mos:dream:haircare" placeholder="A product or step for hair" checkable />}
      {page === 'haircare-recipes' && <Recipes config={HAIRCARE_RECIPES_CONFIG} />}
    </div>
  )
}

function DreamWeek() {
  const [week, setWeek] = useLocalStorage('mos:dream:week', {})
  const add = (day, text) => {
    if (!text.trim()) return
    setWeek((w) => ({ ...w, [day]: [...(w[day] || []), { id: uid(), text: text.trim() }] }))
  }
  const edit = (day, id, text) =>
    setWeek((w) => ({ ...w, [day]: (w[day] || []).map((x) => (x.id === id ? { ...x, text } : x)) }))
  const remove = (day, id) => setWeek((w) => ({ ...w, [day]: (w[day] || []).filter((x) => x.id !== id) }))

  return (
    <section>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DOW_LONG.map((day) => (
          <DayCol key={day} day={day} items={week[day] || []} onAdd={(t) => add(day, t)} onEdit={(id, t) => edit(day, id, t)} onRemove={(id) => remove(day, id)} />
        ))}
      </div>
    </section>
  )
}

function DayCol({ day, items, onAdd, onEdit, onRemove }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    onAdd(draft)
    setDraft('')
  }
  return (
    <div className="border-t border-stone-300 pt-3">
      <p className="kicker text-stone-500 mb-2">{day}</p>
      <div className="space-y-1">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-2">
            <InlineText value={it.text} onChange={(t) => onEdit(it.id, t)} className="flex-1 text-sm text-stone-700 bg-transparent outline-none" />
            <button onClick={() => onRemove(it.id)} className="hidden text-stone-300 hover:text-stone-700 group-hover:block"><X size={13} /></button>
          </div>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        placeholder="Add"
        className="mt-1.5 w-full bg-transparent border-b border-stone-200 pb-1 text-sm outline-none focus:border-stone-900"
      />
    </div>
  )
}

// Normalize an event from old ({id,text}) or new shape.
const normEvent = (ev) => ({
  id: ev.id,
  title: ev.title != null ? ev.title : ev.text || '',
  time: ev.time || '',
  frequency: ev.frequency || 'once',
  description: ev.description || '',
  attendees: ev.attendees || '',
  category: ev.category || 'personal',
  done: !!ev.done,
})

const timeOf = (ev) => ev.time || ''
const partOfDay = (ev) => {
  const t = ev.time
  if (!t) return 'morning'
  const h = parseInt(t.slice(0, 2), 10)
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
const byTime = (a, b) => {
  const ta = timeOf(a), tb = timeOf(b)
  if (!ta && !tb) return 0
  if (!ta) return -1
  if (!tb) return 1
  return ta.localeCompare(tb)
}

function DreamCalendar() {
  const [events, setEvents] = useLocalStorage('mos:dream:events', {})
  const today = new Date()
  const [view, setView] = useState('month')
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [anchor, setAnchor] = useState(dateKey(today))
  const [detail, setDetail] = useState(null) // { key, id }

  const dayEvents = (key) => (events[key] || []).map(normEvent)

  const addEvent = (key) => {
    const ev = { id: uid(), title: '', time: '', frequency: 'once', description: '', attendees: '', category: 'personal', done: false }
    setEvents((p) => ({ ...p, [key]: [...(p[key] || []), ev] }))
    setDetail({ key, id: ev.id })
  }
  const updateEvent = (key, id, patch) =>
    setEvents((p) => ({ ...p, [key]: (p[key] || []).map((e) => (e.id === id ? { ...normEvent(e), ...patch } : e)) }))
  const removeEvent = (key, id) => {
    setEvents((p) => ({ ...p, [key]: (p[key] || []).filter((e) => e.id !== id) }))
    setDetail(null)
  }
  const toggleDone = (key, id) =>
    setEvents((p) => ({ ...p, [key]: (p[key] || []).map((e) => (e.id === id ? { ...normEvent(e), done: !normEvent(e).done } : e)) }))

  const cells = monthGrid(calMonth)
  const anchorDate = parseKey(anchor)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = parseKey(anchor)
    d.setDate(d.getDate() - d.getDay() + i)
    return d
  })

  // Moon strip across the visible week containing today.
  const moonWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - d.getDay() + i)
    return d
  })

  const catColor = (id) => CATEGORIES.find((c) => c.id === id)?.color
  const shiftAnchor = (days) => {
    const d = parseKey(anchor)
    d.setDate(d.getDate() + days)
    setAnchor(dateKey(d))
  }

  return (
    <section>
      {/* Moon phase strip */}
      <div className="mb-6 flex flex-wrap items-center gap-4 border-y border-stone-200 py-3">
        {moonWeek.map((d) => (
          <div key={dateKey(d)} className="flex items-center gap-2">
            <MoonIcon index={moonPhaseIndex(d)} size={16} />
            <span className="kicker text-stone-400">{DOW[d.getDay()]} {d.getDate()}</span>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="mb-4 flex gap-1">
        {['month', 'week', 'day'].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-sm capitalize transition-colors ${view === v ? 'bg-stone-900 text-cream' : 'text-stone-600 hover:bg-stone-100'}`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'month' && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-2xl text-stone-900">{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}</h3>
            <div className="flex gap-2">
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="text-sm text-stone-500 hover:text-stone-900">Prev</button>
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="text-sm text-stone-500 hover:text-stone-900">Next</button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-l border-t border-stone-200">
            {DOW.map((d) => (
              <div key={d} className="border-b border-r border-stone-200 px-2 py-1.5 text-center kicker text-stone-400">{d[0]}</div>
            ))}
            {cells.map((cell) => {
              const key = dateKey(cell)
              const inMonth = cell.getMonth() === calMonth.getMonth()
              const isTod = isSameDay(cell, today)
              const evs = dayEvents(key)
              return (
                <div key={key} className={`group relative min-h-[70px] border-b border-r border-stone-200 px-1.5 py-1 ${inMonth ? '' : 'bg-stone-50'}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center text-xs ${isTod ? 'bg-stone-900 text-cream rounded-full' : inMonth ? 'text-stone-700' : 'text-stone-300'}`}>{cell.getDate()}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {evs.map((ev) => (
                      <button key={ev.id} onClick={() => setDetail({ key, id: ev.id })} className="flex w-full items-center gap-1 text-left">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(ev.category) }} />
                        <span className={`truncate text-[10px] ${ev.done ? 'text-stone-400 line-through' : 'text-stone-600'}`}>{ev.title || 'Untitled'}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => addEvent(key)} className="absolute right-1 top-1 hidden text-stone-300 hover:text-stone-900 group-hover:block"><Plus size={13} /></button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {view === 'week' && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-2xl text-stone-900">Week of {MONTHS[weekDays[0].getMonth()]} {weekDays[0].getDate()}</h3>
            <div className="flex gap-2">
              <button onClick={() => shiftAnchor(-7)} className="text-sm text-stone-500 hover:text-stone-900">Prev</button>
              <button onClick={() => setAnchor(dateKey(today))} className="text-sm text-stone-500 hover:text-stone-900">Today</button>
              <button onClick={() => shiftAnchor(7)} className="text-sm text-stone-500 hover:text-stone-900">Next</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-7">
            {weekDays.map((d) => {
              const key = dateKey(d)
              const isTod = isSameDay(d, today)
              const evs = dayEvents(key).sort(byTime)
              return (
                <div key={key} className="group border-t border-stone-300 pt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className={`kicker ${isTod ? 'text-stone-900' : 'text-stone-500'}`}>{DOW[d.getDay()]} {d.getDate()}</p>
                    <button onClick={() => addEvent(key)} className="hidden text-stone-300 hover:text-stone-900 group-hover:block"><Plus size={13} /></button>
                  </div>
                  <div className="space-y-1">
                    {evs.map((ev) => (
                      <button key={ev.id} onClick={() => setDetail({ key, id: ev.id })} className="flex w-full items-center gap-1.5 text-left">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(ev.category) }} />
                        {ev.time && <span className="text-[10px] text-stone-400">{ev.time}</span>}
                        <span className={`truncate text-xs ${ev.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{ev.title || 'Untitled'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {view === 'day' && (
        <DayView
          anchor={anchor}
          anchorDate={anchorDate}
          today={today}
          events={dayEvents(anchor)}
          catColor={catColor}
          onShift={shiftAnchor}
          onToday={() => setAnchor(dateKey(today))}
          onAdd={() => addEvent(anchor)}
          onToggle={(id) => toggleDone(anchor, id)}
          onOpen={(id) => setDetail({ key: anchor, id })}
        />
      )}

      {detail && (() => {
        const ev = dayEvents(detail.key).find((e) => e.id === detail.id)
        if (!ev) return null
        return (
          <EventDetail
            ev={ev}
            dateLabel={detail.key}
            onChange={(patch) => updateEvent(detail.key, detail.id, patch)}
            onDelete={() => removeEvent(detail.key, detail.id)}
            onClose={() => setDetail(null)}
          />
        )
      })()}
    </section>
  )
}

function DayView({ anchor, anchorDate, today, events, catColor, onShift, onToday, onAdd, onToggle, onOpen }) {
  const groups = [
    { id: 'morning', label: 'Morning' },
    { id: 'afternoon', label: 'Afternoon' },
    { id: 'evening', label: 'Evening' },
  ]
  const sorted = [...events].sort(byTime)
  const isTod = isSameDay(anchorDate, today)
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-2xl text-stone-900">
          {DOW[anchorDate.getDay()]}, {MONTHS[anchorDate.getMonth()]} {anchorDate.getDate()}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => onShift(-1)} className="text-sm text-stone-500 hover:text-stone-900">Prev</button>
          <button onClick={onToday} className="text-sm text-stone-500 hover:text-stone-900">Today</button>
          <button onClick={() => onShift(1)} className="text-sm text-stone-500 hover:text-stone-900">Next</button>
          <button onClick={onAdd} className="bg-stone-900 px-2 py-1 text-cream hover:bg-stone-700"><Plus size={15} /></button>
        </div>
      </div>
      <div className="space-y-7">
        {groups.map((g) => {
          const evs = sorted.filter((e) => partOfDay(e) === g.id)
          return (
            <div key={g.id} className="border-t border-stone-300 pt-3">
              <p className="kicker text-stone-500 mb-3">{g.label}</p>
              {evs.length === 0 ? (
                <p className="text-sm text-stone-300">Nothing yet.</p>
              ) : (
                <div className="space-y-2">
                  {evs.map((ev) => (
                    <div key={ev.id} className="group flex items-center gap-3">
                      <button
                        onClick={() => onToggle(ev.id)}
                        className={`h-4 w-4 shrink-0 border ${ev.done ? 'bg-stone-900 border-stone-900' : 'border-stone-400'}`}
                      />
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(ev.category) }} />
                      {ev.time && <span className="text-xs text-stone-400 w-12 shrink-0">{ev.time}</span>}
                      <button onClick={() => onOpen(ev.id)} className={`flex-1 text-left text-sm ${ev.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
                        {ev.title || 'Untitled'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function EventDetail({ ev, dateLabel, onChange, onDelete, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-cream border border-stone-300 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <span className="kicker text-stone-400">{dateLabel}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>

        <input
          value={ev.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title"
          className="mb-4 w-full bg-transparent border-b border-stone-300 pb-1.5 font-serif text-2xl text-stone-900 outline-none focus:border-stone-900"
        />

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="kicker text-stone-400 mb-1 block">Time</span>
            <input type="time" value={ev.time} onChange={(e) => onChange({ time: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 outline-none focus:border-stone-900" />
          </label>

          <label className="block">
            <span className="kicker text-stone-400 mb-1 block">Frequency</span>
            <select value={ev.frequency} onChange={(e) => onChange({ frequency: e.target.value })} className="w-full bg-transparent border-b border-stone-300 pb-1 capitalize outline-none focus:border-stone-900">
              {FREQS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="kicker text-stone-400 mb-1 block">Description</span>
            <textarea value={ev.description} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="w-full bg-transparent border border-stone-300 px-2 py-1 outline-none focus:border-stone-900" />
          </label>

          <label className="block">
            <span className="kicker text-stone-400 mb-1 block">Attendees</span>
            <input value={ev.attendees} onChange={(e) => onChange({ attendees: e.target.value })} placeholder="Comma separated" className="w-full bg-transparent border-b border-stone-300 pb-1 outline-none focus:border-stone-900" />
          </label>

          <label className="block">
            <span className="kicker text-stone-400 mb-1 block">Category</span>
            <select value={ev.category} onChange={(e) => onChange({ category: e.target.value })} className="w-full bg-transparent border-b border-stone-300 pb-1 outline-none focus:border-stone-900">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={onDelete} className="text-sm text-stone-500 hover:text-stone-900">Delete</button>
          <button onClick={onClose} className="bg-stone-900 px-4 py-2 text-sm text-cream hover:bg-stone-700">Save</button>
        </div>
      </div>
    </div>
  )
}

// Generic list page used by goals / outings / skincare / wardrobe / cars / home / etc.
function ListPage({ storageKey, placeholder, checkable }) {
  const [items, setItems] = useLocalStorage(storageKey, [])
  return <ListBody placeholder={placeholder} items={items} setItems={setItems} checkable={checkable} />
}

function ListBody({ placeholder, items, setItems, checkable }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    if (!draft.trim()) return
    setItems((prev) => [...prev, { id: uid(), text: draft.trim(), done: false }])
    setDraft('')
  }
  const toggle = (id) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))
  const editText = (id, text) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, text } : x)))
  const remove = (id) => setItems((prev) => prev.filter((x) => x.id !== id))

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={add} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700"><Plus size={16} /></button>
      </div>
      <div className="divide-y divide-stone-100">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-3 py-2.5">
            {checkable && (
              <button onClick={() => toggle(it.id)} className={`h-4 w-4 shrink-0 border ${it.done ? 'bg-stone-900 border-stone-900' : 'border-stone-400'}`} />
            )}
            <InlineText
              value={it.text}
              onChange={(t) => editText(it.id, t)}
              className={`flex-1 text-sm bg-transparent outline-none ${it.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}
            />
            <button onClick={() => remove(it.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  )
}
