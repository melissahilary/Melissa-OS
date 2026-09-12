import React from 'react'

// ── The readings of a set.
//
// One box, one filled cell, marks only. The board had cells of 32 by 36 with a
// 14-unit mark; the goals wall had 36 by 44 with a 17. Side by side on a phone
// that is not a variation, it is two components — so there is one now, and both
// pages get the larger target, which is the one a thumb can actually hit.
//
// Labels are the title and the accessible name, never type on the button: four
// words across the top of a phone wrap the row and push the primary action onto
// a line of its own.
export default function ViewSwitcher({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex rounded-full border border-stone-200 bg-cream p-0.5 ${className}`}>
      {options.map((o) => {
        const on = value === o.id
        const Icon = o.icon
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            title={o.note ? `${o.label} — ${o.note}` : o.label}
            aria-label={o.label}
            aria-pressed={on}
            className={`flex h-9 w-11 items-center justify-center rounded-full transition-colors ${on ? 'bg-stone-900 text-cream' : 'text-stone-900 hover:bg-stone-500/5'}`}
          >
            <Icon size={16} strokeWidth={1.7} />
          </button>
        )
      })}
    </div>
  )
}
