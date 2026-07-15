import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import InlineText from './shared/InlineText'
import { dateKey } from '../lib/date'

const uid = () => Math.random().toString(36).slice(2, 10)

// ── Diagnostics — a running log of labs and health markers. Each row is a marker
// with its latest result and the date it was taken.
export default function Diagnostics() {
  const [stored, setItems] = useLocalStorage('mos:diagnostics', [])
  const items = Array.isArray(stored) ? stored : []
  const [draft, setDraft] = useState('')

  const add = (name) => {
    const t = (name != null ? name : draft).trim()
    if (!t) return
    setItems((prev) => [{ id: uid(), name: t, result: '', date: dateKey(new Date()), notes: '' }, ...(Array.isArray(prev) ? prev : [])])
    setDraft('')
  }
  const edit = (id, patch) => setItems((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const remove = (id) => setItems((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id))

  useRegisterAdd(() => add('New marker'), [draft, stored])

  return (
    <div className="mb-12">
      <div className="mb-6 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="A marker to track — ferritin, vitamin D, TSH…"
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={() => add()} className="bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700">Add</button>
      </div>

      {items.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">Nothing logged yet.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {items.map((it) => (
            <div key={it.id} className="group grid grid-cols-12 items-center gap-3 py-3">
              <InlineText
                value={it.name}
                onChange={(t) => edit(it.id, { name: t })}
                className="col-span-5 text-sm font-medium text-stone-800 bg-transparent outline-none"
              />
              <input
                value={it.result || ''}
                onChange={(e) => edit(it.id, { result: e.target.value })}
                placeholder="Result"
                className="col-span-3 bg-transparent border-b border-stone-200 pb-1 text-sm text-stone-700 outline-none focus:border-stone-900"
              />
              <input
                type="date"
                value={it.date || ''}
                onChange={(e) => edit(it.id, { date: e.target.value })}
                className="col-span-3 bg-transparent border-b border-stone-200 pb-1 text-xs text-stone-500 outline-none focus:border-stone-900"
              />
              <div className="col-span-1 flex justify-end">
                <button onClick={() => remove(it.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
