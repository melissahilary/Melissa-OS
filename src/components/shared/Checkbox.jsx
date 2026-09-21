import React from 'react'
import { LoggedIcon } from './marks'

// App-wide checkbox.
//
// It was an empty bordered square that never filled — a tick appeared inside it
// in a hard-coded near-black. Two problems. The literal ink does not follow the
// wardrobe, so on the dark papers it was a black tick inside a black square. And
// an outline that only ever gains a tick is weak at the size a list actually
// wants: fourteen of them down a column read as fourteen empty boxes whether
// anything is done or not.
//
// So it fills. Untouched it is a hairline square; kept, it is a square of ink
// with the tick cut out of it in the ground colour. At a glance down a column
// the difference is the whole point — you can see how the day is going without
// reading a word of it.
export default function Checkbox({ checked, onClick, size = 16, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center border transition-colors ${checked ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-400 bg-transparent hover:border-stone-900'} ${className}`}
      style={{ width: size, height: size }}
      aria-pressed={!!checked}
    >
      {checked && <LoggedIcon size={Math.max(8, size - 5)} strokeWidth={2.25} />}
    </button>
  )
}
