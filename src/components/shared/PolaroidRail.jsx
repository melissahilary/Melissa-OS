import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PrevIcon, NextIcon, AddIcon } from './marks'

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

// Does this row drift at all? Only where there is a pointer that can hover,
// which is the same test the stylesheet makes — and everything expensive about
// a marquee hangs off the answer.
//
// A drifting row carries a second copy of every card so the loop has no seam,
// and the browser keeps the whole track on a composited layer so it can slide
// cheaply. On a phone neither is earned: nothing drifts there, so the second
// copy is a second wall of photographs held in memory for nothing, and the
// layer is a track several thousand pixels wide kept rastered at three times
// scale. Nine rows of that is hundreds of megabytes of backing store, which is
// how a phone ends up with a page that stops responding and needs a reload —
// and swapping a mark for a newly added cover is exactly the kind of thing that
// forces the whole lot to be drawn again.
function useDrift() {
  const query = '(hover: hover) and (pointer: fine)'
  const read = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)
  const [drifts, setDrifts] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const on = () => setDrifts(mq.matches)
    on()
    if (mq.addEventListener) { mq.addEventListener('change', on); return () => mq.removeEventListener('change', on) }
    mq.addListener(on)
    return () => mq.removeListener(on)
  }, [])
  return drifts
}

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

// The empty slot at the end of the row. Dashed, and wearing no clip, because it
// is the one card that is not pinned up yet.
function AddCard({ tilt, onPick, ghost }) {
  return (
    <button
      type="button"
      onClick={ghost ? undefined : onPick}
      tabIndex={ghost ? -1 : 0}
      aria-hidden={ghost || undefined}
      title="Add a topic"
      className="group relative mr-5 block shrink-0 w-32 pt-3 sm:mr-6 sm:w-36"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <span className="block border border-dashed border-stone-300 px-2.5 pb-4 pt-6 transition-colors group-hover:border-stone-900 sm:px-3 sm:pb-5">
        <span className="flex h-20 w-full items-center justify-center text-stone-500 transition-colors group-hover:text-stone-900 sm:h-24">
          <AddIcon size={24} />
        </span>
        <span className="mt-2.5 flex h-10 items-center justify-center px-0.5 text-center font-serif text-[14px] italic leading-tight text-stone-600 sm:text-[15px]">
          Add a topic
        </span>
        <span className="block h-3.5" />
      </span>
    </button>
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
export default function PolaroidRail({ items, reverse = false, onPick, onAdd }) {
  const [manual, setManual] = useState(false)
  const drifts = useDrift()
  const railRef = useRef(null)
  const trackRef = useRef(null)

  // A row only loops if it has enough in it to fill the screen on its own.
  // Short sections used to be padded out — the same four topics repeated until
  // the row was long enough to loop without showing its seam — which on the
  // page reads as exactly what it is: the same list printed four times. A
  // section with a handful of lists is now simply a row with a handful of
  // lists in it, shown once.
  const { base, loops, seconds } = useMemo(() => {
    // The slot rides at the end of the set, so it comes round once a cycle
    // rather than sitting in a corner of the page somewhere.
    const set = onAdd ? [...items, { id: '__add__', add: true }] : items
    const wide = set.length * CARD > 1200
    return { base: set, loops: drifts && wide, seconds: Math.round((set.length * CARD) / SPEED) }
  }, [items, onAdd, drifts])

  // Arrows that scroll nothing are furniture. They appear when the row is
  // actually longer than the space it has.
  const [runsOver, setRunsOver] = useState(false)
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return undefined
    const measure = () => setRunsOver(rail.scrollWidth - rail.clientWidth > 8)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro) ro.observe(rail)
    return () => { if (ro) ro.disconnect() }
  }, [base, loops])

  const step = (dir) => {
    const rail = railRef.current
    const track = trackRef.current
    if (!rail || !track) return

    // Taking an arrow hands the row over: read where the animation had got to,
    // turn that into a scroll position, and stop animating. Same pixel, same
    // instant, no jump — and it stays stopped.
    //
    // On a touch screen there is no drift to take over and the row is already
    // where she last swiped it to, so converting a transform of none into a
    // scrollLeft of zero would throw the row back to the start under her hand.
    // Only a row that is actually animating gets frozen.
    if (!manual) {
      const cs = getComputedStyle(track)
      const running = cs.animationName && cs.animationName !== 'none'
      if (running) {
        const m = cs.transform
        const n = m && m !== 'none' ? m.match(/matrix\(([^)]+)\)/) : null
        const tx = n ? parseFloat(n[1].split(',')[4]) : 0
        track.style.animation = 'none'
        track.style.transform = 'none'
        rail.scrollLeft = Math.max(0, -tx)
      }
      setManual(true)
    }

    // A drifting row holds the same set twice, so jumping a whole set is
    // invisible — that is what makes stepping endless in both directions. A row
    // that holds one copy simply runs out at each end, like any other scroller.
    const page = Math.max(220, rail.clientWidth * 0.8)
    if (loops) {
      const half = track.scrollWidth / 2
      if (dir < 0 && rail.scrollLeft < page) rail.scrollLeft += half
      else if (dir > 0 && rail.scrollLeft > half) rail.scrollLeft -= half
    }
    rail.scrollBy({ left: dir * page, behavior: 'smooth' })
  }

  return (
    <div className="relative -mx-6 md:-mx-10 lg:-mx-12">
      <div ref={railRef} className={`mos-rail ${manual ? 'mos-rail-manual' : ''}`}>
        <div
          ref={trackRef}
          className="mos-rail-track flex w-max"
          style={{
            animationDuration: `${seconds}s`,
            animationDirection: reverse ? 'reverse' : 'normal',
            // Inline, so it beats the stylesheet's hover rule for a row that
            // has nothing to loop.
            animationName: loops ? undefined : 'none',
          }}
        >
          {(loops ? [0, 1] : [0]).map((copy) => [
            // A shoulder at the head of every copy. The arrows sit over the row
            // rather than beside it, and the fade eats the first inch of it, so
            // a card parked at the very start of the row was under both — which
            // is why the first topic in a section could not be clicked at all.
            // One spacer per copy, so the two halves stay identical and the loop
            // keeps its seam.
            <span key={`${copy}-cap`} aria-hidden className="block w-12 shrink-0 sm:w-16" />,
            ...base.map((c, i) => {
              const tilt = i % 3 === 0 ? -1.6 : i % 3 === 1 ? 1.2 : -0.5
              return c.add ? (
                <AddCard key={`${copy}-${i}-add`} tilt={tilt} ghost={copy === 1} onPick={onAdd} />
              ) : (
                <Polaroid
                  key={`${copy}-${i}-${c.id}`}
                  label={c.label}
                  Icon={c.Icon}
                  cover={c.cover}
                  note={c.note}
                  tilt={tilt}
                  ghost={copy === 1}
                  onPick={() => onPick(c.id)}
                />
              )
            }),
            <span key={`${copy}-tail`} aria-hidden className="block w-12 shrink-0 sm:w-16" />,
          ])}
        </div>
      </div>
      {(loops || runsOver) && (
        <>
          <Arrow side="left" label="Earlier in this row" onClick={() => step(-1)} />
          <Arrow side="right" label="Later in this row" onClick={() => step(1)} />
        </>
      )}
    </div>
  )
}
