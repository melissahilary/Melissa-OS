import React, { useState, useRef, useEffect } from 'react'
import { CloseIcon } from './shared/marks'
import ConciergeMark from './shared/ConciergeMark'
import { plannerSnapshot } from '../lib/plannerSnapshot'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { DOW, dateKey } from '../lib/date'
import { normActivity, activityOccursOn, isDoneOn } from '../lib/activities'
import { normMeal, mealOccursOn } from '../lib/meals'

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
//   THE HEAD is a photograph under one downward scrim into Walnut 900 — the
//   only gradient anywhere in the product. The mark and the name sit at the
//   left of it and the stamp at the far right, and nothing else goes in that
//   row. Four photographs, one per opening, in turn.

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

// The stamp, as the book writes it: MON 07:02. The day shortened, the time,
// and nothing else — no date, no month.
const clock = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const stamp = (d) => `${DOW[d.getDay()]} ${clock(d)}`

// The four photographs, in turn — one per opening, remembered across sessions
// so the next one is genuinely next rather than random.
const PLATES = ['/concierge/velvet.webp', '/concierge/fringe.webp', '/concierge/travertine.webp', '/concierge/arc.webp']

// The scrim, exactly as the book specifies it: one downward wash from the
// photograph into Walnut 900, and the only gradient in the product.
const SCRIM = 'linear-gradient(180deg, rgba(20,11,5,0.3) 0%, rgba(20,11,5,0.64) 58%, #1E1209 100%)'

// A 12-hour clock the way the book writes one: "eight", "nine fifteen".
const hhmm = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''))
  if (!m) return ''
  const h = Number(m[1]) % 12 || 12
  return m[2] === '00' ? `${h}` : `${h}:${m[2]}`
}

// ── What it opens with.
//
// Every conversation starts on what the record actually holds for today, so
// two mornings never open the same way. It opens on the outcome — the thing
// that is settled — and stops; it never asks her what she would like to do.
function opening(activities, meals, first) {
  const key = dateKey(new Date())
  const acts = (Array.isArray(activities) ? activities : []).map(normActivity)
    .filter((a) => activityOccursOn(a, key))
  const appt = acts
    .filter((a) => a.type === 'event' && a.details && a.details.time && !isDoneOn(a, key))
    .sort((a, b) => String(a.details.time).localeCompare(String(b.details.time)))[0]
  if (appt) {
    const at = hhmm(appt.details.time)
    return `${appt.title}${at ? ` at ${at}` : ''}.`
  }
  const openTasks = acts.filter((a) => a.type !== 'event' && !isDoneOn(a, key)).length
  const openMeals = (Array.isArray(meals) ? meals : []).map(normMeal)
    .filter((m) => mealOccursOn(m, key) && !(m.completions && m.completions[key])).length
  const left = openTasks + openMeals
  const name = first ? `, ${first}` : ''
  if (left > 1) return `${left} things today${name}.`
  if (left === 1) return `One thing today${name}.`
  if (acts.length || (Array.isArray(meals) && meals.length)) return `Nothing left today${name}.`
  return 'Nothing is written down for today.'
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
  const [activities] = useLocalStorage('mos:activities', [])
  const [meals] = useLocalStorage('mos:meals', [])
  // Which photograph this opening gets. The turn is kept with the rest of her
  // planner, so it carries on where it left off rather than starting again.
  const [plateTurn, setPlateTurn] = useLocalStorage('mos:ask:plate', 0)
  const [plate, setPlate] = useState(PLATES[0])
  const now = new Date()

  useEffect(() => {
    if (!open) { setMounted(false); return }
    const n = Number.isFinite(plateTurn) ? plateTurn : 0
    setPlate(PLATES[((n % PLATES.length) + PLATES.length) % PLATES.length])
    setPlateTurn(n + 1)
    const t0 = setTimeout(() => setMounted(true), 10)
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 320)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onEsc); clearTimeout(t); clearTimeout(t0); document.body.style.overflow = prev }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        {/* The head: 152px of photograph under one downward scrim into Walnut
            900. Over it, the two things the book puts in that row and nothing
            else — the mark and the name at the left, the stamp at the far
            right. The close is the one addition, because a panel a pointer
            cannot shut is broken; it sits outside the pair, at the edge. */}
        <div className="relative flex-none overflow-hidden" style={{ height: 152 }}>
          <img src={plate} alt="" className="absolute inset-0 block h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: SCRIM }} />
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between" style={{ padding: '18px 24px' }}>
            <span className="flex items-center" style={{ gap: 11 }}>
              <ConciergeMark size={17} state={busy ? 'reading' : 'resting'} className="shrink-0" style={{ color: W.ivory }} />
              <span className="text-[9px] tracking-[0.2em]" style={{ color: W.ivory }}>ASK</span>
            </span>
            <span className="flex items-center gap-5">
              <span className="text-[9px] tracking-[0.14em]" style={{ color: W.ivory100 }}>{stamp(now)}</span>
              <button onClick={onClose} aria-label="Close" className="shrink-0 transition-opacity hover:opacity-60" style={{ color: W.ivory100 }}><CloseIcon size={18} /></button>
            </span>
          </div>
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
            /* Starts under the head, not floating in the middle of the pane —
               the book's screens align their content to the top. */
            <div className="flex flex-col items-start">
              <p className="max-w-[24em] font-serif text-[29px] leading-[1.22]" style={{ color: W.ivory }}>
                {opening(activities, meals, first)}
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
                      {row.at ? stamp(row.at) : ''}
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
