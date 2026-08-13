import React, { useState } from 'react'
import { Sun, Moon, Plus, X, Check } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Skincare({ subPage, cycleConfig }) {
  if (subPage === 'monthly') return <CategoryCalendar category="skincare" cycleConfig={cycleConfig} noun="Step" />
  if (subPage === 'morning') return <Routine slot="am" Icon={Sun} intro="The order you begin the day in — checked off as you go." />
  if (subPage === 'evening') return <Routine slot="pm" Icon={Moon} intro="How you wind the day down, step by step." />
  if (subPage === 'products') return <Products />
  return <CategoryWeekly category="skincare" noun="Step" />
}

// ── A skincare ritual — an ordered set of steps you build once and tick off each
// day. The step number sits in a badge that inks and becomes a check when done.
function Routine({ slot, Icon, intro }) {
  const [stored, setSteps] = useLocalStorage(`mos:skincare:${slot}`, [])
  const steps = Array.isArray(stored) ? stored : []
  const [doneStore, setDone] = useLocalStorage(`mos:skincare:${slot}:done`, {})
  const dm = doneStore && typeof doneStore === 'object' ? doneStore : {}
  const todayKey = dateKey(new Date())
  const doneToday = Array.isArray(dm[todayKey]) ? dm[todayKey] : []
  const [draft, setDraft] = useState('')

  const add = () => {
    const t = draft.trim()
    if (!t) return
    setSteps((p) => [...(Array.isArray(p) ? p : []), { id: uid(), text: t }])
    setDraft('')
  }
  const update = (id, text) => setSteps((p) => (Array.isArray(p) ? p : []).map((s) => (s.id === id ? { ...s, text } : s)))
  const remove = (id) => setSteps((p) => (Array.isArray(p) ? p : []).filter((s) => s.id !== id))
  const toggle = (id) =>
    setDone((p) => {
      const pp = p && typeof p === 'object' ? p : {}
      const cur = Array.isArray(pp[todayKey]) ? pp[todayKey] : []
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      return { ...pp, [todayKey]: next }
    })

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-9 flex flex-col items-center text-center">
        <Icon size={26} strokeWidth={1.25} className="text-stone-400" />
        <p className="mt-3 max-w-xs text-sm italic leading-relaxed text-stone-400">{intro}</p>
      </div>

      <ol className="space-y-2.5">
        {steps.map((s, i) => {
          const done = doneToday.includes(s.id)
          return (
            <li key={s.id} className="group flex items-center gap-3.5 rounded-2xl border border-stone-200 bg-cream/50 px-4 py-3 transition-colors focus-within:border-stone-400">
              <button
                onClick={() => toggle(s.id)}
                aria-label={done ? 'Done today' : 'Mark done'}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-serif text-sm transition-all ${done ? 'border-transparent text-cream' : 'border-stone-300 text-stone-400 hover:border-stone-500'}`}
                style={done ? { backgroundColor: '#1C1C1A' } : undefined}
              >
                {done ? <Check size={15} strokeWidth={2} /> : i + 1}
              </button>
              <input
                value={s.text}
                onChange={(e) => update(s.id, e.target.value)}
                className={`flex-1 bg-transparent font-serif text-lg outline-none ${done ? 'text-stone-400 line-through' : 'text-stone-800'}`}
              />
              <button onClick={() => remove(s.id)} aria-label="Remove step" className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={15} /></button>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex items-center gap-3.5 rounded-2xl border border-dashed border-stone-200 px-4 py-3 transition-colors focus-within:border-stone-400">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-300"><Plus size={16} /></span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a step…"
          className="flex-1 bg-transparent font-serif text-lg text-stone-800 placeholder-stone-300 outline-none"
        />
      </div>
    </div>
  )
}

// ── Products Used — a vanity shelf. Each product is a soft card: its name, and a
// quiet note for the brand, the strength, or when you reach for it.
function Products() {
  const [stored, setList] = useLocalStorage('mos:skincare:products', [])
  const items = Array.isArray(stored) ? stored : []
  const [name, setName] = useState('')

  const add = () => {
    const t = name.trim()
    if (!t) return
    setList((p) => [{ id: uid(), name: t, note: '' }, ...(Array.isArray(p) ? p : [])])
    setName('')
  }
  const update = (id, patch) => setList((p) => (Array.isArray(p) ? p : []).map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const remove = (id) => setList((p) => (Array.isArray(p) ? p : []).filter((it) => it.id !== id))

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mx-auto mb-8 flex max-w-md items-center gap-1.5 rounded-full border border-stone-200 bg-cream py-1.5 pl-5 pr-1.5 transition-colors focus-within:border-stone-400">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a product…"
          className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder-stone-300"
        />
        <button onClick={add} className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-colors hover:bg-stone-700">Add</button>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((it) => (
            <div key={it.id} className="group relative rounded-2xl border border-stone-200 bg-cream/50 p-5 transition-shadow hover:shadow-sm">
              <button onClick={() => remove(it.id)} aria-label="Remove" className="absolute right-3 top-3 text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={15} /></button>
              <input
                value={it.name}
                onChange={(e) => update(it.id, { name: e.target.value })}
                className="w-full bg-transparent pr-6 font-serif text-xl text-stone-900 outline-none"
              />
              <input
                value={it.note}
                onChange={(e) => update(it.id, { note: e.target.value })}
                placeholder="brand · strength · when you use it"
                className="mt-1.5 w-full bg-transparent text-sm text-stone-500 placeholder-stone-300 outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm italic text-stone-300">No products on the shelf yet.</p>
      )}
    </div>
  )
}
