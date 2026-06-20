import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DOW_LONG } from '../lib/date'
import SectionTitle from './shared/SectionTitle'

const uid = () => Math.random().toString(36).slice(2, 10)
const STEP_GOAL = 10000

export default function Workout() {
  const [data, setData] = useLocalStorage('mos:workout', {
    steps: 0,
    schedule: {},
    habits: [],
  })

  const setSteps = (v) => setData((d) => ({ ...d, steps: Number(v) || 0 }))
  const pct = Math.min(100, (data.steps / STEP_GOAL) * 100)

  const addToDay = (day, text) => {
    if (!text.trim()) return
    setData((d) => ({
      ...d,
      schedule: { ...d.schedule, [day]: [...(d.schedule[day] || []), { id: uid(), text: text.trim() }] },
    }))
  }
  const removeFromDay = (day, id) =>
    setData((d) => ({ ...d, schedule: { ...d.schedule, [day]: (d.schedule[day] || []).filter((x) => x.id !== id) } }))

  const addHabit = (text) => {
    if (!text.trim()) return
    setData((d) => ({ ...d, habits: [...d.habits, { id: uid(), text: text.trim(), done: false }] }))
  }
  const toggleHabit = (id) =>
    setData((d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) }))
  const removeHabit = (id) => setData((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) }))

  return (
    <div>
      <SectionTitle kicker="02 · The body" title="Health & Fitness." />

      {/* Step goal */}
      <section className="mb-12">
        <div className="mb-2 flex items-end justify-between">
          <p className="kicker text-stone-400">Daily steps</p>
          <p className="text-sm text-stone-500 tabular-nums">
            {data.steps.toLocaleString()} / {STEP_GOAL.toLocaleString()}
          </p>
        </div>
        <div className="h-1.5 w-full bg-stone-200">
          <div className="h-full bg-stone-900 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="number"
          value={data.steps || ''}
          onChange={(e) => setSteps(e.target.value)}
          placeholder="Log today's steps"
          className="mt-3 w-48 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
        />
      </section>

      {/* Weekly schedule */}
      <section className="mb-12">
        <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-5">The weekly schedule.</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {DOW_LONG.map((day) => (
            <DayColumn
              key={day}
              day={day}
              items={data.schedule[day] || []}
              onAdd={(t) => addToDay(day, t)}
              onRemove={(id) => removeFromDay(day, id)}
            />
          ))}
        </div>
      </section>

      {/* Habits */}
      <section>
        <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-4">Habits & routines.</h2>
        <HabitInput onAdd={addHabit} />
        <div className="divide-y divide-stone-100">
          {data.habits.map((h) => (
            <div key={h.id} className="group flex items-center gap-3 py-2.5">
              <button
                onClick={() => toggleHabit(h.id)}
                className={`h-4 w-4 shrink-0 border ${h.done ? 'bg-stone-900 border-stone-900' : 'border-stone-400'}`}
              />
              <span className={`flex-1 text-sm ${h.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
                {h.text}
              </span>
              <button
                onClick={() => removeHabit(h.id)}
                className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function DayColumn({ day, items, onAdd, onRemove }) {
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
            <button
              onClick={() => onRemove(it.id)}
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
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        placeholder="Add a session"
        className="mt-1.5 w-full bg-transparent border-b border-stone-200 pb-1 text-sm outline-none focus:border-stone-900"
      />
    </div>
  )
}

function HabitInput({ onAdd }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="mb-4 flex items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onAdd(draft)
            setDraft('')
          }
        }}
        placeholder="A habit to hold"
        className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
      />
      <button
        onClick={() => {
          onAdd(draft)
          setDraft('')
        }}
        className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
