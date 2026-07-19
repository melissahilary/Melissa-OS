import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import Checkbox from './shared/Checkbox'
import InlineText from './shared/InlineText'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'
import { dateKey, parseKey, longDate, isSameDay } from '../lib/date'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Mindset({ subPage, cycleConfig }) {
  if (subPage === 'monthly') return <CategoryCalendar category="mindset" cycleConfig={cycleConfig} noun="Practice" />
  if (subPage === 'weekly') return <CategoryWeekly category="mindset" noun="Practice" />
  if (subPage === 'journal') return <Journal />
  return <Influences />
}

// ── Journal — one diary entry per day. Navigate day by day; today opens by
// default. Each day's writing autosaves under its date.
function Journal() {
  const today = new Date()
  const [entries, setEntries] = useLocalStorage('mos:mindset:journal', {})
  const store = entries && typeof entries === 'object' ? entries : {}
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const selected = parseKey(selectedKey)
  const text = store[selectedKey] || ''

  const shift = (days) => { const d = parseKey(selectedKey); d.setDate(d.getDate() + days); setSelectedKey(dateKey(d)) }
  const write = (val) => setEntries((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [selectedKey]: val }))
  const isToday = isSameDay(selected, today)

  // Past entries with content, most recent first (excluding the open day).
  const past = Object.keys(store)
    .filter((k) => k !== selectedKey && (store[k] || '').trim())
    .sort((a, b) => b.localeCompare(a))

  return (
    <div className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="px-2 text-sm text-stone-500 hover:text-stone-900">Prev</button>
        <div className="text-center">
          <h3 className="font-serif italic text-2xl text-stone-900">{longDate(selected)}</h3>
          {!isToday && <button onClick={() => setSelectedKey(dateKey(today))} className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-700">Back to today</button>}
        </div>
        <button onClick={() => shift(1)} className="px-2 text-sm text-stone-500 hover:text-stone-900">Next</button>
      </div>

      <textarea
        value={text}
        onChange={(e) => write(e.target.value)}
        placeholder="Dear diary…"
        className="block w-full min-h-[45vh] resize-y bg-white/40 border border-stone-200 px-5 py-4 font-serif text-lg leading-relaxed text-stone-800 placeholder-stone-300 outline-none focus:border-stone-900"
      />

      {past.length > 0 && (
        <div className="mt-8">
          <p className="kicker text-stone-400 mb-3">Past entries</p>
          <div className="divide-y divide-stone-100">
            {past.map((k) => (
              <button key={k} onClick={() => setSelectedKey(k)} className="block w-full py-3 text-left">
                <p className="kicker text-stone-400">{longDate(parseKey(k))}</p>
                <p className="mt-1 line-clamp-1 text-sm text-stone-600">{store[k].trim()}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// A yes / no checklist of influences. The two lists never show side by side —
// Yes and No are tabs; clicking one swaps to that list.
function Influences() {
  const [tab, setTab] = useState('yes')
  return (
    <div className="mb-10">
      <div className="mb-6 flex gap-1">
        {['yes', 'no'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 text-xs uppercase tracking-[0.16em] transition-colors ${tab === t ? 'bg-stone-900 text-cream' : 'text-stone-600 hover:bg-stone-100'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'yes'
        ? <InfluenceList key="yes" storageKey="mos:mindset:influences:yes" placeholder="A yes — what to let in" />
        : <InfluenceList key="no" storageKey="mos:mindset:influences:no" placeholder="A no — what to keep out" />}
    </div>
  )
}

function InfluenceList({ storageKey, placeholder }) {
  const [stored, setItems] = useLocalStorage(storageKey, [])
  const items = Array.isArray(stored) ? stored : []
  const [draft, setDraft] = useState('')
  const add = () => {
    if (!draft.trim()) return
    setItems((prev) => [...(Array.isArray(prev) ? prev : []), { id: uid(), text: draft.trim(), done: false }])
    setDraft('')
  }
  const toggle = (id) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))
  const editText = (id, text) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, text } : x)))
  const remove = (id) => setItems((prev) => prev.filter((x) => x.id !== id))

  useRegisterAdd(() => setItems((prev) => [...(Array.isArray(prev) ? prev : []), { id: uid(), text: '', done: false }]), [storageKey])

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
      </div>
      <div className="divide-y divide-stone-100">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-3 py-2.5">
            <Checkbox checked={it.done} onClick={() => toggle(it.id)} />
            <InlineText
              value={it.text}
              onChange={(t) => editText(it.id, t)}
              className={`flex-1 text-sm bg-transparent outline-none ${it.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}
            />
            <button onClick={() => remove(it.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  )
}
