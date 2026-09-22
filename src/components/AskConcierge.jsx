import React, { useState, useRef, useEffect } from 'react'
import { CloseIcon } from './shared/marks'
import ConciergeMark from './shared/ConciergeMark'
import { plannerSnapshot } from '../lib/plannerSnapshot'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { MONTHS, DOW } from '../lib/date'

// ── Ask — the concierge surface, drawn to its own book.
//
// Named after the action, because there is no actor. She is not talking to
// something; she is searching her own record in plain language and getting it
// back in sentences. It used to be Esmé, a European spa matron who called her
// my dear; a warm character saying your iron looks fine is reassurance, while a
// record saying ferritin was 41 in October and 62 in March is something she can
// take to a doctor.
//
// Everything below follows the concierge book rather than the house sheet, and
// the two disagree on purpose:
//
//   THE GROUND is Walnut 900. It is the only brown room in the product, and it
//   is never inverted — walnut is how she knows which room she is in. Walnut
//   700 appears as a raised panel and never as the ground, because on its own
//   it goes flat and the light disappears.
//
//   NO BUBBLES. Her question is set in mono, small, above a hairline — the way
//   a date is labelled everywhere else in the record. The answer is Bodoni,
//   large, and unenclosed. No left-and-right alignment, no avatars, no
//   timestamps on the answer, and nothing on this screen is inside a box: not
//   the answer, not the sources, not the field she types into.
//
//   ONE COBALT, and on this ground it is a rule rather than a fill — a filled
//   cobalt button on walnut is the one thing the book forbids outright. Cobalt
//   as type goes to its light weight, because cobalt 500 on near-black is a
//   shape you can see and not read.
//
//   WAITING is the mark and nothing else. No bouncing dots — nothing here
//   pretends a person is on the other end — and no streaming, because a
//   concierge does not answer half a sentence at a time. The circle breaks to a
//   dashed rule while it reads, and the answer settles in whole at 700ms, the
//   same movement as a logged entry.
//
// What the book describes and this screen does not do: booking, rescheduling,
// confirmations and the two-option choices that carry the cobalt rule. Ask
// reads her record; it does not hold appointments. The ruled-option component
// is built below and waits for the day it has something to offer.

// The room's palette. These are the book's values, not the house ramp — this is
// the one screen in the product that does not sit on écru, so it does not read
// from the ground variables either.
const W = {
  ground: '#1E1209',   // Walnut 900 — near black, and the whole room
  panel: '#3E2513',    // Walnut 700 — a raised strip, never the ground
  rule: 'rgba(239, 234, 224, 0.18)',
  ruleFaint: 'rgba(239, 234, 224, 0.10)',
  ivory: '#F7F4ED',    // Ivory 050 — the answer
  ivory100: '#EFEAE0', // Ivory 100 — every other word
  warm: '#DCC5AC',     // the second sentence
  label: '#C89468',    // Walnut 200 — mono labels only, never a sentence
  chrome: '#94989C',
  cobalt: '#1D2FC4',   // the rule under the option she is most likely to take
  cobaltType: '#9FAAF5', // cobalt, where it has to be read on this ground
  oxblood: '#C87A7A',  // out of range, on walnut
}

const stamp = (d) => `${DOW[d.getDay()].toUpperCase()} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}`
const clock = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// An option, as the book draws one: a ruled line the full width of the answer,
// with the recommended one carrying the cobalt rule. Two, never more than
// three, and never an open question. Nothing to offer yet — Ask reads the
// record rather than holding a diary — so this waits for the surface that does.
export function Option({ label, note, recommended = false, onPick }) {
  return (
    <button
      onClick={onPick}
      className="group block w-full pb-2.5 pt-3 text-left transition-opacity hover:opacity-80"
      style={{ borderBottom: `1px solid ${recommended ? W.cobalt : W.rule}` }}
    >
      <span className="flex items-baseline justify-between gap-4">
        <span className="font-serif text-[19px] leading-snug" style={{ color: W.ivory }}>{label}</span>
        {(recommended || note) && (
          <span className="shrink-0 text-[10px] tracking-[0.16em]" style={{ color: recommended ? W.cobaltType : W.label }}>
            {recommended ? 'RECOMMENDED' : note}
          </span>
        )}
      </span>
    </button>
  )
}

