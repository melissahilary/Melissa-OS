import React, { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import SectionTitle from './shared/SectionTitle'
import { useRegisterAdd } from './shared/AddButton'
import Checkbox from './shared/Checkbox'

const uid = () => Math.random().toString(36).slice(2, 10)
const ROOMS = ['Kitchen', 'Bath', 'Bedroom', 'Office', 'Dog Station', 'Supplement Cabinet', 'Cleaning', 'Other']

// Floating Add focuses the page's primary add field (Enter commits).
const focusAdd = (ref) => {
  const el = ref.current && ref.current.querySelector('input[placeholder], textarea[placeholder]')
  if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
}

export default function Household() {
  const rootRef = useRef(null)
  const [items, setItems] = useLocalStorage('mos:menu:shop', [])
  const [draft, setDraft] = useState({ name: '', room: 'Kitchen', cost: '', type: 'shop' })
  useRegisterAdd(() => focusAdd(rootRef), [])

  const add = () => {
    if (!draft.name.trim()) return
    setItems((prev) => [
      ...prev,
      { id: uid(), name: draft.name.trim(), room: draft.room, cost: draft.cost, type: draft.type, done: false },
    ])
    setDraft({ name: '', room: 'Kitchen', cost: '', type: 'shop' })
  }
  const toggle = (id) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))

  const outstanding = items
    .filter((i) => !i.done)
    .reduce((sum, i) => sum + (Number(i.cost) || 0), 0)

  return (
    <div ref={rootRef}>
      <SectionTitle kicker="06 · Running the house" title="Household." />

      <section>
        <div className="mb-2 flex justify-end">
          <span className="text-sm text-stone-500">Outstanding: ${outstanding.toFixed(0)}</span>
        </div>
        <header className="mb-4">
          <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900">Shopping · restock</h2>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Item"
            className="min-w-[160px] flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
          />
          <select
            value={draft.room}
            onChange={(e) => setDraft({ ...draft, room: e.target.value })}
            className="border-b border-stone-300 bg-transparent pb-1.5 text-sm outline-none"
          >
            {ROOMS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <input
            value={draft.cost}
            onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            type="number"
            placeholder="$"
            className="w-20 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
          />
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            className="border-b border-stone-300 bg-transparent pb-1.5 text-sm outline-none"
          >
            <option value="shop">shop</option>
            <option value="restock">restock</option>
          </select>
        </div>

        {items.length === 0 ? (
          <p className="font-serif italic text-lg text-stone-400">Everything is stocked.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {items.map((item) => (
              <div key={item.id} className="group flex items-center gap-3 py-2.5">
                <Checkbox checked={item.done} onClick={() => toggle(item.id)} />
                <span className={`flex-1 text-sm ${item.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
                  {item.name}
                </span>
                <span className="kicker text-stone-400">{item.room}</span>
                <span className="kicker text-stone-400">{item.type}</span>
                {item.cost ? <span className="text-sm text-stone-500 tabular-nums">${item.cost}</span> : null}
                <button
                  onClick={() => remove(item.id)}
                  className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
