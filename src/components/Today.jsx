import React, { useEffect, useMemo, useState } from 'react'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseFor } from '../lib/cycle'
import {
  dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW, DOW_LONG,
} from '../lib/date'
import { holidayFor } from '../lib/holidays'
import Horoscope from './Horoscope'
import InlineText from './shared/InlineText'

// Live UV index via Open-Meteo (no key, CORS-friendly). Returns a rounded
// number, or null if the location can't be resolved / the request fails.
async function fetchUv(place) {
  const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`)
  const gj = await g.json()
  const loc = gj && gj.results && gj.results[0]
  if (!loc) return null
  const f = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=uv_index_max&timezone=auto`,
  )
  const fj = await f.json()
  const v = fj && fj.daily && fj.daily.uv_index_max && fj.daily.uv_index_max[0]
  return v != null ? Math.round(v) : null
}

const uid = () => Math.random().toString(36).slice(2, 10)

const PARTS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
]
const FREQS = ['once', 'daily', 'weekly', 'monthly', 'yearly']

// Normalize a stored event (old shape was { id, text, category }).
const normEvent = (ev) => ({
  id: ev.id,
  title: ev.title != null ? ev.title : ev.text || '',
  time: ev.time || '',
  part: ev.part || 'morning',
  description: ev.description || '',
  attendees: ev.attendees || '',
  frequency: ev.frequency || 'once',
  done: !!ev.done,
})

const byTime = (a, b) => {
  const ta = a.time || '', tb = b.time || ''
  if (!ta && !tb) return 0
  if (!ta) return -1
  if (!tb) return 1
  return ta.localeCompare(tb)
}

const Cursive = ({ children, className = '' }) => (
  <span className={className} style={{ fontFamily: "'Pinyon Script', cursive" }}>
    {children}
  </span>
)

// ── Info strip — day/phase · date · UV · location, one elegant row ───
function InfoStrip({ today, phase, location, setLocation }) {
  const dayPhase = `${DOW_LONG[today.getDay()]}${phase ? ` · ${phase.name} Day ${phase.cycleDay}` : ''}`
  const dateStr = `${MONTHS[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`
  const Dot = () => <span className="text-stone-300">·</span>
  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-stone-200 py-3 text-sm text-stone-600">
      <span>{dayPhase}</span>
      <Dot />
      <span>{dateStr}</span>
      <Dot />
      <span className="flex items-center gap-1.5">
        <span className="kicker text-stone-400">UV</span>
        <UvField location={location} />
      </span>
      <Dot />
      <span className="flex items-center gap-1.5">
        <span className="kicker text-stone-400">Location</span>
        <input
          value={location || ''}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="w-28 bg-transparent border-b border-stone-200 pb-0.5 text-sm text-stone-700 outline-none focus:border-stone-900 transition-colors"
        />
      </span>
    </div>
  )
}

