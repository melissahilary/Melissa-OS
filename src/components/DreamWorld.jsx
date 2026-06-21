import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DOW_LONG, monthGrid, dateKey, isSameDay, MONTHS, DOW, moonPhaseIndex } from '../lib/date'
import MoonIcon from './shared/MoonIcon'

const uid = () => Math.random().toString(36).slice(2, 10)

export const DREAM_PAGES = [
  { id: 'overview', label: 'Overview' },
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

const Cursive = ({ children, className = '' }) => (
  <span className={className} style={{ fontFamily: "'Pinyon Script', cursive" }}>{children}</span>
)

export default function DreamWorld({ page, cycleConfig }) {
  return (
    <div>
      <header className="mb-8">
        <Cursive className="text-5xl md:text-6xl text-stone-900 leading-tight">Dream World</Cursive>
      </header>
      {page === 'overview' && <Overview />}
      {page === 'goals' && <ListPage storageKey="mos:dream:goals" title="Goals." kicker="What I'm building toward" placeholder="A goal worth the climb" checkable />}
      {page === 'week' && <DreamWeek />}
      {page === 'calendar' && <DreamCalendar />}
      {page === 'outings' && <ListPage storageKey="mos:dream:outings" title="Dream Outings." kicker="Places, trips, experiences" placeholder="A restaurant, trip, or experience to do" checkable />}
      {page === 'skincare' && <ListPage storageKey="mos:dream:skincare" title="Dream Skincare." kicker="The ritual" placeholder="A step in the routine" checkable />}
      {page === 'wardrobe' && <ListPage storageKey="mos:dream:wardrobe" title="Dream Wardrobe." kicker="The closet" placeholder="A piece to acquire" checkable />}
      {page === 'devices' && <ListPage storageKey="mos:dream:devices" title="Dream Cars." kicker="The garage" placeholder="A car on the wishlist" checkable />}
      {page === 'home' && <ListPage storageKey="mos:dream:home" title="Dream Home." kicker="The space" placeholder="Something for the home" checkable />}
      {page === 'investments' && <ListPage storageKey="mos:dream:investments" title="Dream Investments & Assets." kicker="What I'm building" placeholder="An asset or investment to acquire" checkable />}
      {page === 'haircare' && <ListPage storageKey="mos:dream:haircare" title="Dream Haircare." kicker="The ritual" placeholder="A product or step for hair" checkable />}
    </div>
  )
}

function Overview() {
  const [commitments, setCommitments] = useLocalStorage('mos:dream:commitments', [])
  return (
    <div className="space-y-10">
      <p className="max-w-2xl font-serif italic text-2xl text-stone-600 leading-snug">
        Lifestyle design, moodboard, asset planning, habit tracker, and more.
      </p>
      <ListBody
        title="Commitments."
        kicker="What I'm holding to"
        placeholder="A standard I keep"
        items={commitments}
        setItems={setCommitments}
        checkable
      />
    </div>
  )
}

function DreamWeek() {
  const [week, setWeek] = useLocalStorage('mos:dream:week', {})
  const add = (day, text) => {
    if (!text.trim()) return
    setWeek((w) => ({ ...w, [day]: [...(w[day] || []), { id: uid(), text: text.trim() }] }))
  }
  const remove = (day, id) => setWeek((w) => ({ ...w, [day]: (w[day] || []).filter((x) => x.id !== id) }))

  return (
    <section>
      <p className="kicker text-stone-400 mb-2">The ideal rhythm</p>
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-6">Dream Week.</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DOW_LONG.map((day) => (
          <DayCol key={day} day={day} items={week[day] || []} onAdd={(t) => add(day, t)} onRemove={(id) => remove(day, id)} />
        ))}
      </div>
    </section>
  )
}

function DayCol({ day, items, onAdd, onRemove }) {
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
            <span className="flex-1 text-sm text-stone-700">{it.text}</span>
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

function DreamCalendar() {
  const [events, setEvents] = useLocalStorage('mos:dream:events', {})
  const today = new Date()
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [adding, setAdding] = useState(null)
  const [draft, setDraft] = useState('')
  const cells = monthGrid(calMonth)

  const add = (key) => {
    if (!draft.trim()) return
    setEvents((p) => ({ ...p, [key]: [...(p[key] || []), { id: uid(), text: draft.trim() }] }))
    setDraft('')
    setAdding(null)
  }
  const remove = (key, id) => setEvents((p) => ({ ...p, [key]: (p[key] || []).filter((e) => e.id !== id) }))

  // Moon strip across the visible week containing today.
  const moonWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - d.getDay() + i)
    return d
  })

  return (
    <section>
      <p className="kicker text-stone-400 mb-2">The month ahead</p>
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-5">Dream Calendar.</h2>

      {/* Moon phase strip */}
      <div className="mb-6 flex flex-wrap items-center gap-4 border-y border-stone-200 py-3">
        {moonWeek.map((d) => (
          <div key={dateKey(d)} className="flex items-center gap-2">
            <MoonIcon index={moonPhaseIndex(d)} size={16} />
            <span className="kicker text-stone-400">{DOW[d.getDay()]} {d.getDate()}</span>
          </div>
        ))}
      </div>

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
          const dayEvents = events[key] || []
          return (
            <div key={key} className={`group relative min-h-[70px] border-b border-r border-stone-200 px-1.5 py-1 ${inMonth ? '' : 'bg-stone-50'}`}>
              <span className={`inline-flex h-6 w-6 items-center justify-center text-xs ${isTod ? 'bg-stone-900 text-cream rounded-full' : inMonth ? 'text-stone-700' : 'text-stone-300'}`}>{cell.getDate()}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.map((ev) => (
                  <div key={ev.id} className="group/ev flex items-center gap-1">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mauve" />
                    <span className="truncate text-[10px] text-stone-600">{ev.text}</span>
                    <button onClick={() => remove(key, ev.id)} className="ml-auto hidden text-stone-300 hover:text-stone-700 group-hover/ev:block"><X size={10} /></button>
                  </div>
                ))}
              </div>
              {adding === key ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') add(key)
                    if (e.key === 'Escape') setAdding(null)
                  }}
                  placeholder="Event"
                  className="mt-1 w-full bg-white border border-stone-300 px-1 py-0.5 text-[10px] outline-none"
                />
              ) : (
                <button onClick={() => { setAdding(key); setDraft('') }} className="absolute right-1 top-1 hidden text-stone-300 hover:text-stone-900 group-hover:block"><Plus size={13} /></button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Generic list page used by goals / skincare / wardrobe / devices / home.
function ListPage({ storageKey, title, kicker, placeholder, checkable }) {
  const [items, setItems] = useLocalStorage(storageKey, [])
  return (
    <ListBody title={title} kicker={kicker} placeholder={placeholder} items={items} setItems={setItems} checkable={checkable} />
  )
}

function ListBody({ title, kicker, placeholder, items, setItems, checkable }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    if (!draft.trim()) return
    setItems((prev) => [...prev, { id: uid(), text: draft.trim(), done: false }])
    setDraft('')
  }
  const toggle = (id) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))
  const remove = (id) => setItems((prev) => prev.filter((x) => x.id !== id))

  return (
    <section>
      {kicker && <p className="kicker text-stone-400 mb-2">{kicker}</p>}
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-5">{title}</h2>
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
            <span className={`flex-1 text-sm ${it.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{it.text}</span>
            <button onClick={() => remove(it.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  )
}
