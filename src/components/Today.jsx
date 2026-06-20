import React, { useMemo, useState } from 'react'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseFor } from '../lib/cycle'
import {
  dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW,
  moonPhaseIndex, MOON_NAMES,
} from '../lib/date'
import { holidayFor } from '../lib/holidays'
import MoonIcon from './shared/MoonIcon'
import Horoscope from './Horoscope'

const uid = () => Math.random().toString(36).slice(2, 10)

const EVENT_CATEGORIES = [
  { id: 'personal', label: 'Personal', color: '#B8849A' },
  { id: 'work', label: 'Work', color: '#5A6B7B' },
  { id: 'wellness', label: 'Wellness', color: '#7B8B5F' },
  { id: 'social', label: 'Social', color: '#C4A882' },
]

const Cursive = ({ children, className = '' }) => (
  <span className={className} style={{ fontFamily: "'Pinyon Script', cursive" }}>
    {children}
  </span>
)

export default function Today({ cycleConfig, setCycleConfig }) {
  const today = new Date()
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const selected = parseKey(selectedKey)
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const phase = useMemo(
    () => phaseFor(selected, cycleConfig.lastPeriodStart, cycleConfig.cycleLength),
    [selectedKey, cycleConfig.lastPeriodStart, cycleConfig.cycleLength],
  )
  const moonIdx = moonPhaseIndex(selected)

  return (
    <div>
      <Horoscope />

      {/* Header */}
      <header className="mb-7">
        <Cursive className="text-5xl md:text-6xl text-stone-900 leading-tight">Daily Schedule</Cursive>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {phase ? (
            <span
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs"
              style={{ backgroundColor: phase.color, color: phase.ink }}
            >
              <span className="font-medium">{phase.name}</span>
              <span className="opacity-70">· Day {phase.cycleDay}</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-3.5 py-1.5 text-xs bg-stone-100 text-stone-500">
              Set your last period below for phase guidance
            </span>
          )}
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs border border-stone-200 text-stone-600">
            <MoonIcon index={moonIdx} size={15} />
            {MOON_NAMES[moonIdx]}
          </span>
        </div>
        {!isSameDay(selected, today) && (
          <p className="mt-3 text-sm text-stone-500">
            Viewing {longDate(selected)}.{' '}
            <button onClick={() => setSelectedKey(dateKey(today))} className="text-stone-900 underline underline-offset-2">
              Back to today
            </button>
          </p>
        )}
      </header>

      {/* Cycle settings */}
      <section className="mb-8 flex flex-wrap items-end gap-6 border border-stone-200 bg-white/40 px-5 py-4">
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Last period started</label>
          <input
            type="date"
            value={cycleConfig.lastPeriodStart || ''}
            onChange={(e) => setCycleConfig({ ...cycleConfig, lastPeriodStart: e.target.value })}
            className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
          />
        </div>
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Cycle length</label>
          <input
            type="number"
            min="20"
            max="45"
            value={cycleConfig.cycleLength || 28}
            onChange={(e) => setCycleConfig({ ...cycleConfig, cycleLength: Number(e.target.value) })}
            className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
          />
        </div>
      </section>

      <Calendar
        calMonth={calMonth}
        setCalMonth={setCalMonth}
        selectedKey={selectedKey}
        setSelectedKey={setSelectedKey}
        today={today}
        cycleConfig={cycleConfig}
      />

      <DreamDay dateKeyStr={selectedKey} />
      <TopPriorities dateKeyStr={selectedKey} />
      <BrainDump dateKeyStr={selectedKey} />
    </div>
  )
}

