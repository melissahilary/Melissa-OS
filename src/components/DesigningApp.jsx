import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import SectionTitle from './shared/SectionTitle'

const uid = () => Math.random().toString(36).slice(2, 10)
const PAGE_STATUS = ['Planned', 'Building', 'Live', 'Parked']

export default function DesigningApp() {
  const [data, setData] = useLocalStorage('mos:app', {
    pages: [],
    terminal: [],
    deadEnds: [],
    textFixes: [],
    copyFixes: [],
  })

  const mut = (key, fn) => setData((d) => ({ ...d, [key]: fn(d[key] || []) }))

  return (
    <div>
      <SectionTitle kicker="05 · The build" title="Designing An App." />

      {/* App pages with status */}
      <PagesList
        pages={data.pages}
        onAdd={(name) => mut('pages', (l) => [...l, { id: uid(), name, status: 'Planned' }])}
        onStatus={(id, status) => mut('pages', (l) => l.map((p) => (p.id === id ? { ...p, status } : p)))}
        onRemove={(id) => mut('pages', (l) => l.filter((p) => p.id !== id))}
      />

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <TextList title="Terminal log." mono items={data.terminal}
          onAdd={(t) => mut('terminal', (l) => [{ id: uid(), text: t }, ...l])}
          onRemove={(id) => mut('terminal', (l) => l.filter((x) => x.id !== id))} />
        <TextList title="Dead ends." items={data.deadEnds}
          onAdd={(t) => mut('deadEnds', (l) => [...l, { id: uid(), text: t }])}
          onRemove={(id) => mut('deadEnds', (l) => l.filter((x) => x.id !== id))} />
        <TextList title="Text fixes." items={data.textFixes}
          onAdd={(t) => mut('textFixes', (l) => [...l, { id: uid(), text: t }])}
          onRemove={(id) => mut('textFixes', (l) => l.filter((x) => x.id !== id))} />
        <TextList title="Copywrite fixes." items={data.copyFixes}
          onAdd={(t) => mut('copyFixes', (l) => [...l, { id: uid(), text: t }])}
          onRemove={(id) => mut('copyFixes', (l) => l.filter((x) => x.id !== id))} />
      </div>
    </div>
  )
}

function PagesList({ pages, onAdd, onStatus, onRemove }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }
  return (
    <section>
      <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-4">App pages.</h2>
      <div className="mb-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder="A page or screen"
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={commit} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700"><Plus size={16} /></button>
      </div>
      <div className="divide-y divide-stone-100">
        {pages.map((p) => (
          <div key={p.id} className="group flex items-center gap-3 py-2.5">
            <span className="flex-1 text-sm text-stone-800">{p.name}</span>
            <select
              value={p.status}
              onChange={(e) => onStatus(p.id, e.target.value)}
              className="border border-stone-300 bg-transparent px-2 py-1 text-xs outline-none"
            >
              {PAGE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => onRemove(p.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function TextList({ title, items, onAdd, onRemove, mono = false }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }
  return (
    <section>
      <h2 className="font-serif italic text-2xl text-stone-900 mb-3">{title}</h2>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder="Add an entry"
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={commit} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700"><Plus size={16} /></button>
      </div>
      <div className="divide-y divide-stone-100">
        {items.map((it) => (
          <div key={it.id} className="group flex items-start gap-3 py-2">
            <span className={`flex-1 text-sm text-stone-700 ${mono ? 'font-mono text-xs' : ''}`}>{it.text}</span>
            <button onClick={() => onRemove(it.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
