import React from 'react'
import { Plus } from 'lucide-react'

// ── The in-page add. The floating + belongs to the home page, where you're
// adding to the day at large; inside a pillar you're adding to *this* section,
// so the way in sits in the section itself — the same quiet plus-and-line the
// Influences columns have always used.
export default function AddInline({ label, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 border-b border-stone-200 py-2.5 text-left transition-colors hover:border-stone-900 ${className}`}
    >
      <Plus size={14} className="shrink-0 text-stone-300 transition-colors group-hover:text-stone-900" />
      <span className="text-sm text-stone-400 transition-colors group-hover:text-stone-800">{label}</span>
    </button>
  )
}
