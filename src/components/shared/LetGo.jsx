import React from 'react'
import { OXBLOOD } from './SwipeAway'

// ── Letting a thing go.
//
// The same two answers wherever a row is pulled aside: today only, or for
// good. The app cannot tell them apart and guessing is how a bad morning
// quietly becomes a lost habit, so it asks — once, in two buttons.
//
// It used to name the place the row came from above the row itself — AM
// ROUTINE, then dry brush. She has just slid dry brush; she knows where it
// was. The name alone is the whole question.
export default function LetGo({ name, onSkip, onDrop, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      style={{ background: 'rgba(22,19,15,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md px-7 pb-9 pt-10 sm:px-9" style={{ background: '#68472C', color: '#F7F4ED' }}>
        <p className="font-serif text-[30px] lowercase leading-tight">{name || 'Untitled'}</p>

        <button
          onClick={onSkip}
          className="mt-8 block w-full border border-cream/45 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-cream transition-colors hover:border-cream"
        >
          Not today
        </button>

        <button
          onClick={onDrop}
          className="mt-3 block w-full px-5 py-4 text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-90"
          style={{ backgroundColor: OXBLOOD, color: '#F7F4ED' }}
        >
          Let it go
        </button>

        <div className="mt-7 flex justify-end">
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.22em] text-cream/60 transition-opacity hover:opacity-70">Cancel</button>
        </div>
      </div>
    </div>
  )
}
