import React, { useState, useEffect } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const uid = () => Math.random().toString(36).slice(2, 10)

// Monday-first week. days[] is 7 booleans; a filled day = eaten that day.
const DAY_INIT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Melissa's staples — the number is times per week.
const SEED = [
  ['Broccoli sprouts', 7], ['Salmon roe', 2], ['Natto', 3], ['Aged cheese', 2],
  ['Strawberries', 4], ['Pomegranate', 4], ['Raw cacao with cayenne', 3], ['Colostrum', 5],
  ['Camu camu', 7], ['Marine collagen in cold hibiscus tea', 7], ['Sardines with bones', 3],
  ['Black sesame seeds', 7], ['Fermented papaya', 3], ['Amla', 5], ['Shilajit water', 5],
  ['Sprouted pumpkin seeds', 4], ['Chia seed water with lemon and grated ginger', 7],
  ['Wild salmon with pomegranate seeds', 3], ['Pastured eggs with sauerkraut', 5],
  ['Bone broth with turmeric and black pepper', 4], ['Blueberries with raw walnuts', 5],
  ['Avocado with olive oil and sea salt', 5], ['Matcha with collagen peptides', 5],
  ['Kiwi with skin', 4], ['Cooked tomatoes with olive oil', 4], ['Oysters', 1], ['Beef liver', 1],
  ['Kefir with cinnamon', 5], ['Leafy greens massaged in lemon juice', 7], ['Sweet potato with tahini', 3],
  ['Green tea with mint', 5], ['Watermelon with lime', 3], ['16 oz water on waking', 7],
  ['12-hour overnight fast', 7],
]

const FILL = '#8C7A5F' // nutrition tint — warm olive

// Evenly-spaced day positions for n times/week (before offset).
const evenPositions = (n) => Array.from({ length: n }, (_, i) => Math.floor((i * 7) / n))

// Pick the days for a food eaten n×/week, offset to keep the week balanced against
// the given day-loads (fewest collisions, then most even spread).
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

const loadsOf = (foods) => {
  const l = [0, 0, 0, 0, 0, 0, 0]
  foods.forEach((f) => f.days.forEach((v, d) => { if (v) l[d]++ }))
  return l
}

// Seed the staples, distributing each across the week and balancing day-loads
// (high-frequency foods placed first so the rare ones fill the gaps).
function seedFoods() {
  const loads = [0, 0, 0, 0, 0, 0, 0]
  const withIdx = SEED.map(([name, perWeek], idx) => ({ name, perWeek, idx }))
  const out = {}
  ;[...withIdx].sort((a, b) => b.perWeek - a.perWeek).forEach((it) => {
    const days = bestDays(it.perWeek, loads)
    days.forEach((v, d) => { if (v) loads[d]++ })
    out[it.idx] = { id: uid(), name: it.name, days }
  })
  return SEED.map((_, i) => out[i])
}

export default function Diet() {
  const [stored, setFoods] = useLocalStorage('mos:diet:foods', [])
  const [seeded, setSeeded] = useLocalStorage('mos:diet:seeded', false)
  const foods = Array.isArray(stored) ? stored : []

  // One-time seed of Melissa's staples.
  useEffect(() => {
    if (!seeded && foods.length === 0) { setFoods(seedFoods()); setSeeded(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [name, setName] = useState('')
  const [freq, setFreq] = useState(5)

  const add = () => {
    const t = name.trim()
    if (!t) return
    const days = bestDays(freq, loadsOf(foods)) // place it on the days that best fit
    setFoods((p) => [{ id: uid(), name: t, days }, ...(Array.isArray(p) ? p : [])])
    setName(''); setFreq(5)
  }
  const toggleDay = (id, d) => setFoods((p) => (Array.isArray(p) ? p : []).map((f) => (f.id === id ? { ...f, days: f.days.map((v, i) => (i === d ? !v : v)) } : f)))
  const remove = (id) => setFoods((p) => (Array.isArray(p) ? p : []).filter((f) => f.id !== id))

  const loads = loadsOf(foods)
  const maxLoad = Math.max(1, ...loads)

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mx-auto mb-8 max-w-md text-center text-sm italic leading-relaxed text-stone-400">
        What I eat, and how often. The dots are the week — tap one to move a day.
      </p>

      {/* Week rhythm — how the plate lands across the seven days */}
      <div className="mb-10 rounded-2xl border border-stone-200 bg-cream/50 p-5">
        <div className="grid grid-cols-7 gap-2">
          {DAY_INIT.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-full items-end justify-center">
                <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(6, (loads[i] / maxLoad) * 100)}%`, backgroundColor: FILL, opacity: 0.25 + 0.6 * (loads[i] / maxLoad) }} />
              </div>
              <span className="text-[11px] tracking-wider text-stone-400">{d}</span>
              <span className="text-xs font-medium tabular-nums text-stone-600">{loads[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add a food — name + how many times a week; it lands on the best-fit days */}
      <div className="mx-auto mb-8 flex max-w-xl flex-wrap items-center gap-2 rounded-full border border-stone-200 bg-cream py-2 pl-5 pr-2 transition-colors focus-within:border-stone-400">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a food…"
          className="min-w-[8rem] flex-1 bg-transparent py-1.5 text-sm outline-none placeholder-stone-300"
        />
        <div className="flex items-center gap-2 rounded-full bg-stone-500/5 px-2 py-1">
          <button onClick={() => setFreq((f) => Math.max(1, f - 1))} className="text-stone-400 hover:text-stone-800" aria-label="Fewer"><Minus size={14} /></button>
          <span className="w-16 text-center text-xs tabular-nums text-stone-600">{freq}×/wk</span>
          <button onClick={() => setFreq((f) => Math.min(7, f + 1))} className="text-stone-400 hover:text-stone-800" aria-label="More"><Plus size={14} /></button>
        </div>
        <button onClick={add} className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-colors hover:bg-stone-700">Add</button>
      </div>

      {/* Staples — each with its weekly rhythm */}
      <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-cream/40">
        {foods.map((f) => {
          const count = f.days.filter(Boolean).length
          return (
            <div key={f.id} className="group flex items-center gap-4 px-5 py-3.5">
              <span className="flex-1 font-serif text-lg leading-tight text-stone-800">{f.name}</span>
              <div className="flex items-center gap-1.5">
                {f.days.map((on, d) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(f.id, d)}
                    title={DAY_FULL[d]}
                    aria-label={`${DAY_FULL[d]} ${on ? 'on' : 'off'}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition-all"
                    style={on
                      ? { backgroundColor: FILL, color: '#FAF8F3' }
                      : { backgroundColor: 'transparent', color: '#C4BDB0', boxShadow: 'inset 0 0 0 1px #E3DED2' }}
                  >
                    {DAY_INIT[d]}
                  </button>
                ))}
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-stone-400">{count}×</span>
              <button onClick={() => remove(f.id)} aria-label="Remove" className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={15} /></button>
            </div>
          )
        })}
        {foods.length === 0 && <p className="px-5 py-8 text-center text-sm italic text-stone-300">Nothing yet — add your first staple above.</p>}
      </div>
    </div>
  )
}
