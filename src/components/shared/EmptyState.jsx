import React from 'react'

// ── The empty state, once.
//
// One structure everywhere in Becoming, with only the glyph, the noun and the
// line changing. Three elements: state, one line, one button. Never four, never
// a paragraph, never an aside, never "your journey."
//
// The button always carries a verb and its object — "Add a list", not "Add".
export default function EmptyState({ glyph, line, action, onAction, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 px-6 py-16 text-center">
      {glyph && <p aria-hidden className="font-serif text-3xl leading-none text-stone-300">{glyph}</p>}
      <p className="mt-4 font-serif italic text-lg text-stone-400">{line}</p>
      {action && (
        <button
          onClick={onAction}
          className="mt-5 rounded-full bg-stone-900 px-6 py-2.5 text-sm text-cream transition-opacity hover:opacity-90"
        >
          {action}
        </button>
      )}
      {children}
    </div>
  )
}
