import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { dateKey, parseKey, longDate } from '../../lib/date'

// Two reusable record shapes shared across pillars:
//   CategoryLog   — dated entries (a visit / a session), newest first, with an
//                   optional place and any number of extra tracked fields.
//   CategoryShelf — things you keep and keep using (no date): a name + a note.
// Both open with an AddBar: a quiet suggestion strip over a free-text add.

const uid = () => Math.random().toString(36).slice(2, 10)

export function AddBar({ suggestions = [], placeholder, onAdd }) {
  const [val, setVal] = useState('')
  const commit = (t) => { const s = (t ?? val).trim(); if (!s) return; onAdd(s); setVal('') }
  return (
    <div className="mb-8">
      <div className="mx-auto flex max-w-md items-center gap-1.5 rounded-full border border-stone-200 bg-cream py-1.5 pl-5 pr-1.5 transition-colors focus-within:border-stone-400">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder-stone-300"
        />
        <button onClick={() => commit()} className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-colors hover:bg-stone-700">Add</button>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => commit(s)} className="rounded-full border border-stone-200 px-3.5 py-1.5 text-xs text-stone-500 transition-colors hover:border-stone-900 hover:text-stone-900">{s}</button>
          ))}
        </div>
      )}
    </div>
  )
}

const Field = ({ label, ...props }) => (
  <label className="block">
    <span className="kicker mb-1 block text-stone-400">{label}</span>
    <input {...props} className="w-full bg-transparent border-b border-stone-200 pb-1 text-sm text-stone-700 placeholder-stone-300 outline-none transition-colors focus:border-stone-900" />
  </label>
)

const Blurb = ({ children }) => (
  <p className="mx-auto mb-7 max-w-md text-center text-sm italic leading-relaxed text-stone-400">{children}</p>
)

// A dated record — newest first. `place` (optional) and `fields` (extra tracked
// inputs) are configured per category.
export function CategoryLog({ storeKey, blurb, suggestions, addNoun = 'entry', place = null, fields = [] }) {
  const [stored, setList] = useLocalStorage(storeKey, [])
  const items = Array.isArray(stored) ? stored : []
  const todayKey = dateKey(new Date())

  const add = (title) => setList((p) => [{ id: uid(), title, date: todayKey, place: '', notes: '' }, ...(Array.isArray(p) ? p : [])])
  const update = (id, patch) => setList((p) => (Array.isArray(p) ? p : []).map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const remove = (id) => setList((p) => (Array.isArray(p) ? p : []).filter((it) => it.id !== id))
  const ordered = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <div className="mx-auto max-w-xl">
      {blurb && <Blurb>{blurb}</Blurb>}
      <AddBar suggestions={suggestions} placeholder={`Log a ${addNoun}…`} onAdd={add} />

      {ordered.length > 0 ? (
        <div className="space-y-4">
          {ordered.map((it) => (
            <div key={it.id} className="group relative rounded-2xl border border-stone-200 bg-cream/50 p-5">
              <button onClick={() => remove(it.id)} aria-label="Remove" className="absolute right-3 top-3 text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={15} /></button>
              <input value={it.title} onChange={(e) => update(it.id, { title: e.target.value })} className="w-full bg-transparent pr-6 font-serif text-xl text-stone-900 outline-none" />
              <p className="mb-4 mt-0.5 text-xs text-stone-400">{it.date ? longDate(parseKey(it.date)) : ''}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <label className="block">
                  <span className="kicker mb-1 block text-stone-400">Date</span>
                  <input type="date" value={it.date} onChange={(e) => update(it.id, { date: e.target.value })} className="w-full bg-transparent border-b border-stone-200 pb-1 text-sm text-stone-700 outline-none focus:border-stone-900" />
                </label>
                {place && <Field label={place.label} value={it.place || ''} onChange={(e) => update(it.id, { place: e.target.value })} placeholder={place.placeholder} />}
                {fields.map((f) => (
                  <Field key={f.key} label={f.label} value={it[f.key] || ''} onChange={(e) => update(it.id, { [f.key]: e.target.value })} placeholder={f.placeholder} />
                ))}
                <div className="col-span-2">
                  <Field label="Notes" value={it.notes || ''} onChange={(e) => update(it.id, { notes: e.target.value })} placeholder="anything to remember" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm italic text-stone-300">Nothing logged yet.</p>
      )}
    </div>
  )
}

// A shelf of things you keep and keep using — no date, just a name and a note.
export function CategoryShelf({ storeKey, blurb, suggestions, notePlaceholder }) {
  const [stored, setList] = useLocalStorage(storeKey, [])
  const items = Array.isArray(stored) ? stored : []

  const add = (name) => setList((p) => [{ id: uid(), name, note: '' }, ...(Array.isArray(p) ? p : [])])
  const update = (id, patch) => setList((p) => (Array.isArray(p) ? p : []).map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const remove = (id) => setList((p) => (Array.isArray(p) ? p : []).filter((it) => it.id !== id))

  return (
    <div className="mx-auto max-w-2xl">
      {blurb && <Blurb>{blurb}</Blurb>}
      <AddBar suggestions={suggestions} placeholder="Add one…" onAdd={add} />

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((it) => (
            <div key={it.id} className="group relative rounded-2xl border border-stone-200 bg-cream/50 p-5 transition-shadow hover:shadow-sm">
              <button onClick={() => remove(it.id)} aria-label="Remove" className="absolute right-3 top-3 text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={15} /></button>
              <input value={it.name} onChange={(e) => update(it.id, { name: e.target.value })} className="w-full bg-transparent pr-6 font-serif text-xl text-stone-900 outline-none" />
              <input value={it.note} onChange={(e) => update(it.id, { note: e.target.value })} placeholder={notePlaceholder} className="mt-1.5 w-full bg-transparent text-sm text-stone-500 placeholder-stone-300 outline-none" />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm italic text-stone-300">Nothing here yet.</p>
      )}
    </div>
  )
}
