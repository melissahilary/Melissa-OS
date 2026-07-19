import React, { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { parseKey, longDate } from '../lib/date'
import SectionTitle from './shared/SectionTitle'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'
import { useRegisterAdd } from './shared/AddButton'

const uid = () => Math.random().toString(36).slice(2, 10)

const focusAdd = (ref) => {
  const el = ref.current && ref.current.querySelector('input[placeholder], textarea[placeholder]')
  if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
}

export default function Relationship({ subPage, cycleConfig }) {
  if (subPage === 'monthly') return <CategoryCalendar category="relationship" cycleConfig={cycleConfig} noun="Plan" />
  if (subPage === 'weekly') return <CategoryWeekly category="relationship" noun="Plan" />
  return <RelationshipOverview />
}

function RelationshipOverview() {
  const rootRef = useRef(null)
  const [data, setData] = useLocalStorage('mos:rel', {
    anniversary: '',
    dateNights: [],
    ideas: [],
    habits: [],
  })
  useRegisterAdd(() => focusAdd(rootRef), [])

  const daysUntilAnniversary = (() => {
    if (!data.anniversary) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const ann = parseKey(data.anniversary)
    const next = new Date(today.getFullYear(), ann.getMonth(), ann.getDate())
    if (next < today) next.setFullYear(today.getFullYear() + 1)
    return Math.round((next - today) / 86400000)
  })()

  return (
    <div ref={rootRef}>
      <SectionTitle kicker="03 · The two of us" title="Relationships." />

      {/* Anniversary */}
      <section className="mb-12 flex flex-wrap items-end gap-8 border border-stone-200 bg-white/40 px-5 py-4">
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Anniversary</label>
          <input
            type="date"
            value={data.anniversary}
            onChange={(e) => setData((d) => ({ ...d, anniversary: e.target.value }))}
            className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
          />
        </div>
        {daysUntilAnniversary != null && (
          <div>
            <p className="kicker text-stone-400 mb-1">Countdown</p>
            <p className="font-serif italic text-3xl text-stone-900">
              {daysUntilAnniversary === 0 ? 'Today' : `${daysUntilAnniversary} days`}
            </p>
          </div>
        )}
      </section>

      {/* Ideas */}
      <SimpleList
        title="Date night ideas."
        placeholder="Somewhere worth dressing for"
        items={data.ideas}
        onAdd={(text) => setData((d) => ({ ...d, ideas: [...d.ideas, { id: uid(), text }] }))}
        onRemove={(id) => setData((d) => ({ ...d, ideas: d.ideas.filter((x) => x.id !== id) }))}
      />

      {/* Habits with confirm toggle */}
      <section className="mt-12">
        <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-4">Daily habits.</h2>
        <HabitInput onAdd={(text) => setData((d) => ({ ...d, habits: [...d.habits, { id: uid(), text, confirm: false }] }))} />
        <div className="divide-y divide-stone-100">
          {data.habits.map((h) => (
            <div key={h.id} className="group flex items-center gap-3 py-2.5">
              <span className="flex-1 text-sm text-stone-800">{h.text}</span>
              <button
                onClick={() =>
                  setData((d) => ({ ...d, habits: d.habits.map((x) => (x.id === h.id ? { ...x, confirm: !x.confirm } : x)) }))
                }
                className={`px-2.5 py-1 text-xs border transition-colors ${
                  h.confirm ? 'bg-mauve text-white border-mauve' : 'border-stone-300 text-stone-500 hover:border-stone-500'
                }`}
              >
                Confirm w/ Tariq
              </button>
              <button
                onClick={() => setData((d) => ({ ...d, habits: d.habits.filter((x) => x.id !== h.id) }))}
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

function SimpleList({ title, placeholder, items, onAdd, onRemove }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }
  return (
    <section>
      <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-4">{title}</h2>
      <div className="mb-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
      </div>
      <div className="divide-y divide-stone-100">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-3 py-2.5">
            <span className="flex-1 text-sm text-stone-800">{it.text}</span>
            <button onClick={() => onRemove(it.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function HabitInput({ onAdd }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }
  return (
    <div className="mb-4 flex items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        placeholder="Something we hold to"
        className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
      />
    </div>
  )
}
