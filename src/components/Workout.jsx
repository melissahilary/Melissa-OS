import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseFor } from '../lib/cycle'
import { dateKey } from '../lib/date'
import SectionTitle from './shared/SectionTitle'
import { DayNav, DayHeader } from './shared/DayNav'
import InlineText from './shared/InlineText'

const uid = () => Math.random().toString(36).slice(2, 10)
const STEP_GOAL = 10000

export default function Workout({ cycleConfig = {}, setCycleConfig = () => {}, subPage = 'schedule' }) {
  const today = new Date()
  const [selected, setSelected] = useState(new Date())
  const key = dateKey(selected)
  const phase = phaseFor(selected, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
  const todayPhase = phaseFor(today, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)

  const [data, setData] = useLocalStorage('mos:workout', {
    steps: 0,
    schedule: {},
    habits: [],
  })

  const setSteps = (v) => setData((d) => ({ ...d, steps: Number(v) || 0 }))
  const pct = Math.min(100, (data.steps / STEP_GOAL) * 100)

  const daySessions = (data.schedule && data.schedule[key]) || []
  const addSession = (text) => {
    if (!text.trim()) return
    setData((d) => ({
      ...d,
      schedule: { ...d.schedule, [key]: [...((d.schedule && d.schedule[key]) || []), { id: uid(), text: text.trim() }] },
    }))
  }
  const editSession = (id, text) =>
    setData((d) => ({
      ...d,
      schedule: { ...d.schedule, [key]: ((d.schedule && d.schedule[key]) || []).map((x) => (x.id === id ? { ...x, text } : x)) },
    }))
  const removeSession = (id) =>
    setData((d) => ({
      ...d,
      schedule: { ...d.schedule, [key]: ((d.schedule && d.schedule[key]) || []).filter((x) => x.id !== id) },
    }))

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

      {subPage === 'cycle' && (
        <section className="border-t border-stone-200 pt-7">
          <h3 className="kicker text-stone-500 mb-4">Cycle tracking</h3>
          <div className="flex flex-wrap items-end gap-6">
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
          </div>
          {todayPhase ? (
            <div
              className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 text-xs"
              style={{ backgroundColor: todayPhase.color, color: todayPhase.ink }}
            >
              <span className="font-medium">{todayPhase.name}</span>
              <span className="opacity-70">· Day {todayPhase.cycleDay}</span>
            </div>
          ) : (
            <p className="mt-6 text-sm text-stone-400">Set your last period to see your current phase.</p>
          )}
        </section>
      )}

      {subPage !== 'cycle' && (
        <>
      {/* Daily schedule — identical layout/style to the Meal Planning page */}
      <DayNav selected={selected} setSelected={setSelected} today={today} />
      <DayHeader date={selected} phase={phase} />

      <section className="mb-12 border-t border-stone-200 pt-7">
        <h3 className="kicker text-stone-500 mb-4">The day's sessions</h3>
        <div className="space-y-1.5">
          {daySessions.map((it) => (
            <div key={it.id} className="group flex items-center gap-2">
              <InlineText
                value={it.text}
                onChange={(t) => editSession(it.id, t)}
                className="flex-1 text-sm text-stone-700 bg-transparent outline-none"
              />
              <button
                onClick={() => removeSession(it.id)}
                className="hidden text-stone-300 hover:text-stone-700 group-hover:block"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        <SessionInput onAdd={addSession} />
      </section>

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
              <InlineText
                value={h.text}
                onChange={(t) => setData((d) => ({ ...d, habits: d.habits.map((x) => (x.id === h.id ? { ...x, text: t } : x)) }))}
                className={`flex-1 text-sm bg-transparent outline-none ${h.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}
              />
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
        </>
      )}
    </div>
  )
}

function SessionInput({ onAdd }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    onAdd(draft)
    setDraft('')
  }
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      placeholder="Add a session"
      className="mt-3 w-full bg-transparent border-b border-stone-200 pb-1 text-sm outline-none focus:border-stone-900"
    />
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
