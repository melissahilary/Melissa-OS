import React, { useState, useRef, useEffect } from 'react'
import { X, ArrowUp } from 'lucide-react'
import { plannerSnapshot } from '../lib/plannerSnapshot'

// ── Esmé — the house concierge. A full-height salon, not a chat widget. She
// answers only from Melissa's own planner, in the voice of a great European spa
// matron; if it isn't recorded, she says so plainly.

const SUGGESTIONS = [
  'What am I eating tomorrow?',
  'How is my glass-skin goal coming along?',
  'What do I take on an empty stomach?',
  'What does my week look like?',
]

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
            <div className="flex h-full flex-col justify-center pb-10">
              <p className="font-serif italic text-[19px] leading-relaxed text-stone-600">
                {greeting}, Melissa. Ask me anything of your planner — your table, your rituals, your goals, your week. I speak only from what you've recorded, and I'll tell you plainly when something isn't there.
              </p>
              <div className="mt-8">
                <p className="kicker mb-3 text-stone-400">You might ask</p>
                <div className="space-y-0">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="group flex w-full items-baseline gap-3 border-b border-stone-200/70 py-3 text-left transition-colors last:border-b-0 hover:border-stone-400">
                      <span className="text-stone-300 transition-colors group-hover:text-stone-500">—</span>
                      <span className="font-serif text-[17px] text-stone-600 transition-colors group-hover:text-stone-900">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
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
                        <p className="whitespace-pre-line font-serif text-[17.5px] leading-[1.75] text-stone-800">{row.a}</p>
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
