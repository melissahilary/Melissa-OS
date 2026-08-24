import React, { useState, useEffect } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, addDays, MONTHS_SHORT } from '../lib/date'
import Checkbox from './shared/Checkbox'

const uid = () => Math.random().toString(36).slice(2, 10)

// Monday-first week. days[] is 7 booleans; a filled day = eaten that day.
const DAY_INIT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Time-of-day the food belongs to.
const SLOTS = [
  { id: 'empty', label: 'Empty Stomach' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'bed', label: 'Before Bed' },
]
const slotLabel = (id) => (SLOTS.find((s) => s.id === id) || SLOTS[1]).label

// Melissa's staples — [name, times/week, slot]. Supplements live here too, on the
// time of day she takes them.
const SEED = [
  ['16 oz water on waking', 7, 'empty'],
  ['Chia seed water with lemon and grated ginger', 7, 'empty'],
  ['Marine collagen in cold hibiscus tea', 7, 'empty'],
  ['Shilajit water', 5, 'empty'],
  ['Camu camu', 7, 'empty'],
  ['Amla', 5, 'empty'],
  ['Colostrum', 5, 'empty'],
  ['Fermented papaya', 3, 'empty'],
  ['Matcha with collagen peptides', 5, 'breakfast'],
  ['Pastured eggs with sauerkraut', 5, 'breakfast'],
  ['Blueberries with raw walnuts', 5, 'breakfast'],
  ['Strawberries', 4, 'breakfast'],
  ['Pomegranate', 4, 'breakfast'],
  ['Black sesame seeds', 7, 'breakfast'],
  ['Raw cacao with cayenne', 3, 'breakfast'],
  ['Kefir with cinnamon', 5, 'breakfast'],
  ['Salmon roe', 2, 'breakfast'],
  ['Broccoli sprouts', 7, 'lunch'],
  ['Leafy greens massaged in lemon juice', 7, 'lunch'],
  ['Avocado with olive oil and sea salt', 5, 'lunch'],
  ['Cooked tomatoes with olive oil', 4, 'lunch'],
  ['Sardines with bones', 3, 'lunch'],
  ['Sprouted pumpkin seeds', 4, 'lunch'],
  ['Beef liver', 1, 'lunch'],
  ['Green tea with mint', 5, 'lunch'],
  ['Watermelon with lime', 3, 'lunch'],
  ['Wild salmon with pomegranate seeds', 3, 'dinner'],
  ['Bone broth with turmeric and black pepper', 4, 'dinner'],
  ['Sweet potato with tahini', 3, 'dinner'],
  ['Natto', 3, 'dinner'],
  ['Aged cheese', 2, 'dinner'],
  ['Oysters', 1, 'dinner'],
  ['Kiwi with skin', 4, 'bed'],
  ['12-hour overnight fast', 7, 'bed'],
]

// name → slot, so already-seeded staples (which had no slot) get the right time of day.
const SEED_SLOT = {}
SEED.forEach(([name, , slot]) => { SEED_SLOT[name.toLowerCase()] = slot })
const slotForName = (name) => SEED_SLOT[(name || '').toLowerCase()] || 'breakfast'

const FILL = '#8C7A5F'

const evenPositions = (n) => Array.from({ length: n }, (_, i) => Math.floor((i * 7) / n))

// Days for a food eaten n×/week, offset to keep the week balanced against `loads`.
function bestDays(n, loads) {
  const days = [false, false, false, false, false, false, false]
  n = Math.max(1, Math.min(7, n))
  if (n >= 7) return days.map(() => true)
  const pos = evenPositions(n)
  let best = 0, bestScore = Infinity
  for (let o = 0; o < 7; o++) {
    const nl = [...loads]
    pos.forEach((p) => { nl[(p + o) % 7]++ })
    const score = Math.max(...nl) * 100 + nl.reduce((a, b) => a + b * b, 0)
    if (score < bestScore) { bestScore = score; best = o }
  }
  pos.forEach((p) => { days[(p + best) % 7] = true })
  return days
}
const loadsOf = (foods) => { const l = [0, 0, 0, 0, 0, 0, 0]; foods.forEach((f) => f.days.forEach((v, d) => { if (v) l[d]++ })); return l }
const countOf = (f) => f.days.filter(Boolean).length

