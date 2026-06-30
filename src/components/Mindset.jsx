import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import Checkbox from './shared/Checkbox'
import InlineText from './shared/InlineText'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Mindset() {
  return <Influences />
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
