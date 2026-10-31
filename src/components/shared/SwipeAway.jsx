import React, { useEffect, useRef, useState } from 'react'

// ── Sliding a row away.
//
// The one way anything is taken off a list here, and it behaves the way the
// gesture behaves everywhere else on the phone: the row follows the finger
// exactly, it rests open with the red standing beside it, and the red is a
// button she then presses. Nothing is destroyed by the slide itself — the
// slide only offers.
//
// Two things were wrong before and both made it feel broken. React attaches
// touchmove as a passive listener, so the preventDefault that holds the page
// still never took: the browser took the gesture for a scroll and the row
// sprang back under her finger. And the position was React state, so every
// millimetre was a re-render. Now the listeners are attached by hand, and the
// movement is written straight to the node — no render runs while she drags.

export const OXBLOOD = '#C87A7A'
const REVEAL = 104 // how far the row comes aside when it rests open
const GAP = 14 // and the air left between the row and the red, so they never touch
const CATCH = 46 // past this on release, the row stays open
const FULL = 190 // and past this it is a sweep: the question is asked at once
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

// Only one row is ever open. Opening another closes it, the way a list of
// them behaves anywhere else.
let openRow = null

export default function SwipeAway({ onAway, disabled, ground, label = 'Delete', className = '', style, children }) {
  const inner = useRef(null)
  const panel = useRef(null)
  const grab = useRef(null)
  const rest = useRef(0)
  const [open, setOpen] = useState(false)
  // The handlers are read through a ref so the listeners below can be
  // attached once and never again: an effect that re-runs on a new `onAway`
  // takes its listeners off the node, and if that lands mid-gesture the
  // finger is left holding nothing.
  const live = useRef({ onAway, disabled })
  live.current = { onAway, disabled }

  // The row, put where it is being held or where it has come to rest.
  const place = (dx, glide) => {
    const i = inner.current
    const p = panel.current
    if (i) {
      i.style.transition = glide ? `transform 280ms ${EASE}` : 'none'
      i.style.transform = `translate3d(${dx}px, 0, 0)`
    }
    if (p) {
      p.style.transition = glide ? `width 280ms ${EASE}` : 'none'
      // The red is narrower than the distance travelled, which is what leaves
      // the air between it and the row — they were touching before, and two
      // things touching read as one thing.
      p.style.width = `${Math.max(0, -dx - GAP)}px`
    }
  }

  const shut = useRef(() => {})
  const settle = (toOpen) => {
    rest.current = toOpen ? -REVEAL : 0
    place(rest.current, true)
    setOpen(toOpen)
    if (toOpen) {
      if (openRow && openRow !== shut.current) openRow()
      openRow = shut.current
    } else if (openRow === shut.current) openRow = null
  }
  shut.current = () => settle(false)

  // ── The gesture ───────────────────────────────────────────────────
  //
  // Attached by hand, because touchmove has to be able to hold the page still
  // and React's own listener cannot.
  useEffect(() => {
    const el = inner.current
    if (!el) return undefined

    const start = (e) => {
      if (live.current.disabled) return
      // Anything that has its own job under the finger — a grip, a field —
      // keeps it.
      if (e.target && e.target.closest && e.target.closest('[data-no-swipe]')) return
      const pt = e.touches ? e.touches[0] : e
      grab.current = { x0: pt.clientX, y0: pt.clientY, axis: null, raw: rest.current, from: rest.current }
      place(rest.current, false)
    }

    const move = (e) => {
      const d = grab.current
      if (!d) return
      const pt = e.touches ? e.touches[0] : e
      const x = pt.clientX - d.x0
      const y = pt.clientY - d.y0
      if (!d.axis) {
        const ax = Math.abs(x)
        const ay = Math.abs(y)
        // A thumb does not travel along a ruler. It lands, settles a few
        // millimetres down the page, and only then goes across — and the
        // first version of this called that a scroll on the strength of the
        // first eight pixels and then threw the rest of the gesture away.
        // Nothing she did after that could bring it back, which is what
        // "it won't slide any more" was.
        //
        // So the question is left open until one of the two answers is
        // actually clear: decisively down the page, or ten pixels across.
        if (ay >= 14 && ay > ax * 1.6) { grab.current = null; return }
        if (ax < 10) return
        d.axis = 'x'
      }
      if (e.cancelable) e.preventDefault()
      // Committed. Nothing above this row — a pager, a rail — gets a say in
      // a gesture that is already being answered here.
      e.stopPropagation()
      const raw = d.from + x
      d.raw = raw
      // Past the rest there is resistance rather than a wall, and on the other
      // side there is nothing to find at all.
      let dx = raw
      if (raw > 0) dx = raw * 0.2
      else if (raw < -REVEAL) dx = -REVEAL - (-raw - REVEAL) * 0.42
      place(dx, false)
    }

    const end = () => {
      const d = grab.current
      grab.current = null
      if (!d || d.axis !== 'x') return
      // A sweep all the way across asks straight away; anything shorter just
      // rests open with the red beside it.
      if (d.raw <= -FULL) { settle(false); if (live.current.onAway) live.current.onAway(); return }
      settle(d.raw <= -CATCH)
    }

    const onPointerDown = (e) => { if (e.pointerType !== 'touch') start(e) }
    const onPointerMove = (e) => { if (grab.current && e.pointerType !== 'touch') move(e) }
    const onPointerUp = (e) => { if (e.pointerType !== 'touch') end() }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      if (openRow === shut.current) openRow = null
    }
    // Once. See `live` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pressing anywhere else puts it back, which is how an open row closes
  // without being told to.
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => {
      const i = inner.current
      const p = panel.current
      if ((i && i.contains(e.target)) || (p && p.contains(e.target))) return
      settle(false)
    }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [open])

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {/* The red, standing where the row was. It is a button once it is
          standing: the slide offers, the press asks. */}
      <button
        ref={panel}
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={() => { settle(false); if (onAway) onAway() }}
        className="absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden whitespace-nowrap"
        style={{ backgroundColor: OXBLOOD, width: 0, pointerEvents: open ? 'auto' : 'none' }}
      >
        <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#F7F4ED' }}>{label}</span>
      </button>
      <div
        ref={inner}
        className="relative"
        style={{ backgroundColor: ground, touchAction: 'pan-y' }}
      >
        {children}
        {/* While the red is standing, the row itself is not live: a press on
            it puts the row back rather than opening what is under it. */}
        {open && (
          <span
            aria-hidden
            className="absolute inset-0"
            onClick={(e) => { e.stopPropagation(); settle(false) }}
          />
        )}
      </div>
    </div>
  )
}
