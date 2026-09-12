import React, { useMemo, useRef, useState } from 'react'
import { PrevIcon, NextIcon } from './marks'

// ── The wishlist rails.
//
// One row per group of topics: a wall of polaroids on binder clips, drifting
// sideways of its own accord, rows alternating direction so the board moves
// against itself rather than marching.
//
// The drift is scenery, not navigation. The moment she takes an arrow the row
// stops drifting for good and becomes hers to step through — it does not start
// creeping again under her hand. Freezing happens exactly where the animation
// had got to, so nothing jumps at the moment she takes hold of it.
//
// The picture is the topic's own cover where she has put one there and the
// topic's mark where she has not.
//
// Hovering a drifting row stops it, so a card can be aimed at rather than
// chased; keyboard focus stops it too; and anyone who has asked their system for
// less motion gets a plain row that never moved in the first place.

const CARD = 168 // 144 of card and 24 of margin — the loop's unit of distance
const SPEED = 34 // pixels a second, the same in every row whatever it holds

// A binder clip, drawn rather than photographed: the body a dark trapezoid, the
// two handles solid wires leaning out of it. No shadow anywhere in this app, so
// what says the card is clipped on is the tilt and the clip sitting over its
// top edge.
function Clip() {
  return (
    <svg width="32" height="21" viewBox="0 0 40 26" fill="none" aria-hidden className="block">
      <path d="M15 11 9 3l3.4-1.8 5.6 8.1Z" fill="#16130F" />
      <path d="M25 11l6-8-3.4-1.8L22 9.3Z" fill="#16130F" />
      <path d="M4.5 9.5h31l-3 15h-25Z" fill="#16130F" />
      <path d="M9.5 13.5h21" stroke="#FAF6ED" strokeWidth="1" opacity="0.45" />
    </svg>
  )
}

function Polaroid({ label, Icon, cover, note, tilt, onPick, ghost }) {
  return (
    <button
      type="button"
      onClick={ghost ? undefined : onPick}
      tabIndex={ghost ? -1 : 0}
      aria-hidden={ghost || undefined}
      title={label}
      className="group relative mr-5 block shrink-0 w-32 pt-3 sm:mr-6 sm:w-36"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <Clip />
      </span>
      <span className="block border border-stone-200 bg-white px-2.5 pb-4 pt-6 transition-colors group-hover:border-stone-900 sm:px-3 sm:pb-5">
        <span className="flex h-20 w-full items-center justify-center overflow-hidden bg-[#EFEAE0] text-stone-900 sm:h-24">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Icon size={32} />}
        </span>
        <span className="mt-2.5 flex h-10 items-center justify-center px-0.5 text-center font-serif text-[14px] italic leading-tight text-stone-900 sm:text-[15px]">
          {label}
        </span>
        {/* The line is reserved whether or not there is anything to say, so a
            row of polaroids stays a row and not a ragged edge. */}
        <span className="block h-3.5 text-center text-[9px] tracking-[0.14em] text-stone-500 tabular-nums">{note || ''}</span>
      </span>
    </button>
  )
}

function Arrow({ side, onClick, label }) {
  const Icon = side === 'left' ? PrevIcon : NextIcon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center border border-stone-300 bg-cream text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900 ${side === 'left' ? 'left-1 sm:left-2' : 'right-1 sm:right-2'}`}
    >
      <Icon size={16} />
    </button>
  )
}

// Every row must be wider than two screens or the loop shows its seam, so a
// short group repeats until it is long enough and only then is doubled.
export default function PolaroidRail({ items, reverse = false, onPick }) {
  const [manual, setManual] = useState(false)
  const railRef = useRef(null)
  const trackRef = useRef(null)

  const { base, seconds } = useMemo(() => {
    const reps = Math.max(1, Math.ceil(10 / Math.max(1, items.length)))
    const out = []
    for (let i = 0; i < reps; i += 1) out.push(...items)
    return { base: out, seconds: Math.round((out.length * CARD) / SPEED) }
  }, [items])

  const step = (dir) => {
    const rail = railRef.current
    const track = trackRef.current
    if (!rail || !track) return

    // Taking an arrow hands the row over: read where the animation had got to,
    // turn that into a scroll position, and stop animating. Same pixel, same
    // instant, no jump — and it stays stopped.
    if (!manual) {
      const tx = (() => {
        const m = getComputedStyle(track).transform
        if (!m || m === 'none') return 0
        const n = m.match(/matrix\(([^)]+)\)/)
        return n ? parseFloat(n[1].split(',')[4]) : 0
      })()
      track.style.animation = 'none'
      track.style.transform = 'none'
      rail.scrollLeft = Math.max(0, -tx)
      setManual(true)
    }

    // The row holds the same set twice, so jumping a whole set is invisible.
    // That is what makes stepping endless in both directions.
    const half = track.scrollWidth / 2
    const page = Math.max(220, rail.clientWidth * 0.8)
    if (dir < 0 && rail.scrollLeft < page) rail.scrollLeft += half
    else if (dir > 0 && rail.scrollLeft > half) rail.scrollLeft -= half
    rail.scrollBy({ left: dir * page, behavior: 'smooth' })
  }

  return (
    <div className="relative -mx-6 md:-mx-10 lg:-mx-12">
      <div ref={railRef} className={`mos-rail ${manual ? 'mos-rail-manual' : ''}`}>
        <div
          ref={trackRef}
          className="mos-rail-track flex w-max"
          style={{ animationDuration: `${seconds}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
        >
          {[0, 1].map((copy) =>
            base.map((c, i) => (
              <Polaroid
                key={`${copy}-${i}-${c.id}`}
                label={c.label}
                Icon={c.Icon}
                cover={c.cover}
                note={c.note}
                tilt={i % 3 === 0 ? -1.6 : i % 3 === 1 ? 1.2 : -0.5}
                ghost={copy === 1}
                onPick={() => onPick(c.id)}
              />
            )),
          )}
        </div>
      </div>
      <Arrow side="left" label="Earlier in this row" onClick={() => step(-1)} />
      <Arrow side="right" label="Later in this row" onClick={() => step(1)} />
    </div>
  )
}
