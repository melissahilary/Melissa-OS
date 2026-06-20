import React from 'react'

// The big editorial header used at the top of every pillar page.
// Kicker in tracked caps + Cormorant Garamond italic title.
export default function SectionTitle({ kicker, title, right }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-6">
      <div>
        {kicker ? <p className="kicker text-stone-400 mb-3">{kicker}</p> : null}
        <h1 className="font-serif italic text-3xl md:text-4xl tracking-tight leading-[0.95] text-stone-900">
          {title}
        </h1>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  )
}