export default function AskConcierge({ open, onClose }) {
  const [thread, setThread] = useState([]) // { q, at, a, sources, error }
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const [profileRaw] = useLocalStorage('mos:profile', {})
  const first = (((profileRaw && profileRaw.name) || '').trim().split(/\s+/)[0] || '')
  const now = new Date()
  const hour = now.getHours()
  const partOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    if (!open) { setMounted(false); return }
    const t0 = setTimeout(() => setMounted(true), 10)
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 320)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onEsc); clearTimeout(t); clearTimeout(t0); document.body.style.overflow = prev }
  }, [open, onClose])

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [thread, busy])

  const ask = async (question) => {
    const text = (question || '').trim()
    if (!text || busy) return
    setQ('')
    setThread((t) => [...t, { q: text, at: new Date(), a: null, sources: [] }])
    setBusy(true)
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, planner: plannerSnapshot() }) })
      const d = await r.json()
      const a = d && d.answer ? d.answer : null
      const sources = Array.isArray(d && d.sources) ? d.sources.filter((s) => s && s.source) : []
      setThread((t) => t.map((row, i) => (i === t.length - 1 ? { ...row, a, sources, error: !a } : row)))
    } catch (e) {
      setThread((t) => t.map((row, i) => (i === t.length - 1 ? { ...row, a: null, error: true } : row)))
    } finally { setBusy(false) }
  }

  if (!open) return null

  return (
    <div className="mos-concierge fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Ask">
      <div className={`absolute inset-0 backdrop-blur-[3px] transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundColor: 'rgba(13, 11, 9, 0.55)' }} onClick={onClose} />

      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col transition-transform duration-300 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ backgroundColor: W.ground, borderLeft: `1px solid ${W.rule}` }}
      >

        {/* The letterhead. The mark, the name of the room, and — the one line
            the book puts here — the date beside what this reads. It says it
            once; the same sentence used to appear again at the foot. */}
        <div className="flex items-center gap-3 px-6 py-4 sm:px-9" style={{ borderBottom: `1px solid ${W.rule}` }}>
          <ConciergeMark size={22} state={busy ? 'reading' : 'resting'} className="shrink-0" style={{ color: busy ? W.ivory100 : W.label }} />
          <span className="text-[10px] tracking-[0.18em]" style={{ color: W.ivory100 }}>ASK</span>
          <span className="hidden text-[10px] tracking-[0.14em] sm:inline" style={{ color: W.label }}>
            {stamp(now)} · reads only your record
          </span>
          <button onClick={onClose} aria-label="Close" className="ml-auto shrink-0 transition-opacity hover:opacity-60" style={{ color: W.chrome }}><CloseIcon size={20} /></button>
        </div>

        {/* The desk. It fills from the top like a page, rather than floating a
            greeting in the middle with two hundred pixels of nothing above it. */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-6 py-8 sm:px-9">
          {thread.length === 0 ? (
            /* The starting view. The mark stands above the words at its own
               size — it was once an absolutely-placed watermark inside a parent
               that was never positioned, so it anchored to the scroll pane and
               came to rest through the middle of the greeting. Both go the
               moment she asks anything; a record is not a place for a name. */
            <div className="flex h-full flex-col items-start justify-center">
              {/* Resting: the full mark in walnut 200. The book's word for it
                  is "present, waiting for nothing" — so it is not dimmed down
                  into the panel colour to be tasteful about it. */}
              <ConciergeMark size={56} className="shrink-0" style={{ color: W.label }} />
              <p className="mt-8 font-serif text-[30px] leading-[1.2]" style={{ color: W.ivory }}>
                {partOfDay}{first ? `, ${first}` : ''}.
              </p>
              <p className="mt-3 max-w-[26em] text-[15px] leading-relaxed" style={{ color: W.warm }}>
                Answers come only from what you have written down.
              </p>
            </div>
          ) : (
            <div>
              {thread.map((row, i) => (
                <div key={i} className="pb-9 pt-9 first:pt-0" style={i < thread.length - 1 ? { borderBottom: `1px solid ${W.ruleFaint}` } : undefined}>
                  {/* Her words: mono, small, above a hairline — the way a date
                      is labelled everywhere else in the record. Not a bubble,
                      not right-aligned, not beside an avatar. */}
                  <div className="pb-2" style={{ borderBottom: `1px solid ${W.rule}` }}>
                    <span className="mr-3 text-[10px] tracking-[0.16em]" style={{ color: W.label }}>
                      {row.at ? `${stamp(row.at)} ${clock(row.at)}` : ''}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: W.chrome }}>{row.q}</span>
                  </div>

                  <div className="mt-5 min-w-0 max-w-[36em]">
                    {row.a == null && !row.error ? (
                      /* Attending. The circle breaks to a dashed rule and holds
                         — no dots, no spinner, no shimmer behind it. */
                      <ConciergeMark size={24} state="reading" style={{ color: W.label }} title="Reading" />
                    ) : row.error ? (
                      <p className="font-serif text-[26px] leading-[1.25]" style={{ color: W.oxblood }}>Your planner could not be reached.</p>
                    ) : (
                      <div className="mos-settle">
                        {/* The answer: Bodoni, large, unenclosed. The first
                            line is the thing that is settled; anything further
                            sits beneath it, never before. */}
                        <p className="whitespace-pre-line font-serif text-[26px] leading-[1.28] sm:text-[29px]" style={{ color: W.ivory }}>{row.a}</p>
                        {/* Where it came from. Silent when the answer named
                            nothing, which is itself worth seeing. */}
                        {row.sources.length > 0 && (
                          <div className="mt-6 grid gap-2 pt-4" style={{ borderTop: `1px solid ${W.rule}` }}>
                            {row.sources.map((s, n) => (
                              <div key={n} className="flex justify-between gap-6 text-[10px] uppercase tracking-[0.14em]">
                                <span style={{ color: W.label }}>{s.source}</span>
                                {s.detail && <span className="shrink-0 text-right" style={{ color: W.chrome }}>{s.detail}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* A line to write on, and the verb at the end of it. It used to be an
            enclosed field with a filled cobalt disc riding inside — which is
            the one thing this ground forbids: nothing on this screen is in a
            box, and cobalt here is a rule under an offer, never a button. */}
        <div className="px-6 pb-7 pt-4 sm:px-9" style={{ borderTop: `1px solid ${W.rule}`, backgroundColor: W.ground }}>
          <div className="mos-ask-line flex items-center gap-5" style={{ borderBottom: `1px solid ${W.rule}` }}>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(q) }}
              placeholder="Ask a question"
              className="min-w-0 flex-1 bg-transparent py-1 text-[16px] outline-none"
              style={{ color: W.ivory }}
            />
            <button
              onClick={() => ask(q)}
              disabled={busy}
              aria-label="Ask"
              className="shrink-0 text-[10px] tracking-[0.18em] transition-opacity hover:opacity-60 disabled:opacity-40"
              style={{ color: W.label }}
            >
              ASK
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
