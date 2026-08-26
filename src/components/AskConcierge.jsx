import React, { useState, useRef, useEffect } from 'react'
import { X, ArrowUp } from 'lucide-react'
import { plannerSnapshot } from '../lib/plannerSnapshot'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLifeStage } from '../lib/lifeStage'

// ── Esmé — the house concierge. A full-height salon, not a chat widget. She
// answers only from Melissa's own planner, in the voice of a great European spa
// matron; if it isn't recorded, she says so plainly.

// Her rooms — the opening screen reads like a concierge's card of services:
// each room of the house, with one question she can answer from it right now.
// My Body speaks in the language of the life stage chosen in Settings.
const ROOMS_OF_ASK = (stage) => [
  { k: 'The Week', q: 'What does my week look like?' },
  { k: 'The Table', q: 'What am I eating tomorrow?' },
  { k: 'The Stack', q: 'What do I take on an empty stomach?' },
  { k: 'The Mirror', q: 'How is my glass-skin goal coming along?' },
  {
    k: 'My Body',
    q: stage === 'pregnant' ? 'What week am I in?'
      : stage === 'postpartum' ? 'How many weeks postpartum am I?'
        : stage === 'menopause' || stage === 'perimenopause' ? 'What has my body been saying lately?'
          : stage === 'ttc' ? 'When is my fertile window?'
            : 'Where am I in my cycle?',
  },
  { k: 'The Circle', q: 'Whose birthday is coming up?' },
]

// Doors — after she answers, the rooms her answer touched appear as quiet
// chips. Tap one and the salon closes onto that page: every answer is a way in.
const DOORS = [
  { match: /\b(eat|eating|meal|diet|food|dinner|lunch|breakfast|menu)\b/i, label: 'The table', page: 'menu', sub: 'diet' },
  { match: /\b(supplement|vitamin|capsule|stack|magnesium|omega)\b/i, label: 'Supplements', page: 'menu', sub: 'supplements' },
  { match: /\b(recipe|cook)\b/i, label: 'Recipes', page: 'menu', sub: 'recipes' },
  { match: /\b(goal|milestone|dream|project)\b/i, label: 'Dream planning', page: 'dream', sub: '' },
  { match: /\b(week|today|schedule|appointment|calendar|agenda)\b/i, label: 'Today', page: 'today', sub: '' },
  { match: /\b(skin|skincare|serum|retinol|spf)\b/i, label: 'Skincare', page: 'skincare', sub: 'schedule' },
  { match: /\b(hair|haircare)\b/i, label: 'Haircare', page: 'haircare', sub: 'schedule' },
  { match: /\b(cycle|period|phase|hormone|ovulat|luteal|menopause|pregnan)\b/i, label: 'My body', page: 'workout', sub: 'cycle' },
  { match: /\b(workout|training|train|gym|pilates|lift|fitness)\b/i, label: 'Fitness', page: 'fitness', sub: 'schedule' },
  { match: /\b(shop|shopping|grocery|buy)\b/i, label: 'Grocery', page: 'menu', sub: 'grocery' },
]
const doorsFor = (row) => {
  const text = `${row.q} ${row.a || ''}`
  const out = []
  for (const d of DOORS) if (d.match.test(text) && !out.some((x) => x.label === d.label)) out.push(d)
  return out.slice(0, 3)
}
// Elegant monogram seal — a serif E inside a fine double ring.
function Seal({ size = 44 }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, border: '1px solid #C9C2B2', boxShadow: 'inset 0 0 0 3px #FAF8F3, inset 0 0 0 4px #DDD7C8' }}
    >
      <span className="font-serif italic" style={{ fontSize: size * 0.5, lineHeight: 1, color: '#57524A' }}>E</span>
    </span>
  )
}

