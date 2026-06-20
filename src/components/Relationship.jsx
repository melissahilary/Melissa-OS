import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { parseKey, longDate } from '../lib/date'
import SectionTitle from './shared/SectionTitle'

const uid = () => Math.random().toString(36).slice(2, 10)

function subtractMinutes(timeStr, minutes) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  let total = h * 60 + m - minutes
  total = ((total % 1440) + 1440) % 1440
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function Relationship() {
  const [data, setData] = useLocalStorage('mos:rel', {
    anniversary: '',
    dateNights: [],
    ideas: [],
    habits: [],
  })

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
    <div>
      <SectionTitle kicker="03 · The two of us" title="Relationship." />

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

      <DateNights data={data} setData={setData} subtractMinutes={subtractMinutes} />

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

function DateNights({ data, setData, subtractMinutes }) {
  const [draft, setDraft] = useState({ place: '', cost: '', date: '', departure: '', duration: '' })
  const add = () => {
    if (!draft.place.trim()) return
    setData((d) => ({ ...d, dateNights: [...d.dateNights, { id: uid(), ...draft, outfitReady: false }] }))
    setDraft({ place: '', cost: '', date: '', departure: '', duration: '' })
  }
  return (
    <section className="mb-12">
      <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-5">Scheduled date nights.</h2>

      <div className="mb-6 grid gap-2 md:grid-cols-6">
        <input value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} placeholder="Place" className="md:col-span-2 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
        <input value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} type="number" placeholder="$" className="bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
        <input value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} type="date" className="bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
        <input value={draft.departure} onChange={(e) => setDraft({ ...draft, departure: e.target.value })} type="time" className="bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
        <div className="flex gap-2">
          <input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="Duration" className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
          <button onClick={add} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700"><Plus size={16} /></button>
        </div>
      </div>

      <div className="space-y-3">
        {data.dateNights.map((dn) => {
          const getReady = subtractMinutes(dn.departure, dn.outfitReady ? 30 : 60)
          return (
            <div key={dn.id} className="group border border-stone-200 px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-xl text-stone-900">{dn.place}</h3>
                  <p className="mt-1 text-sm text-stone-500">
                    {dn.date ? longDate(parseKey(dn.date)) : 'No date set'}
                    {dn.departure ? ` · leave at ${dn.departure}` : ''}
                    {dn.duration ? ` · ${dn.duration}` : ''}
                    {dn.cost ? ` · $${dn.cost}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setData((d) => ({ ...d, dateNights: d.dateNights.filter((x) => x.id !== dn.id) }))}
                  className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <button
                  onClick={() =>
                    setData((d) => ({ ...d, dateNights: d.dateNights.map((x) => (x.id === dn.id ? { ...x, outfitReady: !x.outfitReady } : x)) }))
                  }
                  className={`px-2.5 py-1 text-xs border transition-colors ${
                    dn.outfitReady ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-500 hover:border-stone-500'
                  }`}
                >
                  {dn.outfitReady ? 'Outfit ready' : 'Outfit not ready'}
                </button>
                {getReady && (
                  <span className="text-sm text-stone-500">
                    Start getting ready by <span className="text-stone-900">{getReady}</span>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
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
        <button onClick={commit} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700"><Plus size={16} /></button>
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
      <button onClick={commit} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700"><Plus size={16} /></button>
    </div>
  )
}