// UV index — pulled live for the location when possible; always editable.
function UvField({ location }) {
  const [uv, setUv] = useLocalStorage('mos:settings:uv', '')
  useEffect(() => {
    let alive = true
    const place = (location || '').trim()
    if (!place) return undefined
    ;(async () => {
      try {
        const v = await fetchUv(place)
        if (alive && v != null) setUv(String(v))
      } catch {
        /* offline / unresolved — keep the manual value */
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])
  return (
    <input
      value={uv}
      onChange={(e) => setUv(e.target.value)}
      placeholder="—"
      className="w-12 bg-transparent border-b border-stone-200 pb-0.5 text-sm text-stone-700 outline-none focus:border-stone-900 transition-colors"
    />
  )
}

export default function Today({ cycleConfig, location, setLocation }) {
  const today = new Date()
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const selected = parseKey(selectedKey)
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const todayPhase = useMemo(
    () => phaseFor(today, cycleConfig.lastPeriodStart, cycleConfig.cycleLength),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cycleConfig.lastPeriodStart, cycleConfig.cycleLength, dateKey(today)],
  )

  const [events, setEvents] = useLocalStorage('mos:today:events', {})
  const [detail, setDetail] = useState(null) // { key, id }

  const dayEvents = (k) => (events[k] || []).map(normEvent)

  const addEvent = (k) => {
    const ev = {
      id: uid(), title: '', time: '', part: 'morning',
      description: '', attendees: '', frequency: 'once', done: false,
    }
    setEvents((p) => ({ ...p, [k]: [...(p[k] || []), ev] }))
    setDetail({ key: k, id: ev.id })
  }

  const updateEvent = (k, id, patch) => {
    setEvents((prev) => {
      const list = (prev[k] || []).map(normEvent)
      const idx = list.findIndex((e) => e.id === id)
      if (idx < 0) return prev
      const merged = { ...list[idx], ...patch }
      const newKey = patch.date && patch.date !== k ? patch.date : k
      delete merged.date
      if (newKey === k) {
        const nl = [...list]
        nl[idx] = merged
        return { ...prev, [k]: nl }
      }
      const fromList = list.filter((e) => e.id !== id)
      const toList = [...(prev[newKey] || []).map(normEvent), merged]
      return { ...prev, [k]: fromList, [newKey]: toList }
    })
    if (patch.date && patch.date !== k) setDetail({ key: patch.date, id })
  }

  const removeEvent = (k, id) => {
    setEvents((p) => ({ ...p, [k]: (p[k] || []).filter((e) => e.id !== id) }))
    setDetail(null)
  }

  const toggleDone = (k, id) =>
    setEvents((p) => ({
      ...p,
      [k]: (p[k] || []).map((e) => (e.id === id ? { ...normEvent(e), done: !normEvent(e).done } : e)),
    }))

  return (
    <div>
      {/* Page title — centered at the very top of the main content */}
      <div className="mb-6 text-center">
        <Cursive className="text-5xl md:text-6xl text-stone-900 leading-tight">Melissa's Digital Planner</Cursive>
      </div>

      <InfoStrip today={today} phase={todayPhase} location={location} setLocation={setLocation} />

      <Horoscope />

      {!isSameDay(selected, today) && (
        <p className="mb-6 text-sm text-stone-500">
          Viewing {longDate(selected)}.{' '}
          <button onClick={() => setSelectedKey(dateKey(today))} className="text-stone-900 underline underline-offset-2">
            Back to today
          </button>
        </p>
      )}

      <Calendar
        calMonth={calMonth}
        setCalMonth={setCalMonth}
        selectedKey={selectedKey}
        setSelectedKey={setSelectedKey}
        today={today}
        cycleConfig={cycleConfig}
        eventsFor={dayEvents}
        onAdd={addEvent}
        onOpen={(k, id) => setDetail({ key: k, id })}
      />

      <DreamDay
        events={dayEvents(selectedKey)}
        onToggle={(id) => toggleDone(selectedKey, id)}
        onOpen={(id) => setDetail({ key: selectedKey, id })}
      />
      <TopPriorities dateKeyStr={selectedKey} />
      <BrainDump dateKeyStr={selectedKey} />

      {detail && (() => {
        const ev = dayEvents(detail.key).find((e) => e.id === detail.id)
        if (!ev) return null
        return (
          <EventDetail
            ev={ev}
            dateKeyStr={detail.key}
            onChange={(patch) => updateEvent(detail.key, detail.id, patch)}
            onDelete={() => removeEvent(detail.key, detail.id)}
            onClose={() => setDetail(null)}
          />
        )
      })()}
    </div>
  )
}

// ── Calendar ───────────────────────────────────────────────────────
function Calendar({ calMonth, setCalMonth, selectedKey, setSelectedKey, today, cycleConfig, eventsFor, onAdd, onOpen }) {
  const cells = monthGrid(calMonth)

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-2xl text-stone-900">
          {MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
            className="p-1.5 text-stone-400 hover:text-stone-900"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-2 text-xs text-stone-500 hover:text-stone-900"
          >
            Today
          </button>
          <button
            onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
            className="p-1.5 text-stone-400 hover:text-stone-900"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-stone-200">
        {DOW.map((d) => (
          <div key={d} className="border-b border-r border-stone-200 px-2 py-1.5 text-center kicker text-stone-400">
            {d[0]}
          </div>
        ))}
        {cells.map((cell) => {
          const key = dateKey(cell)
          const inMonth = cell.getMonth() === calMonth.getMonth()
          const isSel = key === selectedKey
          const isTod = isSameDay(cell, today)
          const holiday = holidayFor(cell)
          const dayEvents = eventsFor(key)
          const phase = phaseFor(cell, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
          return (
            <div
              key={key}
              className={`group relative min-h-[78px] border-b border-r border-stone-200 px-1.5 py-1 text-left transition-colors ${
                inMonth ? 'bg-transparent' : 'bg-stone-50 text-stone-300'
              } ${isSel ? 'ring-1 ring-inset ring-stone-900' : ''}`}
            >
              <button onClick={() => setSelectedKey(key)} className="block w-full text-left">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center text-xs ${
                    isTod ? 'bg-stone-900 text-cream rounded-full' : inMonth ? 'text-stone-700' : 'text-stone-300'
                  }`}
                >
                  {cell.getDate()}
                </span>
                {phase && inMonth && (
                  <span
                    className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                    style={{ backgroundColor: phase.color }}
                    title={phase.name}
                  />
                )}
              </button>

              {holiday && (
                <p className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-stone-400">{holiday}</p>
              )}

              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 2).map((ev) => (
                  <button key={ev.id} onClick={() => onOpen(key, ev.id)} className="flex w-full items-center gap-1 text-left">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                    <span className={`truncate text-[10px] ${ev.done ? 'text-stone-400 line-through' : 'text-stone-600'}`}>
                      {ev.title || 'Untitled'}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-[9px] text-stone-400">+{dayEvents.length - 2} more</p>
                )}
              </div>

              <button
                onClick={() => onAdd(key)}
                className="absolute right-1 top-1 hidden text-stone-300 hover:text-stone-900 group-hover:block"
              >
                <Plus size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── My dream day — a view of the day's calendar events by part ───────
function DreamDay({ events, onToggle, onOpen }) {
  return (
    <section className="mb-14">
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-6">My dream day.</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {PARTS.map((part) => {
          const items = events.filter((e) => e.part === part.id).sort(byTime)
          return (
            <div key={part.id} className="border-t border-stone-300 pt-3">
              <p className="kicker text-stone-500 mb-3">{part.label}</p>
              {items.length === 0 ? (
                <p className="text-sm text-stone-300">Nothing scheduled.</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((it) => (
                    <div key={it.id} className="group flex items-start gap-2">
                      <button
                        onClick={() => onToggle(it.id)}
                        className={`mt-0.5 h-4 w-4 shrink-0 border ${it.done ? 'bg-stone-900 border-stone-900' : 'border-stone-400'}`}
                      />
                      {it.time && <span className="mt-0.5 text-xs text-stone-400 w-12 shrink-0">{it.time}</span>}
                      <button
                        onClick={() => onOpen(it.id)}
                        className={`flex-1 text-left text-sm ${it.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}
                      >
                        {it.title || 'Untitled'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Event detail editor ─────────────────────────────────────────────
function EventDetail({ ev, dateKeyStr, onChange, onDelete, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-cream border border-stone-300 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <span className="kicker text-stone-400">Event</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>

        <input
          value={ev.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title"
          className="mb-4 w-full bg-transparent border-b border-stone-300 pb-1.5 font-serif text-2xl text-stone-900 outline-none focus:border-stone-900"
        />

        <div className="space-y-3 text-sm">
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="kicker text-stone-400 mb-1 block">Date</span>
              <input type="date" value={dateKeyStr} onChange={(e) => onChange({ date: e.target.value })} className="w-full bg-transparent border-b border-stone-300 pb-1 outline-none focus:border-stone-900" />
            </label>
            <label className="block flex-1">
              <span className="kicker text-stone-400 mb-1 block">Time</span>
              <input type="time" value={ev.time} onChange={(e) => onChange({ time: e.target.value })} className="w-full bg-transparent border-b border-stone-300 pb-1 outline-none focus:border-stone-900" />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="kicker text-stone-400 mb-1 block">Part of day</span>
              <select value={ev.part} onChange={(e) => onChange({ part: e.target.value })} className="w-full bg-transparent border-b border-stone-300 pb-1 outline-none focus:border-stone-900">
                {PARTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="block flex-1">
              <span className="kicker text-stone-400 mb-1 block">Frequency</span>
              <select value={ev.frequency} onChange={(e) => onChange({ frequency: e.target.value })} className="w-full bg-transparent border-b border-stone-300 pb-1 capitalize outline-none focus:border-stone-900">
                {FREQS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="kicker text-stone-400 mb-1 block">Description</span>
            <textarea value={ev.description} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="w-full bg-transparent border border-stone-300 px-2 py-1 outline-none focus:border-stone-900" />
          </label>

          <label className="block">
            <span className="kicker text-stone-400 mb-1 block">Attendees</span>
            <input value={ev.attendees} onChange={(e) => onChange({ attendees: e.target.value })} placeholder="Comma separated" className="w-full bg-transparent border-b border-stone-300 pb-1 outline-none focus:border-stone-900" />
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

// ── Top priorities ──────────────────────────────────────────────────
const ROMAN = ['i', 'ii', 'iii']
const PRIORITY_PLACEHOLDERS = [
  'The one thing that matters most...',
  'The second pull on your attention...',
  'If there is room, this...',
]

function TopPriorities({ dateKeyStr }) {
  const [all, setAll] = useLocalStorage('mos:today:todos-v2', {})
  const items = all[dateKeyStr] || []

  const setText = (i, text) => {
    setAll((prev) => {
      const cur = [...(prev[dateKeyStr] || [])]
      while (cur.length <= i) cur.push({ id: uid(), text: '' })
      cur[i] = { ...cur[i], text }
      return { ...prev, [dateKeyStr]: cur }
    })
  }

  return (
    <section className="mb-14">
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-7">Top priorities.</h2>
      <div className="space-y-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-baseline gap-5">
            <span className="font-serif italic text-7xl leading-none text-stone-300 w-16 shrink-0 text-right">
              {ROMAN[i]}
            </span>
            <input
              value={(items[i] && items[i].text) || ''}
              onChange={(e) => setText(i, e.target.value)}
              placeholder={PRIORITY_PLACEHOLDERS[i]}
              className="flex-1 bg-transparent border-b border-stone-200 pb-2 text-lg text-stone-800 outline-none focus:border-stone-900"
            />
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-stone-400">Three is the cap. Choose with care.</p>
    </section>
  )
}

// ── Brain dump ──────────────────────────────────────────────────────
function BrainDump({ dateKeyStr }) {
  const [all, setAll] = useLocalStorage('mos:today:brain-v2', {})
  const items = all[dateKeyStr] || []
  const [draft, setDraft] = useState('')

  const add = () => {
    if (!draft.trim()) return
    setAll((prev) => ({ ...prev, [dateKeyStr]: [...(prev[dateKeyStr] || []), { id: uid(), text: draft.trim() }] }))
    setDraft('')
  }
  const remove = (id) =>
    setAll((prev) => ({ ...prev, [dateKeyStr]: (prev[dateKeyStr] || []).filter((x) => x.id !== id) }))
  const editText = (id, text) =>
    setAll((prev) => ({ ...prev, [dateKeyStr]: (prev[dateKeyStr] || []).map((x) => (x.id === id ? { ...x, text } : x)) }))

  return (
    <section className="mb-6 bg-stone-900 text-stone-50 px-7 py-8 md:px-10 md:py-10">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="font-serif italic text-3xl md:text-4xl">Brain dump.</h2>
        <span className="kicker text-stone-400">{items.length} open</span>
      </div>

      {items.length > 0 && (
        <div className="mb-5 space-y-2">
          {items.map((it) => (
            <div key={it.id} className="group flex items-start gap-3 border-b border-stone-700 pb-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone-500" />
              <InlineText value={it.text} onChange={(t) => editText(it.id, t)} className="flex-1 text-sm text-stone-200 bg-transparent outline-none" />
              <button
                onClick={() => remove(it.id)}
                className="hidden text-stone-500 hover:text-stone-200 group-hover:block"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="Let it out..."
        className="w-full bg-transparent border-b border-stone-600 pb-2 text-sm text-stone-100 placeholder-stone-500 outline-none focus:border-stone-300"
      />
    </section>
  )
}
