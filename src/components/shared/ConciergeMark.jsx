import React from 'react'

// ── The concierge mark.
//
// A mezzanine is the floor suspended between two floors, and the mark is
// exactly that: two hairlines with a single form held between them. Built from
// the same three primitives as the twelve pillar marks — a circle, a line, a
// diagonal — so it belongs to the set rather than sitting above it.
//
// Drawn on the 120-unit box the brand book specifies:
//
//     M18 40 h84        the upper rule
//     M18 80 h84        the lower rule
//     circle 60,60 r15  the floor between them
//
// The one thing that is not obvious: the stroke is specified inside that
// 120-unit box, so at 20 units it renders eight times heavier than at 160 unless
// it is divided back out. The book gives the intended weights — 2.4 at 56px,
// 4 at 32px, 6.5 at 20px — and every one of those lands on the same 1.1px line.
// So the weight is computed rather than written down, and the mark looks like
// one drawing at every size instead of three.
//
// Outline only: never filled, never gradient, never given a glow, because a
// filled mark reads as a button and this is not one. Never rotated — the two
// rules are horizontal in every context, and a tilted mezzanine is a collapsed
// one. Never a face: the circle is a floor plan, not a head. And never the
// wordmark — this identifies the assistant and appears nowhere else.
//
// The book gives the mark four states, carried by which parts are drawn rather
// than by colour: resting, listening (the circle breathes on 2.4s), reading (the
// circle breaks to a dashed rule) and answering (the circle takes the one
// cobalt). Two are wired here. Whoever needs a fifth should read the book rather
// than invent one.

const RULE = 1.1 // the rendered hairline, in pixels, at every size

export default function ConciergeMark({ size = 24, state = 'resting', className = '', title, ...rest }) {
  const w = (RULE * 120) / size
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap="butt"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      {...rest}
    >
      <path d="M18 40h84" />
      <path d="M18 80h84" />
      <circle
        cx="60"
        cy="60"
        r="15"
        strokeDasharray={state === 'reading' ? `${w * 2.6} ${w * 3.8}` : undefined}
        style={state === 'listening' ? { animation: 'mos-breath 2.4s ease-in-out infinite' } : undefined}
      />
    </svg>
  )
}