// ── Calendar ───────────────────────────────────────────────────────
function Calendar({ calMonth, setCalMonth, selectedKey, setSelectedKey, today, cycleConfig }) {
  const [events, setEvents] = useLocalStorage('mos:today:events', {})
  const [adding, setAdding] = useState(null) // dateKey being added to
  const [draft, setDraft] = useState({ text: '', category: 'personal' })
  const cells = monthGrid(calMonth)

  const addEvent = (key) => {
    if (!draft.text.trim()) return
    setEvents((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), { id: uid(), text: draft.text.trim(), category: draft.category }],
    }))
    setDraft({ text: '', category: 'personal' })
    setAdding(null)
  }

  const removeEvent = (key, id) => {
    setEvents((prev) => ({ ...prev, [key]: (prev[key] || []).filter((e) => e.id !== id) }))
  }

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
          const dayEvents = events[key] || []
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
                {dayEvents.slice(0, 2).map((ev) => {
                  const cat = EVENT_CATEGORIES.find((c) => c.id === ev.category)
                  return (
                    <div key={ev.id} className="group/ev flex items-center gap-1">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cat?.color }} />
                      <span className="truncate text-[10px] text-stone-600">{ev.text}</span>
                      <button
                        onClick={() => removeEvent(key, ev.id)}
                        className="ml-auto hidden text-stone-300 hover:text-stone-700 group-hover/ev:block"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}
                {dayEvents.length > 2 && (
                  <p className="text-[9px] text-stone-400">+{dayEvents.length - 2} more</p>
                )}
              </div>

              {adding === key ? (
                <div className="mt-1 space-y-1">
                  <input
                    autoFocus
                    value={draft.text}
                    onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addEvent(key)
                      if (e.key === 'Escape') setAdding(null)
                    }}
                    placeholder="Event"
                    className="w-full bg-white border border-stone-300 px-1 py-0.5 text-[10px] outline-none"
                  />
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full bg-white border border-stone-300 px-1 py-0.5 text-[10px] outline-none"
                  >
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAdding(key)
                    setDraft({ text: '', category: 'personal' })
                  }}
                  className="absolute right-1 top-1 hidden text-stone-300 hover:text-stone-900 group-hover:block"
                >
                  <Plus size={13} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4">
        {EVENT_CATEGORIES.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
    </section>
  )
}

// ── My dream day ────────────────────────────────────────────────────
const DREAM_BLOCKS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
]

function DreamDay({ dateKeyStr }) {
  const [all, setAll] = useLocalStorage('mos:today:dream-v2', {})
  const data = all[dateKeyStr] || { morning: [], afternoon: [], evening: [] }

  const update = (blockId, items) => {
    setAll((prev) => ({ ...prev, [dateKeyStr]: { ...(prev[dateKeyStr] || {}), [blockId]: items } }))
  }

  return (
    <section className="mb-14">
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-6">My dream day.</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {DREAM_BLOCKS.map((block) => {
          const items = data[block.id] || []
          return (
            <DreamBlock
              key={block.id}
              label={block.label}
              items={items}
              onChange={(next) => update(block.id, next)}
            />
          )
        })}
      </div>
    </section>
  )
}

function DreamBlock({ label, items, onChange }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    if (!draft.trim()) return
    onChange([...items, { id: uid(), text: draft.trim(), done: false }])
    setDraft('')
  }
  return (
    <div className="border-t border-stone-300 pt-3">
      <p className="kicker text-stone-500 mb-3">{label}</p>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className="group flex items-start gap-2">
            <button
              onClick={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
              className={`mt-0.5 h-4 w-4 shrink-0 border ${it.done ? 'bg-stone-900 border-stone-900' : 'border-stone-400'}`}
            />
            <span className={`flex-1 text-sm ${it.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
              {it.text}
            </span>
            <button
              onClick={() => onChange(items.filter((x) => x.id !== it.id))}
              className="hidden text-stone-300 hover:text-stone-700 group-hover:block"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="Add to this part of the day"
        className="mt-2 w-full bg-transparent border-b border-stone-200 pb-1 text-sm outline-none focus:border-stone-900"
      />
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
              <span className="flex-1 text-sm text-stone-200">{it.text}</span>
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
