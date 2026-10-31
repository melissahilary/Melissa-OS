import React, { useRef, useState } from 'react'

// ── Sliding a row away.
//
// The one way anything is taken off a list here. The row comes aside, the red
// is underneath it with the word on it, and letting go past the pull asks —
// or, where there is nothing to ask, takes it.
//
// It only ever moves sideways: whichever way the finger commits to first is
// the only way it goes, so the page still scrolls under it, a grip can still
// take a row up and down, and a tap is still a tap.

export const OXBLOOD = '#C87A7A'
const REVEAL = 96 // as far as the red panel is wide, and no further
const PULL = 64 // how far it has to come before it means it

export default function SwipeAway({ onAway, disabled, ground, label = 'Delete', className = '', style, children }) {
  const grab = useRef(null)
  const [dx, setDx] = useState(0)

  const start = (e) => {
    if (disabled) return
    const pt = e.touches && e.touches.length ? e.touches[0] : e
    grab.current = { x0: pt.clientX, y0: pt.clientY, axis: null, dx: 0 }
  }
  const move = (e) => {
    const g = grab.current
    if (!g) return
    const pt = e.touches && e.touches.length ? e.touches[0] : e
    const x = pt.clientX - g.x0
    const y = pt.clientY - g.y0
    if (!g.axis) {
      if (Math.abs(x) < 10 && Math.abs(y) < 10) return
      g.axis = Math.abs(x) > Math.abs(y) ? 'x' : 'y'
    }
    if (g.axis !== 'x') return
    if (e.cancelable) e.preventDefault()
    g.dx = Math.max(-REVEAL, Math.min(0, x))
    setDx(g.dx)
  }
  const end = () => {
    const g = grab.current
    grab.current = null
    if (g && g.axis === 'x' && g.dx <= -PULL && onAway) onAway()
    setDx(0)
  }

  return (
    <div className={`relative ${className}`} style={style}>
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-5"
        style={{ backgroundColor: OXBLOOD, width: Math.max(0, -dx) }}
      >
        <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#F7F4ED' }}>{label}</span>
      </div>
      <div
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="relative"
        style={{
          backgroundColor: ground,
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: dx ? 'none' : 'transform 160ms ease-out',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
