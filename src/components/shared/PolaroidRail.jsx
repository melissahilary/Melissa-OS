import React, { useMemo } from 'react'

// ── The wishlist rails.
//
// Choosing what kind of thing you are adding used to be eight paragraphs of
// mono chips — correct, and completely mute. It is now a wall of polaroids on
// binder clips, one row per group, each row drifting sideways of its own accord
// and alternating direction so the whole thing reads as a pinboard rather than
// a menu.
//
// The picture on each polaroid is the class's own mark, drawn to the same rules
// as the pillar marks, on the ivory ground the rest of the app uses. The
// caption is Cormorant italic — Pinyon is reserved for the two places it is
// allowed and never appears here.
//
// Rules the motion has to obey: hovering a row stops it, so a card can be aimed
// at rather than chased; keyboard focus stops it too; and anyone who has asked
// their system for less motion gets a plain scrollable row with no animation at
// all.

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

function Polaroid({ label, Icon, tilt, onPick, ghost }) {
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
        <span className="flex h-20 w-full items-center justify-center bg-[#EFEAE0] text-stone-900 sm:h-24">
          <Icon size={32} />
        </span>
        <span className="mt-2.5 flex h-10 items-center justify-center px-0.5 text-center font-serif text-[14px] italic leading-tight text-stone-900 sm:text-[15px]">
          {label}
        </span>
      </span>
    </button>
  )
}

// Every row must be wider than two screens or the loop shows its seam, so a
// short group repeats until it is long enough and only then is doubled.
export default function PolaroidRail({ items, reverse = false, onPick }) {
  const { base, seconds } = useMemo(() => {
    const reps = Math.max(1, Math.ceil(10 / Math.max(1, items.length)))
    const out = []
    for (let i = 0; i < reps; i += 1) out.push(...items)
    return { base: out, seconds: Math.round((out.length * CARD) / SPEED) }
  }, [items])

  return (
    <div className="mos-rail -mx-6 md:-mx-10 lg:-mx-12">
      <div
        className="mos-rail-track flex w-max"
        style={{ animationDuration: `${seconds}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        {[0, 1].map((copy) =>
          base.map((c, i) => (
            <Polaroid
              key={`${copy}-${i}-${c.id}`}
              label={c.label}
              Icon={c.Icon}
              tilt={i % 3 === 0 ? -1.6 : i % 3 === 1 ? 1.2 : -0.5}
              ghost={copy === 1}
              onPick={() => onPick(c.id)}
            />
          )),
        )}
      </div>
    </div>
  )
}
