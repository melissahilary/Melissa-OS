import React, { useState } from 'react'
import { AddIcon } from './marks'

// ── The in-page add. The floating + belongs to the home page, where you're
// adding to the day at large; inside a pillar you're adding to *this* section,
// so the way in sits in the section itself — the same plus-and-line the
// Influences columns use.
//
// Pass `onSubmit` for a line you type into (enter commits), or `onClick` for a
// line that opens a fuller form.
export default function AddInline({ onSubmit, onClick, label = '', className = '' }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const t = draft.trim()
    if (!t) return
    onSubmit(t)
    setDraft('')
  }

  if (onSubmit) {
    return (
      <div className={`flex items-center gap-2.5 border-b border-stone-200 pb-1.5 transition-colors focus-within:border-stone-900 ${className}`}>
        <AddIcon size={14} className="shrink-0 text-stone-300" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="flex-1 bg-transparent py-1 text-sm text-stone-800 outline-none"
        />
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 border-b border-stone-200 py-2.5 text-left transition-colors hover:border-stone-900 ${className}`}
    >
      <AddIcon size={14} className="shrink-0 text-stone-300 transition-colors group-hover:text-stone-900" />
      <span className="text-sm text-stone-400 transition-colors group-hover:text-stone-800">{label}</span>
    </button>
  )
}