export default function AskConcierge({ open, onClose }) {
  const [thread, setThread] = useState([]) // { q, a, error }
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const [, setActivePage] = useLocalStorage('mos:active', 'today')
  const [, setSubs] = useLocalStorage('mos:subpages', {})
  const { stage } = useLifeStage()
  const openDoor = (door) => {
    setActivePage(door.page)
    if (door.sub) setSubs((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [door.page]: door.sub }))
    onClose()
  }

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
    setThread((t) => [...t, { q: text, a: null }])
    setBusy(true)
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, planner: plannerSnapshot() }) })
      const data = await r.json()
      setThread((t) => t.map((row, i) => (i === t.length - 1 ? { ...row, a: data && data.answer ? data.answer : null, error: !(data && data.answer) } : row)))
    } catch (e) {
      setThread((t) => t.map((row, i) => (i === t.length - 1 ? { ...row, a: null, error: true } : row)))
    } finally { setBusy(false) }
  }

  if (!open) return null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Esmé, your concierge">
      <div className={`absolute inset-0 bg-stone-900/45 backdrop-blur-[3px] transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />

      {/* The salon — full-height, slides in from the right */}
      <aside className={`absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-stone-200 bg-cream shadow-2xl transition-transform duration-300 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Letterhead */}
        <div className="relative border-b border-stone-200 px-8 pb-6 pt-7 text-center">
          <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 text-stone-400 transition-colors hover:text-stone-900"><X size={20} /></button>
          <div className="flex justify-center"><Seal /></div>
          <h2 className="mt-3 text-3xl leading-none text-stone-900" style={{ fontFamily: "'Pinyon Script', cursive" }}>Esmé</h2>
          <p className="kicker mt-2 text-stone-400">The House Concierge</p>
        </div>

        {/* Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-7">
          {thread.length === 0 ? (
            <div className="flex h-full flex-col justify-center pb-8">
              {/* Presence — she is at her desk, and this room is yours alone */}
              <div className="mb-5 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ background: '#7C8B6B' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#7C8B6B' }} />
                </span>
                <span className="text-[10px] tracking-[0.22em] text-stone-400">AT HER DESK · PRIVATE · YOURS ALONE</span>
              </div>

              <p className="font-serif text-[26px] leading-tight text-stone-900">{greeting}, Melissa.</p>
              <p className="mt-2 font-serif italic text-[16px] leading-relaxed text-stone-500">
                Every room of your house, one question away. If it isn't in your planner, I'll say so plainly.
              </p>

              {/* The card of services — each room, one question she can answer now */}
              <div className="mt-7 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROOMS_OF_ASK(stage).map((s) => (
                  <button
                    key={s.k}
                    onClick={() => ask(s.q)}
                    className="group rounded-2xl border border-stone-200 bg-white/40 px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-stone-900 hover:shadow-md"
                  >
                    <span className="block text-[9.5px] tracking-[0.2em] text-stone-400 transition-colors group-hover:text-stone-500">{s.k.toUpperCase()}</span>
                    <span className="mt-1 block font-serif text-[15.5px] leading-snug text-stone-700 transition-colors group-hover:text-stone-900">{s.q}</span>
                  </button>
                ))}
              </div>

              <p className="mt-6 text-center text-[10.5px] italic text-stone-300">…or ask in your own words below.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {thread.map((row, i) => (
                <div key={i}>
                  {/* Her question — a quiet right-aligned line, like a note passed */}
                  <p className="mb-3 text-right font-serif italic text-[16px] leading-relaxed text-stone-500">“{row.q}”</p>
                  {/* Esmé's reply — letterpress, led by a hairline and her initial */}
                  <div className="flex gap-4">
                    <span className="mt-1 shrink-0"><Seal size={26} /></span>
                    <div className="min-w-0 flex-1 border-t border-stone-200 pt-2.5">
                      {row.a == null && !row.error ? (
                        <TypingLine />
                      ) : row.error ? (
                        <p className="font-serif italic text-[17px] leading-relaxed text-stone-500">I've stepped away from the desk for a moment, my dear — do ask again shortly.</p>
                      ) : (
                        <>
                          <p className="whitespace-pre-line font-serif text-[17.5px] leading-[1.75] text-stone-800">{row.a}</p>
                          {(() => {
                            const doors = doorsFor(row)
                            return doors.length ? (
                              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                <span className="kicker mr-1 text-stone-300">Through here</span>
                                {doors.map((d) => (
                                  <button key={d.label} onClick={() => openDoor(d)} className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">{d.label} →</button>
                                ))}
                              </div>
                            ) : null
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* The desk — writing line */}
        <div className="border-t border-stone-200 bg-cream px-8 pb-6 pt-4">
          <div className="flex items-end gap-3 border-b border-stone-300 pb-2 transition-colors focus-within:border-stone-900">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(q) }}
              placeholder="Ask Esmé…"
              className="flex-1 bg-transparent font-serif text-[17px] text-stone-900 outline-none placeholder:italic placeholder:text-stone-400"
            />
            <button onClick={() => ask(q)} disabled={busy || !q.trim()} aria-label="Send" className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${busy || !q.trim() ? 'text-stone-300' : 'bg-stone-900 text-cream hover:bg-stone-700'}`}>
              <ArrowUp size={15} />
            </button>
          </div>
          <p className="mt-2.5 text-center text-[10.5px] tracking-[0.14em] text-stone-300">SHE ANSWERS ONLY FROM YOUR OWN PLANNER</p>
        </div>
      </aside>
    </div>
  )
}

// Three soft dots while she composes.
function TypingLine() {
  return (
    <span className="inline-flex items-center gap-1.5 py-1" aria-label="Esmé is writing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400" style={{ animationDelay: `${i * 180}ms` }} />
      ))}
    </span>
  )
}
