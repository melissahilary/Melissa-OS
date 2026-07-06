import React, { useEffect, useRef, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, parseKey, MONTHS } from '../lib/date'
import SectionTitle from './shared/SectionTitle'
import { useRegisterAdd } from './shared/AddButton'

const uid = () => Math.random().toString(36).slice(2, 10)

// Guiding prompts shown as placeholder text on each side of a card.
const CURRENT_PROMPT = `• Characteristics — what traits show up here? (accommodating, guarded, sharp, small?)
• Habits — what do I automatically do around this person? (check their mood first, over-explain, shrink, perform?)
• Boundaries — what do I allow here that costs me? What do I never say?
• Energy — how do I feel before, during, and after time with them? Drained or fed?`

const FUTURE_PROMPT = `• Characteristics — what traits does she lead with here?
• Habits — what does she do instead? What has she stopped doing?
• Boundaries — what does she no longer explain, tolerate, or apologize for?
• Energy — what does she bring into the room, and what does she refuse to absorb?`

const dateLabel = (d) => { const x = parseKey(d); return `${MONTHS[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}` }

// ── Audit — a Google Keep–style board. Each card is one relationship, with two
// sides: current me in it, and future me in it. Unlimited cards.
export default function Audit() {
  const [stored, setCards] = useLocalStorage('mos:audit:cards', [])
  const cards = Array.isArray(stored) ? stored : []
  const [draft, setDraft] = useState('')
  const [openId, setOpenId] = useState(null)

  const add = (title) => {
    const t = (title != null ? title : draft).trim()
    if (!t) return null
    const card = { id: uid(), title: t, current: '', future: '', date: dateKey(new Date()) }
    setCards((prev) => [card, ...(Array.isArray(prev) ? prev : [])])
    setDraft('')
    return card.id
  }
  const update = (id, patch) => setCards((prev) => (Array.isArray(prev) ? prev : []).map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const remove = (id) => setCards((prev) => (Array.isArray(prev) ? prev : []).filter((c) => c.id !== id))

  // Global Add → create a blank card and open it straight away.
  useRegisterAdd(() => { const id = add('Untitled'); if (id) setOpenId(id) }, [draft, stored])

  const openCard = cards.find((c) => c.id === openId) || null

  return (
    <div>
      <SectionTitle kicker="The audit" title="Audit." />
      <p className="mb-8 max-w-2xl font-serif italic text-lg text-stone-500">
        One card per relationship — who you are in it now, and who you're becoming.
      </p>

      <div className="mb-8 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { const id = add(); if (id) setOpenId(id) } }}
          placeholder="Name a relationship — a person, a role, a dynamic"
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={() => { const id = add(); if (id) setOpenId(id) }} className="bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700">
          New audit
        </button>
      </div>

      {cards.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">No audits yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <AuditCard key={c.id} card={c} onOpen={() => setOpenId(c.id)} />
          ))}
        </div>
      )}

      {openCard && (
        <AuditDetail
          card={openCard}
          onChange={(patch) => update(openCard.id, patch)}
          onDelete={() => { remove(openCard.id); setOpenId(null) }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function AuditCard({ card, onOpen }) {
  const snippet = (card.current || card.future || '').split('\n').find((l) => l.trim()) || ''
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-start border border-stone-200 bg-white/40 p-4 text-left transition-shadow hover:shadow-md"
    >
      <h3 className="font-serif text-xl text-stone-900">{card.title || 'Untitled'}</h3>
      {snippet ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-500">{snippet}</p>
      ) : (
        <p className="mt-2 text-sm italic text-stone-300">Nothing written yet.</p>
      )}
      <p className="kicker text-stone-400 mt-3">{dateLabel(card.date)}</p>
    </button>
  )
}

// A textarea that grows with its content.
function AutoTextarea({ value, onChange, placeholder }) {
  const ref = useRef(null)
  const autosize = () => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }
  useEffect(() => { autosize() }, [])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => { onChange(e.target.value); autosize() }}
      placeholder={placeholder}
      className="block w-full resize-none overflow-hidden bg-white/50 border border-stone-200 px-3 py-2.5 text-sm leading-relaxed text-stone-800 placeholder-stone-300 outline-none focus:border-stone-900"
      style={{ minHeight: '30vh' }}
    />
  )
}

function AuditDetail({ card, onChange, onDelete, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-3xl bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <input
            value={card.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Title of relationship"
            autoFocus
            className="w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none"
          />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="px-6 py-5">
          <p className="kicker text-stone-400 mb-4">{dateLabel(card.date)}</p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <p className="kicker text-stone-500 mb-2">Current me in this relationship</p>
              <AutoTextarea value={card.current || ''} onChange={(v) => onChange({ current: v })} placeholder={CURRENT_PROMPT} />
            </div>
            <div>
              <p className="kicker text-stone-500 mb-2">Future me in this relationship</p>
              <AutoTextarea value={card.future || ''} onChange={(v) => onChange({ future: v })} placeholder={FUTURE_PROMPT} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-phase-menstrual">
            <Trash2 size={15} /> Delete
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Done</button>
        </div>
      </div>
    </div>
  )
}
