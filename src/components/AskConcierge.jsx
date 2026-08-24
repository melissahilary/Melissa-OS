import React, { useState, useRef, useEffect } from 'react'
import { X, ArrowUp } from 'lucide-react'
import { plannerSnapshot } from '../lib/plannerSnapshot'

// The concierge — ask anything about the planner, answered only from your data,
// in the voice of a warm European spa matron. Never invents; says when it doesn't
// know.
const SUGGESTIONS = [
  'How many times a week do I eat broccoli sprouts?',
  'What am I eating on Tuesday?',
  'How many goals are at risk?',
  "What supplements do I take on an empty stomach?",
]

export default function AskConcierge({ open, onClose }) {
  const [thread, setThread] = useState([]) // { q, a, error }
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 120)
    return () => { document.removeEventListener('keydown', onEsc); clearTimeout(t) }
  }, [open, onClose])

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [thread, busy])

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

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:h-[70vh] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <p className="kicker text-stone-400">Concierge</p>
            <h2 className="font-serif italic text-2xl text-stone-900">At your service.</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          {thread.length === 0 ? (
            <div className="flex h-full flex-col justify-center">
              <p className="font-serif italic text-lg leading-relaxed text-stone-500">
                Ask me anything about your planner — how often you eat something, what's on a given day, where a goal stands. I answer only from what you've recorded, and I'll tell you plainly if it isn't there.
              </p>
              <div className="mt-6 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="block w-full rounded-xl border border-stone-200 bg-white/40 px-4 py-2.5 text-left text-sm text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {thread.map((row, i) => (
                <div key={i} className="space-y-2.5">
                  <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-stone-900 px-4 py-2.5 text-sm text-cream">{row.q}</p>
                  <div className="max-w-[90%]">
                    {row.a == null && !row.error ? (
                      <p className="font-serif italic text-stone-400">One moment…</p>
                    ) : row.error ? (
                      <p className="font-serif italic text-stone-500">The concierge is resting just now, my dear — do try again in a moment.</p>
                    ) : (
                      <p className="whitespace-pre-line font-serif text-[17px] leading-relaxed text-stone-800">{row.a}</p>
                    )}
                  </div>
                </div>
              ))}
              {busy && <p className="font-serif italic text-stone-400">One moment…</p>}
            </div>
          )}
        </div>

        <div className="border-t border-stone-200 px-4 py-3">
          <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/60 py-1.5 pl-5 pr-1.5 focus-within:border-stone-400">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(q) }}
              placeholder="Ask your planner…"
              className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder-stone-300"
            />
            <button onClick={() => ask(q)} disabled={busy || !q.trim()} aria-label="Ask" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${busy || !q.trim() ? 'bg-stone-200 text-stone-400' : 'bg-stone-900 text-cream hover:bg-stone-700'}`}>
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
