import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { dateKey, parseKey, longDate } from '../../lib/date'
import * as store from '../../lib/dataStore'

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

// Sub-blurbs removed app-wide — the title carries the page.
const Blurb = () => null

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

// A shelf of things you keep and keep using. Every item is a real record —
// brand, what it's for, how often, when you last replaced it, a link — and can
// be sent straight to the shopping list when it runs out.
export function CategoryShelf({ storeKey, blurb, suggestions, notePlaceholder }) {
  const [stored, setList] = useLocalStorage(storeKey, [])
  const items = Array.isArray(stored) ? stored : []
  const [openId, setOpenId] = useState(null)

  const add = (name) => { const it = { id: uid(), name, brand: '', note: '', cadence: '', lastBought: '', link: '' }; setList((p) => [it, ...(Array.isArray(p) ? p : [])]); setOpenId(it.id) }
  const update = (id, patch) => setList((p) => (Array.isArray(p) ? p : []).map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const remove = (id) => { setList((p) => (Array.isArray(p) ? p : []).filter((it) => it.id !== id)); setOpenId(null) }
  const toShopping = (name) => {
    const t = (name || '').trim()
    if (!t) return
    const cur = store.get('mos:shopping', [])
    const arr = Array.isArray(cur) ? cur : []
    if (!arr.some((x) => !x.bought && (x.text || '').trim().toLowerCase() === t.toLowerCase())) {
      store.set('mos:shopping', [{ id: uid(), text: t, bought: false, addedDate: dateKey(new Date()), boughtDate: '' }, ...arr])
    }
  }

  const open = items.find((x) => x.id === openId) || null
  const inputCls = 'w-full bg-transparent border-b border-stone-200 pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900'

  return (
    <div className="mx-auto max-w-2xl">
      <AddBar suggestions={suggestions} placeholder="Add one…" onAdd={add} />

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((it) => (
            <button key={it.id} onClick={() => setOpenId(it.id)} className="rounded-2xl border border-stone-200 bg-cream/50 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <p className="truncate font-serif text-xl leading-tight text-stone-900">{it.name || 'Untitled'}</p>
              <p className="mt-1 truncate text-xs text-stone-400">{[it.brand, it.note, it.cadence].filter(Boolean).join(' · ') || 'tap to fill in'}</p>
              {it.lastBought && <p className="mt-2 text-[11px] tabular-nums text-stone-300">replaced {it.lastBought}</p>}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-200 py-12 text-center font-serif italic text-lg text-stone-300">Nothing here yet.</p>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setOpenId(null)} />
          <div className="relative w-full max-w-md rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
            <div className="space-y-5 px-6 pb-2 pt-6">
              <input autoFocus value={open.name} onChange={(e) => update(open.id, { name: e.target.value })} placeholder="Name it" className="w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-2xl text-stone-900 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-900" />
              <div className="grid grid-cols-2 gap-4">
                <div><p className="kicker mb-1.5 text-stone-400">Brand</p><input value={open.brand || ''} onChange={(e) => update(open.id, { brand: e.target.value })} placeholder="who makes it" className={inputCls} /></div>
                <div><p className="kicker mb-1.5 text-stone-400">How often</p><input value={open.cadence || ''} onChange={(e) => update(open.id, { cadence: e.target.value })} placeholder="daily · weekly" className={inputCls} /></div>
              </div>
              <div><p className="kicker mb-1.5 text-stone-400">What it&apos;s for</p><input value={open.note || ''} onChange={(e) => update(open.id, { note: e.target.value })} placeholder={notePlaceholder || 'what it does for you'} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="kicker mb-1.5 text-stone-400">Last replaced</p><input type="date" value={open.lastBought || ''} onChange={(e) => update(open.id, { lastBought: e.target.value })} className={inputCls} /></div>
                <div><p className="kicker mb-1.5 text-stone-400">Link</p><input value={open.link || ''} onChange={(e) => update(open.id, { link: e.target.value })} placeholder="where to rebuy" className={inputCls} /></div>
              </div>
              <button onClick={() => toShopping(open.name)} className="w-full rounded-xl border border-dashed border-stone-300 px-4 py-2.5 text-sm text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900">Running low — add to shopping list</button>
            </div>
            <div className="flex items-center justify-between px-6 pb-6 pt-4">
              <button onClick={() => remove(open.id)} className="text-xs text-stone-400 hover:text-phase-menstrual">Remove</button>
              <div className="flex items-center gap-3">
                {open.link && <a href={/^https?:/i.test(open.link) ? open.link : `https://${open.link}`} target="_blank" rel="noreferrer" className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-900">Open link</a>}
                <button onClick={() => setOpenId(null)} className="rounded-full bg-stone-900 px-8 py-2.5 text-sm text-cream hover:bg-stone-700">Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
