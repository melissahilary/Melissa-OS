import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useActivities } from '../hooks/useActivities'
import { blankActivity, activityOccursOn, isDoneOn } from '../lib/activities'
import { dateKey, addDays, MONTHS_SHORT } from '../lib/date'
import Checkbox from './shared/Checkbox'

// ── Diet — ONE food system. This page is a view over the same activities that
// power Today, the Schedule, and Esmé: meal items and supplements, with their
// days-of-week and mealtime slots. Check something off here and it's checked
// everywhere.

const uid = () => Math.random().toString(36).slice(2, 10)

const DAY_INIT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // Monday-first
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const monIdxToJs = (i) => (i + 1) % 7 // Monday-first index → JS getDay

// Mealtime buckets (drink slots fold into their meal).
const SLOTS = [
  { id: 'empty', label: 'Empty Stomach', slots: ['empty', 'emptydrink'] },
  { id: 'breakfast', label: 'Breakfast', slots: ['breakfast', 'drink'] },
  { id: 'lunch', label: 'Lunch', slots: ['lunch', 'lunchdrink'] },
  { id: 'dinner', label: 'Dinner', slots: ['dinner', 'dinnerdrink'] },
  { id: 'bed', label: 'Before Bed', slots: ['bed', 'beddrink'] },
]
const bucketOf = (slot) => (SLOTS.find((b) => b.slots.includes(slot)) || SLOTS[1]).id

const FILL = '#8C7A5F'

// Which JS weekdays an item lands on (for the staples dots).
const daysOfItem = (a) => {
  if (a.frequency === 'daily') return [0, 1, 2, 3, 4, 5, 6]
  return Array.isArray(a.daysOfWeek) ? a.daysOfWeek : []
}

export default function Diet() {
  const { activities, add, update, remove, toggleComplete } = useActivities()
  const [legacyRaw, setLegacy] = useLocalStorage('mos:diet:foods', [])
  const [migrated, setMigrated] = useLocalStorage('mos:diet:unified', false)
  const migRef = useRef(false)

  // One-time migration: the old standalone Diet list becomes real meal items, so
  // there is exactly one food system. Dedupe by title against what's there.
  useEffect(() => {
    if (migrated || migRef.current) return
    const legacy = Array.isArray(legacyRaw) ? legacyRaw : []
    if (!legacy.length) { setMigrated(true); return }
    migRef.current = true
    const have = new Set(activities.filter((a) => a.type === 'meal_item' || a.type === 'supplement').map((a) => (a.title || '').trim().toLowerCase()))
    legacy.forEach((f) => {
      const name = (f.name || '').trim()
      if (!name || have.has(name.toLowerCase())) return
      const days = Array.isArray(f.days) ? f.days.map((v, i) => (v ? monIdxToJs(i) : null)).filter((x) => x != null) : []
      const daily = days.length >= 7
      add(blankActivity('meal_item', {
        title: name, category: 'nutrition',
        frequency: daily ? 'daily' : 'specific', daysOfWeek: daily ? [] : days,
        details: { slot: f.slot && SLOTS.some((b) => b.id === f.slot) ? f.slot : 'breakfast', beverage: false },
      }))
    })
    setMigrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrated, legacyRaw])

  const foods = activities.filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && a.status !== 'archived')

  const [view, setView] = useState('week')
  const today = new Date()
  const todayIdx = (today.getDay() + 6) % 7
  const monday = addDays(today, -todayIdx)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-7 flex justify-center">
        <div className="inline-flex rounded-full border border-stone-200 bg-cream p-0.5">
          {[['week', 'The Week'], ['staples', 'Staples']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} className={`rounded-full px-5 py-1.5 text-sm transition-colors ${view === id ? 'bg-stone-900 text-cream' : 'text-stone-500 hover:text-stone-800'}`}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'week'
        ? <WeekView foods={foods} weekDates={weekDates} todayIdx={todayIdx} onToggle={(id, dk) => toggleComplete(id, dk)} />
        : <StaplesView foods={foods} add={add} update={update} remove={remove} />}
    </div>
  )
}

