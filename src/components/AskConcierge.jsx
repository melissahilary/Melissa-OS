import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { CloseIcon } from './shared/marks'
import ConciergeMark from './shared/ConciergeMark'
import { plannerSnapshot } from '../lib/plannerSnapshot'
import { useLocalStorage } from '../hooks/useLocalStorage'

// ── Ask.
//
// Named after the action, because there is no actor. She is not talking to
// something; she is searching her own record in plain language and getting it
// back in sentences.
//
// It used to be Esmé, a European spa matron who called her my dear, greeted her
// by name and offered six questions to ask. The reason for dropping her is not
// taste. This room holds her labs, her cycle, her mood and her mother. A warm
// character saying your iron looks fine is reassurance; a record saying ferritin
// was 41 in October and 62 in March is something she can take to a doctor. The
// name was buying trust the answers had not earned.
//
// Naming it the Reader was the same mistake one size smaller: still a character,
// and one nobody could picture.
//
// So: a transcript, not a chat. Her question in the label column in mono, the
// answer in the content field in Hanken, a hairline between exchanges. No
// bubbles, no avatars, no greeting, no prompt chips, no typing dots — the mark
// goes dashed while it reads and the answer arrives whole.
//
// Every claim names the entry it came from, beneath the answer. An uncited
// sentence is a bug.

export default function AskConcierge({ open, onClose }) {
  const [thread, setThread] = useState([]) // { q, a, sources, error }
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const [profileRaw] = useLocalStorage('mos:profile', {})
  const first = (((profileRaw && profileRaw.name) || '').trim().split(/\s+/)[0] || '')
  const hour = new Date().getHours()
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
    setThread((t) => [...t, { q: text, a: null, sources: [] }])
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
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Ask">
      <div className={`absolute inset-0 bg-stone-900/45 backdrop-blur-[3px] transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />

      <aside className={`absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-stone-200 bg-cream transition-transform duration-300 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* The letterhead says what this is and what it reads. It says it once;
            the same sentence used to appear again at the foot of the panel. */}
        <div className="flex items-center gap-3 border-b border-stone-200 px-6 py-4 sm:px-8">
          <ConciergeMark size={22} className="shrink-0 text-stone-800" />
          <span className="text-[10px] tracking-[0.18em] text-stone-900">ASK</span>
          <button onClick={onClose} aria-label="Close" className="ml-auto shrink-0 text-stone-400 transition-colors hover:text-stone-900"><CloseIcon size={20} /></button>
        </div>

        {/* The transcript. It fills from the top like a document, rather than
            floating in the middle of the panel with two hundred pixels of
            nothing above it and three hundred below. */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {thread.length === 0 ? (
            /* The starting view. The mark was a watermark behind the words —
               absolutely placed inside a parent that was never positioned, so
               it anchored to the scroll pane instead and came to rest directly
               on top of the greeting, a grey ring through the middle of Good
               morning. It stands above the words now, at its own size, and the
               three read as one stack. Both go the moment she asks anything; a
               transcript is not a place for a name. */
            <div className="flex h-full flex-col items-center justify-center px-2 text-center">
              <ConciergeMark size={64} className="shrink-0 text-stone-300" />
              <p className="mt-7 font-serif text-[28px] leading-tight text-stone-900">{partOfDay}{first ? `, ${first}` : ''}.</p>
              <p className="mt-2 max-w-[26em] text-sm leading-snug text-stone-500">Answers come only from what you have written down.</p>
            </div>
          ) : (
            <div>
              {thread.map((row, i) => (
                <div key={i} className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-stone-200 pb-6 pt-6 first:pt-0 sm:grid-cols-[116px_minmax(0,1fr)]">
                  <p className="text-[10px] uppercase leading-[1.8] tracking-[0.14em] text-stone-500">{row.q}</p>
                  <div className="min-w-0">
                    {row.a == null && !row.error ? (
                      <ConciergeMark size={22} state="reading" className="text-stone-500" title="Reading" />
                    ) : row.error ? (
                      <p className="text-[15px] leading-relaxed text-stone-500">Your planner could not be reached. Ask again.</p>
                    ) : (
                      <>
                        <p className="whitespace-pre-line text-[15px] leading-[1.7] text-stone-900">{row.a}</p>
                        {/* Where it came from. Silent when the answer named
                            nothing, which is itself worth seeing. */}
                        {row.sources.length > 0 && (
                          <div className="mt-3 grid gap-1.5 border-t border-stone-200 pt-3">
                            {row.sources.map((s, n) => (
                              <div key={n} className="flex justify-between gap-4 text-[10px] uppercase tracking-[0.14em] text-stone-500">
                                <span>{s.source}</span>
                                {s.detail && <span className="shrink-0 text-right text-stone-600">{s.detail}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* One enclosed field with the action riding inside it, rather than a
            ruled line with a button standing outside the end of it. The
            dictation mic places itself at the field's right edge, so it lands
            between the words and the send, which is where a hand expects it.

            The corners are square, and that is not an oversight. The house rule
            is that radius belongs to objects in a photograph and never to
            layout — a pill is the most generic thing an interface can wear —
            and the stylesheet squares every rounded-full it finds on a button
            or a bordered box. The arrangement is what was worth borrowing.

            The send keeps rounded-full because that is the house's mark for a
            primary action: squared by the rule above, set in mono, and filled
            with the one cobalt. It pales to ivory by itself when there is
            nothing to send. */}
        {/* One focus indicator, not two. The bar shows focus by going to ink,
            and the house gives every focused field a cobalt ring besides — so a
            focused input inside a focused bar drew a cobalt rectangle nested
            inside a black one, which is what made this read as broken. The bar
            keeps the job; the input's own ring stands down. */}
        <div className="border-t border-stone-200 bg-cream px-6 pb-6 pt-4 sm:px-8">
          <div className="flex items-center gap-2 border border-stone-300 bg-white py-1.5 pl-5 pr-1.5 transition-colors focus-within:border-stone-900">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(q) }}
              placeholder="Ask a question"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-stone-900 outline-none focus-visible:outline-none placeholder:text-stone-400"
            />
            <button
              onClick={() => ask(q)}
              disabled={busy || !q.trim()}
              aria-label="Ask"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-cream transition-opacity hover:opacity-90 disabled:cursor-default disabled:hover:opacity-100"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
