import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { CLASSES, summarize, money, classLabel } from '../lib/portfolio'

const uid = () => Math.random().toString(36).slice(2, 10)
const input = 'w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900'

const EMPTY = { name: '', assetClass: 'public', value: '', cost: '', notes: '' }

export default function Portfolio() {
  const [raw, setRaw] = useLocalStorage('mos:portfolio', [])
  const book = summarize(raw)
  const [draft, setDraft] = useState(EMPTY)
  const [openId, setOpenId] = useState(null)

  const commit = () => {
    const name = draft.name.trim()
    if (!name) return
    setRaw((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      { id: uid(), name, assetClass: draft.assetClass, value: draft.value, cost: draft.cost, notes: draft.notes.trim() },
    ])
    setDraft(EMPTY)
  }

  const remove = (id) => setRaw((prev) => (Array.isArray(prev) ? prev : []).filter((p) => p.id !== id))

  return (
    <div className="pb-4">
      <p className="kicker mb-3 text-center text-stone-400">The book</p>
      <h1 className="text-center font-serif text-4xl text-stone-900 md:text-5xl">Portfolio</h1>
      <p className="mx-auto mt-3 max-w-md text-center font-serif text-lg italic leading-relaxed text-stone-500">
        What the house holds, written down by hand. Prices stay where you left them.
      </p>

      <div className="mx-auto mt-10 grid max-w-3xl gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-end">
        <div>
          <p className="kicker text-stone-400">Recorded value</p>
          <p className="mt-1 font-serif text-5xl tracking-tight text-stone-900 md:text-6xl">{money(book.total)}</p>
          <p className="mt-2 text-sm text-stone-500">
            {book.count === 0
              ? 'No holdings yet.'
              : `${money(book.cost)} written as cost · ${book.gain >= 0 ? 'ahead' : 'behind'} ${money(Math.abs(book.gain))}`}
          </p>
        </div>
        <div className="space-y-3">
          {book.byClass.length === 0 && <p className="font-serif italic text-stone-400">Allocation appears once a holding has a value.</p>}
          {book.byClass.map((c) => (
            <div key={c.id}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="text-stone-700">{c.label}</span>
                <span className="text-stone-400">{Math.round(c.share * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-stone-200">
                <div className="h-full bg-stone-900" style={{ width: `${Math.min(100, c.share * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto mt-12 max-w-3xl">
        <h2 className="mb-4 font-serif text-2xl italic text-stone-900">Add a holding</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="kicker mb-1.5 block text-stone-400">Name</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && commit()} placeholder="Brokerage, house, fund" className={input} />
          </label>
          <label className="block">
            <span className="kicker mb-1.5 block text-stone-400">Class</span>
            <select value={draft.assetClass} onChange={(e) => setDraft({ ...draft, assetClass: e.target.value })} className={`${input} appearance-none`}>
              {CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="kicker mb-1.5 block text-stone-400">Value</span>
            <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && commit()} inputMode="decimal" placeholder="$" className={input} />
          </label>
          <label className="block">
            <span className="kicker mb-1.5 block text-stone-400">Cost</span>
            <input value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && commit()} inputMode="decimal" placeholder="$" className={input} />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="kicker mb-1.5 block text-stone-400">Note</span>
          <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && commit()} placeholder="Where it lives, or why you hold it" className={input} />
        </label>
        <button onClick={commit} className="mt-5 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream hover:bg-stone-700">Add to the book</button>
      </section>

      <section className="mx-auto mt-12 max-w-3xl">
        {book.rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-200 py-14 text-center font-serif italic text-lg text-stone-400">The book is open and empty.</p>
        ) : (
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {book.rows.map((p) => {
              const open = openId === p.id
              const gain = p.value - p.cost
              return (
                <li key={p.id}>
                  <button onClick={() => setOpenId(open ? null : p.id)} className="flex w-full items-baseline gap-4 py-4 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-xl text-stone-900">{p.name}</span>
                      <span className="text-xs text-stone-400">{classLabel(p.assetClass)}</span>
                    </span>
                    <span className="shrink-0 text-sm text-stone-800">{money(p.value)}</span>
                  </button>
                  {open && (
                    <div className="flex items-start justify-between gap-4 pb-4">
                      <p className="text-sm leading-relaxed text-stone-500">
                        Cost {money(p.cost)} · {gain >= 0 ? 'ahead' : 'behind'} {money(Math.abs(gain))}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                      <button onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} className="shrink-0 text-stone-300 hover:text-stone-700">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