// The whole week, each day grouped by mealtime — reading the same occurrences
// Today and the Schedule read. Ticks are real completions on real dates.
function WeekView({ foods, weekDates, todayIdx, onToggle }) {
  return (
    <div className="space-y-4">
      {weekDates.map((d, i) => {
        const dk = dateKey(d)
        const isToday = i === todayIdx
        const dayItems = foods.filter((a) => activityOccursOn(a, dk))
        const sections = SLOTS.map((slot) => ({ slot, items: dayItems.filter((a) => bucketOf(a.details?.slot || 'breakfast') === slot.id) })).filter((x) => x.items.length)
        const total = sections.reduce((n, s) => n + s.items.length, 0)
        const doneCount = sections.reduce((n, s) => n + s.items.filter((a) => isDoneOn(a, dk)).length, 0)
        return (
          <div key={dk} className={`rounded-2xl border p-5 ${isToday ? 'border-stone-300' : 'border-stone-200'}`} style={{ background: isToday ? '#F3F1EA' : 'rgba(255,255,255,0.35)' }}>
            <div className="mb-4 flex items-baseline gap-2.5">
              <h3 className="font-serif italic text-2xl text-stone-900">{DAY_FULL[i]}</h3>
              <span className="text-sm not-italic tabular-nums text-stone-400">{MONTHS_SHORT[d.getMonth()]} {d.getDate()}</span>
              {isToday && <span className="ml-1 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] tracking-[0.14em] text-cream">TODAY</span>}
              {total > 0 && <span className="ml-auto text-xs tabular-nums text-stone-400">{doneCount}/{total}</span>}
            </div>
            {sections.length === 0 ? (
              <p className="text-sm italic text-stone-300">Nothing planned.</p>
            ) : (
              <div className="space-y-5">
                {sections.map(({ slot, items }) => (
                  <div key={slot.id}>
                    <div className="mb-1.5 flex items-center gap-3">
                      <span className="kicker text-stone-400">{slot.label}</span>
                      <span className="h-px flex-1 bg-stone-100" />
                    </div>
                    <div className="space-y-0.5">
                      {items.map((a) => {
                        const done = isDoneOn(a, dk)
                        return (
                          <div key={a.id} className="flex items-center gap-3 py-1">
                            <Checkbox checked={done} onClick={() => onToggle(a.id, dk)} />
                            <span className={`flex-1 font-serif text-lg leading-tight ${done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{a.title}</span>
                            {a.type === 'supplement' && <span className="kicker text-stone-300">supp</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Staples — every food and supplement, with a 7-dot week you edit directly.
// Toggling a dot rewrites the item's real days-of-week.
function StaplesView({ foods, add, update, remove }) {
  const [name, setName] = useState('')
  const [slot, setSlot] = useState('breakfast')
  const [freq, setFreq] = useState(7)

  const evenDays = (n) => {
    const out = []
    for (let i = 0; i < n; i++) out.push(monIdxToJs(Math.floor((i * 7) / n)))
    return out
  }
  const commit = () => {
    const t = name.trim()
    if (!t) return
    const daily = freq >= 7
    add(blankActivity('meal_item', {
      title: t, category: 'nutrition',
      frequency: daily ? 'daily' : 'specific', daysOfWeek: daily ? [] : evenDays(freq),
      details: { slot, beverage: false },
    }))
    setName(''); setFreq(7)
  }
  const toggleDay = (a, monIdx) => {
    const js = monIdxToJs(monIdx)
    const cur = new Set(daysOfItem(a))
    cur.has(js) ? cur.delete(js) : cur.add(js)
    const days = [...cur].sort()
    update(a.id, days.length >= 7 ? { frequency: 'daily', daysOfWeek: [] } : { frequency: 'specific', daysOfWeek: days })
  }
  const setSlotFor = (a, s) => update(a.id, { details: { ...(a.details || {}), slot: s } })

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-cream/50 p-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} placeholder="Add a food or supplement…" className="min-w-[8rem] flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder-stone-300" />
        <select value={slot} onChange={(e) => setSlot(e.target.value)} className="rounded-full border border-stone-200 bg-cream px-3 py-1.5 text-xs text-stone-600 outline-none">
          {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 rounded-full bg-stone-500/5 px-2 py-1">
          <button onClick={() => setFreq((f) => Math.max(1, f - 1))} className="text-stone-400 hover:text-stone-800" aria-label="Fewer"><Minus size={14} /></button>
          <span className="w-14 text-center text-xs tabular-nums text-stone-600">{freq}×/wk</span>
          <button onClick={() => setFreq((f) => Math.min(7, f + 1))} className="text-stone-400 hover:text-stone-800" aria-label="More"><Plus size={14} /></button>
        </div>
        <button onClick={commit} className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream hover:bg-stone-700">Add</button>
      </div>

      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-cream/40">
        {foods.map((a) => {
          const jsDays = new Set(daysOfItem(a))
          return (
            <div key={a.id} className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span className="min-w-[9rem] flex-1 font-serif text-lg leading-tight text-stone-800">{a.title}</span>
              <select value={bucketOf(a.details?.slot || 'breakfast')} onChange={(e) => setSlotFor(a, e.target.value)} className="rounded-full border border-stone-200 bg-cream px-3 py-1 text-xs text-stone-600 outline-none">
                {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <div className="flex items-center gap-1.5">
                {DAY_INIT.map((d, i) => {
                  const on = jsDays.has(monIdxToJs(i))
                  return (
                    <button key={i} onClick={() => toggleDay(a, i)} title={DAY_FULL[i]} aria-label={`${DAY_FULL[i]} ${on ? 'on' : 'off'}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition-all"
                      style={on ? { backgroundColor: FILL, color: '#FAF8F3' } : { backgroundColor: 'transparent', color: '#C4BDB0', boxShadow: 'inset 0 0 0 1px #E3DED2' }}>
                      {d}
                    </button>
                  )
                })}
              </div>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-stone-400">{jsDays.size}×</span>
              <button onClick={() => remove(a.id)} aria-label="Remove" className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={15} /></button>
            </div>
          )
        })}
        {foods.length === 0 && <p className="px-5 py-8 text-center text-sm italic text-stone-300">Nothing yet — add your first staple above.</p>}
      </div>
    </div>
  )
}