function seedFoods() {
  const loads = [0, 0, 0, 0, 0, 0, 0]
  const withIdx = SEED.map(([name, perWeek, slot], idx) => ({ name, perWeek, slot, idx }))
  const out = {}
  ;[...withIdx].sort((a, b) => b.perWeek - a.perWeek).forEach((it) => {
    const days = bestDays(it.perWeek, loads)
    days.forEach((v, d) => { if (v) loads[d]++ })
    out[it.idx] = { id: uid(), name: it.name, slot: it.slot, days }
  })
  return SEED.map((_, i) => out[i])
}

export default function Diet() {
  const [stored, setFoods] = useLocalStorage('mos:diet:foods', [])
  const [seeded, setSeeded] = useLocalStorage('mos:diet:seeded', false)
  const [eatenStore, setEaten] = useLocalStorage('mos:diet:eaten', {})
  const foods = (Array.isArray(stored) ? stored : []).map((f) => ({ ...f, slot: f.slot || slotForName(f.name), days: Array.isArray(f.days) ? f.days : [false, false, false, false, false, false, false] }))
  const eaten = eatenStore && typeof eatenStore === 'object' ? eatenStore : {}

  useEffect(() => {
    if (!seeded && (!Array.isArray(stored) || stored.length === 0)) { setFoods(seedFoods()); setSeeded(true); return }
    // Migrate already-seeded staples that predate slots.
    if (Array.isArray(stored) && stored.length && stored.some((f) => !f.slot)) {
      setFoods(stored.map((f) => ({ ...f, slot: f.slot || slotForName(f.name), days: Array.isArray(f.days) ? f.days : [false, false, false, false, false, false, false] })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [view, setView] = useState('week') // 'week' | 'staples'
  const today = new Date()
  const todayIdx = (today.getDay() + 6) % 7
  const monday = addDays(today, -todayIdx)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  const toggleEaten = (dk, id) => setEaten((p) => {
    const pp = p && typeof p === 'object' ? p : {}
    const cur = new Set(Array.isArray(pp[dk]) ? pp[dk] : [])
    cur.has(id) ? cur.delete(id) : cur.add(id)
    return { ...pp, [dk]: [...cur] }
  })

  return (
    <div className="mx-auto max-w-2xl">
      {/* view toggle */}
      <div className="mb-7 flex justify-center">
        <div className="inline-flex rounded-full border border-stone-200 bg-cream p-0.5">
          {[['week', 'The Week'], ['staples', 'Staples']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} className={`rounded-full px-5 py-1.5 text-sm transition-colors ${view === id ? 'bg-stone-900 text-cream' : 'text-stone-500 hover:text-stone-800'}`}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'week'
        ? <WeekView foods={foods} weekDates={weekDates} todayIdx={todayIdx} eaten={eaten} onToggle={toggleEaten} />
        : <StaplesView foods={foods} setFoods={setFoods} />}
    </div>
  )
}

// The whole week at a glance — every day a soft card, its foods grouped by time
// of day, today gently lifted. Tick things off as you eat them.
function WeekView({ foods, weekDates, todayIdx, eaten, onToggle }) {
  return (
    <div className="space-y-4">
      {weekDates.map((d, i) => {
        const dk = dateKey(d)
        const isToday = i === todayIdx
        const eatenSet = new Set(Array.isArray(eaten[dk]) ? eaten[dk] : [])
        const sections = SLOTS.map((slot) => ({ slot, items: foods.filter((f) => f.slot === slot.id && f.days[i]) })).filter((x) => x.items.length)
        const total = sections.reduce((n, s) => n + s.items.length, 0)
        const doneCount = sections.reduce((n, s) => n + s.items.filter((f) => eatenSet.has(f.id)).length, 0)
        return (
          <div key={dk} className={`rounded-2xl border p-5 transition-colors ${isToday ? 'border-stone-300' : 'border-stone-200'}`} style={{ background: isToday ? '#F3F1EA' : 'rgba(255,255,255,0.35)' }}>
            <div className="mb-4 flex items-baseline gap-2.5">
              <h3 className="font-serif italic text-2xl text-stone-900">{DAY_FULL[i]}</h3>
              <span className="text-sm not-italic text-stone-400 tabular-nums">{MONTHS_SHORT[d.getMonth()]} {d.getDate()}</span>
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
                      {items.map((f) => {
                        const done = eatenSet.has(f.id)
                        return (
                          <div key={f.id} className="flex items-center gap-3 py-1">
                            <Checkbox checked={done} onClick={() => onToggle(dk, f.id)} />
                            <span className={`flex-1 font-serif text-lg leading-tight ${done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{f.name}</span>
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

function StaplesView({ foods, setFoods }) {
  const [name, setName] = useState('')
  const [freq, setFreq] = useState(5)
  const [slot, setSlot] = useState('breakfast')

  const add = () => {
    const t = name.trim()
    if (!t) return
    const days = bestDays(freq, loadsOf(foods))
    setFoods((p) => [{ id: uid(), name: t, slot, days }, ...(Array.isArray(p) ? p : [])])
    setName(''); setFreq(5)
  }
  const remove = (id) => setFoods((p) => (Array.isArray(p) ? p : []).filter((f) => f.id !== id))
  const setSlotFor = (id, s) => setFoods((p) => (Array.isArray(p) ? p : []).map((f) => (f.id === id ? { ...f, slot: s } : f)))
  const setFreqFor = (id, n) => setFoods((p) => {
    const arr = Array.isArray(p) ? p : []
    const others = arr.filter((f) => f.id !== id)
    const days = bestDays(n, loadsOf(others))
    return arr.map((f) => (f.id === id ? { ...f, days } : f))
  })

  return (
    <div>
      {/* add */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-cream/50 p-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add a food or supplement…" className="min-w-[8rem] flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder-stone-300" />
        <select value={slot} onChange={(e) => setSlot(e.target.value)} className="rounded-full border border-stone-200 bg-cream px-3 py-1.5 text-xs text-stone-600 outline-none">
          {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 rounded-full bg-stone-500/5 px-2 py-1">
          <button onClick={() => setFreq((f) => Math.max(1, f - 1))} className="text-stone-400 hover:text-stone-800" aria-label="Fewer"><Minus size={14} /></button>
          <span className="w-14 text-center text-xs tabular-nums text-stone-600">{freq}×/wk</span>
          <button onClick={() => setFreq((f) => Math.min(7, f + 1))} className="text-stone-400 hover:text-stone-800" aria-label="More"><Plus size={14} /></button>
        </div>
        <button onClick={add} className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream hover:bg-stone-700">Add</button>
      </div>

      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-cream/40">
        {foods.map((f) => (
          <div key={f.id} className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <span className="min-w-[9rem] flex-1 font-serif text-lg leading-tight text-stone-800">{f.name}</span>
            <select value={f.slot} onChange={(e) => setSlotFor(f.id, e.target.value)} className="rounded-full border border-stone-200 bg-cream px-3 py-1 text-xs text-stone-600 outline-none">
              {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <div className="flex items-center gap-1.5 rounded-full bg-stone-500/5 px-2 py-0.5">
              <button onClick={() => setFreqFor(f.id, Math.max(1, countOf(f) - 1))} className="text-stone-400 hover:text-stone-800" aria-label="Fewer"><Minus size={13} /></button>
              <span className="w-12 text-center text-xs tabular-nums text-stone-500">{countOf(f)}×/wk</span>
              <button onClick={() => setFreqFor(f.id, Math.min(7, countOf(f) + 1))} className="text-stone-400 hover:text-stone-800" aria-label="More"><Plus size={13} /></button>
            </div>
            <button onClick={() => remove(f.id)} aria-label="Remove" className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={15} /></button>
          </div>
        ))}
        {foods.length === 0 && <p className="px-5 py-8 text-center text-sm italic text-stone-300">Nothing yet — add your first staple above.</p>}
      </div>
    </div>
  )
}
