import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseFor } from '../lib/cycle'
import {
  dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW,
} from '../lib/date'
import { holidayFor } from '../lib/holidays'
import Horoscope from './Horoscope'
import { SLOTS } from './MealPlanning'

// Geocode a place name to coordinates via Open-Meteo (no key, CORS-friendly).
async function geocode(place) {
  const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`)
  const gj = await g.json()
  return (gj && gj.results && gj.results[0]) || null
}

// Live UV index. Returns a rounded number, or null on failure.
async function fetchUv(place) {
  const loc = await geocode(place)
  if (!loc) return null
  const f = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=uv_index_max&timezone=auto`,
  )
  const fj = await f.json()
  const v = fj && fj.daily && fj.daily.uv_index_max && fj.daily.uv_index_max[0]
  return v != null ? Math.round(v) : null
}

// WMO weather codes → short condition text.
const WMO = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

// Live current weather (temperature + condition) for a place, in °F.
async function fetchWeather(place) {
  const loc = await geocode(place)
  if (!loc) return null
  const f = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`,
  )
  const fj = await f.json()
  const cur = fj && fj.current
  if (!cur || cur.temperature_2m == null) return null
  return { temp: Math.round(cur.temperature_2m), condition: WMO[cur.weather_code] || '' }
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

// ── Info strip — phase · date · weather · UV · location, one elegant row ─
function InfoStrip({ phase, today, location, setLocation }) {
  const phaseDay = phase ? `${phase.name} · Day ${phase.cycleDay}` : '—'
  const dateStr = `${MONTHS[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`
  const Dot = () => <span className="text-stone-300">·</span>
  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-stone-200 py-3 text-sm text-stone-600">
      <span>{phaseDay}</span>
      <Dot />
      <span>{dateStr}</span>
      <Dot />
      <WeatherField location={location} />
      <Dot />
      <UvField location={location} />
      <Dot />
      <input
        value={location || ''}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location"
        className="w-28 bg-transparent border-b border-stone-200 pb-0.5 text-sm text-stone-700 outline-none focus:border-stone-900 transition-colors"
      />
    </div>
  )
}

// Live current weather for the location (temperature + condition), read-only.
function WeatherField({ location }) {
  const [w, setW] = useState(null)
  useEffect(() => {
    let alive = true
    const place = (location || '').trim()
    if (!place) {
      setW(null)
      return undefined
    }
    ;(async () => {
      try {
        const out = await fetchWeather(place)
        if (alive) setW(out)
      } catch {
        if (alive) setW(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [location])
  if (!w) return <span className="text-stone-400">—</span>
  return (
    <span className="text-stone-700">
      {w.temp}°{w.condition ? ` ${w.condition}` : ''}
    </span>
  )
}

// UV index — always pulled live for the location (never entered manually).
function UvField({ location }) {
  const [uv, setUv] = useState(null)
  useEffect(() => {
    let alive = true
    const place = (location || '').trim()
    if (!place) {
      setUv(null)
      return undefined
    }
    ;(async () => {
      try {
        const v = await fetchUv(place)
        if (alive) setUv(v)
      } catch {
        if (alive) setUv(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [location])
  return <span className="text-stone-700">UV {uv != null ? uv : '—'}</span>
}

export default function Today({ cycleConfig, location, setLocation }) {
  const today = new Date()
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const selected = parseKey(selectedKey)
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [calView, setCalView] = useState('month')

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
        view={calView}
        setView={setCalView}
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

      {/* Day view = unified daily view (calendar header + the four columns).
          Month/Week = calendar above, titled My dream day below. */}
      <DreamDay
        events={dayEvents(selectedKey)}
        dateKeyStr={selectedKey}
        showTitle={calView !== 'day'}
        onToggle={(id) => toggleDone(selectedKey, id)}
        onOpen={(id) => setDetail({ key: selectedKey, id })}
      />

      <TodayNotes />

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
function Calendar({ view, setView, calMonth, setCalMonth, selectedKey, setSelectedKey, today, cycleConfig, eventsFor, onAdd, onOpen }) {
  const cells = monthGrid(calMonth)
  const anchorDate = parseKey(selectedKey)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = parseKey(selectedKey)
    d.setDate(d.getDate() - d.getDay() + i)
    return d
  })
  const shiftAnchor = (days) => {
    const d = parseKey(selectedKey)
    d.setDate(d.getDate() + days)
    setSelectedKey(dateKey(d))
  }

  const goPrev = () => {
    if (view === 'month') setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
    else shiftAnchor(view === 'week' ? -7 : -1)
  }
  const goNext = () => {
    if (view === 'month') setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
    else shiftAnchor(view === 'week' ? 7 : 1)
  }
  const goToday = () => {
    setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedKey(dateKey(today))
  }
  const periodLabel =
    view === 'month'
      ? `${MONTHS[calMonth.getMonth()]} ${calMonth.getFullYear()}`
      : view === 'week'
        ? `Week of ${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getDate()}`
        : `${DOW[anchorDate.getDay()]}, ${MONTHS[anchorDate.getMonth()]} ${anchorDate.getDate()}`

  return (
    <section className="mb-12">
      {/* Single row: views left · period center · prev/today/next right */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 justify-start gap-1">
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
        <h3 className="flex-1 whitespace-nowrap text-center font-serif text-2xl text-stone-900">{periodLabel}</h3>
        <div className="flex flex-1 items-center justify-end gap-1">
          <button onClick={goPrev} className="px-2 text-sm text-stone-500 hover:text-stone-900">Prev</button>
          <button onClick={goToday} className="px-2 text-sm text-stone-500 hover:text-stone-900">Today</button>
          <button onClick={goNext} className="px-2 text-sm text-stone-500 hover:text-stone-900">Next</button>
          {view === 'day' && (
            <button onClick={() => onAdd(selectedKey)} className="ml-1 bg-stone-900 px-2 py-1 text-cream hover:bg-stone-700"><Plus size={15} /></button>
          )}
        </div>
      </div>

      {view === 'month' && (
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
      )}

      {view === 'week' && (
        <div className="grid gap-3 md:grid-cols-7">
            {weekDays.map((d) => {
              const key = dateKey(d)
              const isTod = isSameDay(d, today)
              const evs = eventsFor(key).sort(byTime)
              return (
                <div key={key} className="group border-t border-stone-300 pt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className={`kicker ${isTod ? 'text-stone-900' : 'text-stone-500'}`}>{DOW[d.getDay()]} {d.getDate()}</p>
                    <button onClick={() => onAdd(key)} className="hidden text-stone-300 hover:text-stone-900 group-hover:block"><Plus size={13} /></button>
                  </div>
                  <div className="space-y-1">
                    {evs.map((ev) => (
                      <button key={ev.id} onClick={() => onOpen(key, ev.id)} className="flex w-full items-center gap-1.5 text-left">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                        {ev.time && <span className="text-[10px] text-stone-400">{ev.time}</span>}
                        <span className={`truncate text-xs ${ev.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{ev.title || 'Untitled'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
      )}

    </section>
  )
}

// ── My dream day / unified day columns — events by part + today's meals ──
function DreamDay({ events, dateKeyStr, showTitle = true, onToggle, onOpen }) {
  return (
    <section className="mb-14">
      {showTitle && (
        <Cursive className="block mb-6 text-5xl md:text-6xl text-stone-900 leading-tight">My dream day.</Cursive>
      )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
        <MealsColumn dateKeyStr={dateKeyStr} />
      </div>
    </section>
  )
}

// Read-only view of today's Meal Planning → Schedule entries, in slot order.
function MealsColumn({ dateKeyStr }) {
  const [weekPlan] = useLocalStorage('mos:menu:weekplan', {})
  const day = weekPlan[dateKeyStr] || {}
  const rows = []
  SLOTS.forEach((slot) => {
    const slotData = day[slot.id] || {}
    rows.push({
      label: slot.label,
      values: (slotData.foods || []).map((f) => f.name).filter(Boolean),
      placeholder: 'add food',
    })
    if (slot.supps) {
      rows.push({
        label: 'Supplements',
        values: (slotData.supps || []).map((s) => s.name).filter(Boolean),
        placeholder: 'add supplement',
        sub: true,
      })
    }
  })
  return (
    <div className="border-t border-stone-300 pt-3">
      <p className="kicker text-stone-500 mb-3">Today's meals</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className={r.sub ? 'pl-3' : ''}>
            <p className={`kicker ${r.sub ? 'text-stone-300' : 'text-stone-400'}`}>{r.label}</p>
            {r.values.length ? (
              <p className="text-sm text-stone-700">{r.values.join(', ')}</p>
            ) : (
              <p className="text-sm italic text-stone-300">{r.placeholder}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Today's notes — Keep-style card grid; click a card to edit it ───
const noteDateLabel = (d) => {
  const x = parseKey(d)
  return `${MONTHS[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}`
}

function TodayNotes() {
  const [stored, setNotes] = useLocalStorage('mos:today:notes-v2', [])
  const notes = Array.isArray(stored) ? stored : []
  const [draft, setDraft] = useState('')
  const [openId, setOpenId] = useState(null)

  const add = () => {
    const t = draft.trim()
    if (!t) return
    const note = { id: uid(), title: t, body: '', date: dateKey(new Date()) }
    setNotes((prev) => [note, ...(Array.isArray(prev) ? prev : [])])
    setDraft('')
  }
  const update = (id, patch) =>
    setNotes((prev) => (Array.isArray(prev) ? prev : []).map((n) => (n.id === id ? { ...n, ...patch } : n)))
  const remove = (id) => setNotes((prev) => (Array.isArray(prev) ? prev : []).filter((n) => n.id !== id))

  const openNote = notes.find((n) => n.id === openId) || null

  return (
    <section className="mb-14">
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-6">Today's Notes.</h2>

      <div className="mb-2 flex justify-end">
        <span className="text-sm text-stone-400">{notes.length} on file</span>
      </div>
      <div className="mb-6 flex justify-end gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New note title"
          className="w-48 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={add} className="flex items-center gap-1.5 bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700">
          <Plus size={15} /> New note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">No notes yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} onOpen={() => setOpenId(n.id)} />
          ))}
        </div>
      )}

      {openNote && (
        <NoteDetail
          note={openNote}
          onChange={(patch) => update(openNote.id, patch)}
          onDelete={() => {
            remove(openNote.id)
            setOpenId(null)
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  )
}

function NoteCard({ note, onOpen }) {
  const firstLine = (note.body || '').split('\n').find((l) => l.trim()) || ''
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-start border border-stone-200 bg-white/40 p-4 text-left transition-shadow hover:shadow-md"
    >
      <h3 className="font-serif text-xl text-stone-900">{note.title || 'Untitled'}</h3>
      {firstLine ? (
        <p className="mt-2 line-clamp-1 text-sm leading-relaxed text-stone-500">{firstLine}</p>
      ) : (
        <p className="mt-2 text-sm italic text-stone-300">No content yet.</p>
      )}
      <p className="kicker text-stone-400 mt-3">{noteDateLabel(note.date)}</p>
    </button>
  )
}

function NoteDetail({ note, onChange, onDelete, onClose }) {
  const taRef = useRef(null)
  const autosize = () => {
    const el = taRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }
  useEffect(() => {
    autosize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <input
            value={note.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Title"
            autoFocus
            className="w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none"
          />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="px-6 py-5">
          <p className="kicker text-stone-400 mb-3">{noteDateLabel(note.date)}</p>
          <textarea
            ref={taRef}
            value={note.body}
            onChange={(e) => {
              onChange({ body: e.target.value })
              autosize()
            }}
            placeholder="Write it out…"
            className="block w-full resize-none overflow-hidden bg-transparent text-base leading-relaxed text-stone-800 placeholder-stone-300 outline-none"
            style={{ minHeight: '40vh' }}
          />
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-phase-menstrual">
            <Trash2 size={15} /> Delete
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Done</button>
        </div>
      </div>
    </div>
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

