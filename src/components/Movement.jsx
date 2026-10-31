import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { activityOccursOn } from '../lib/activities'
import { QUALITIES, qualityOf, readKinds, signatureOf, tidyKinds } from '../lib/movement'
import SwipeAway, { OXBLOOD } from './shared/SwipeAway'
import RepeatField from './shared/Repeat'

// ── Moved, not measured.
//
// What she did with her body today, kept the way the rest of the day is kept:
// a line, how long it took, and whatever unit that particular thing is counted
// in — three miles, four sets of eight. The app does not care which, because a
// body does not keep one unit.
//
// What it was FOR is never hers to type. Each line is read for her — strength,
// core, glutes, and the rest — and the eight bars at the foot are the week in
// those terms. The three numerals below them are the only measuring on the
// page, and they are hers to write rather than a device's to report.

const uid = () => Math.random().toString(36).slice(2, 10)
const arr = (v) => (Array.isArray(v) ? v : [])
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const two = (n) => String(n).padStart(2, '0')

const mins = (v) => {
  const n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ── Who reads the lines.
//
// The keyword table answers the instant she presses Add; Claude answers a
// moment later and overwrites it. Each distinct line is asked about once, ever,
// and the answer is kept with her planner.
function useKinds(items) {
  const [cacheRaw, setCache] = useLocalStorage('mos:movement:kinds', {})
  const cache = obj(cacheRaw)
  const asked = useRef(new Set())
  const held = useRef(cache)
  held.current = cache

  const want = useMemo(() => {
    const seen = new Map()
    for (const x of items) {
      const sig = signatureOf(x)
      if (sig && sig !== '|' && !seen.has(sig)) seen.set(sig, { id: sig, name: x.name || '', detail: x.detail || '' })
    }
    return [...seen.values()]
  }, [items])

  useEffect(() => {
    const missing = want.filter((w) => !held.current[w.id] && !asked.current.has(w.id))
    if (!missing.length) return
    missing.forEach((w) => asked.current.add(w.id))
    let live = true
    ;(async () => {
      try {
        const r = await fetch('/api/movement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: missing }),
        })
        const j = await r.json()
        const got = obj(j && j.kinds)
        if (!live || !Object.keys(got).length) return
        setCache((prev) => {
          const next = { ...obj(prev) }
          for (const [sig, list] of Object.entries(got)) {
            const tidy = tidyKinds(list)
            if (tidy.length) next[sig] = tidy
          }
          return next
        })
      } catch {
        /* the keyword reading already stands; nothing to say */
      }
    })()
    return () => { live = false }
  }, [want, setCache])

  // Claude's answer when it has come back, the keyword one until it does.
  return useMemo(() => (x) => {
    const sig = signatureOf(x)
    const got = held.current[sig]
    return Array.isArray(got) && got.length ? got : readKinds(x)
  }, [cacheRaw])
}

export default function Movement({ dateKeyStr }) {
  const [raw, setRaw] = useLocalStorage('mos:movement', [])
  const [tallyRaw, setTally] = useLocalStorage('mos:movement:tally', {})
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(null)

  const key = dateKeyStr || dateKey(new Date())
  const all = arr(raw)
  const tally = obj(tallyRaw)[key] || {}
  const kindsOf = useKinds(all)

  // What lands on this day, in the order she put it in.
  const today = all
    .filter((x) => activityOccursOn({ ...x, seriesStart: x.seriesStart || '', type: 'protocol' }, key))
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  const done = (x) => !!(x.completions && x.completions[key])
  const setDone = (id, on) => setRaw((prev) => arr(prev).map((x) => {
    if (x.id !== id) return x
    const c = { ...(x.completions || {}) }
    if (on) c[key] = true
    else delete c[key]
    return { ...x, completions: c }
  }))

  // ── The week, in what it asked of her.
  //
  // Seven days back from the day she is standing on, and only what she actually
  // kept. A session counts once towards each quality it carries.
  const week = useMemo(() => {
    const count = Object.fromEntries(QUALITIES.map((q) => [q.id, 0]))
    const end = new Date(`${key}T12:00:00`)
    if (Number.isNaN(end.getTime())) return count
    for (let back = 0; back < 7; back += 1) {
      const d = new Date(end)
      d.setDate(d.getDate() - back)
      const k = dateKey(d)
      for (const x of all) {
        if (!(x.completions && x.completions[k])) continue
        if (!activityOccursOn({ ...x, seriesStart: x.seriesStart || '', type: 'protocol' }, k)) continue
        for (const q of kindsOf(x)) count[q] += 1
      }
    }
    return count
  }, [all, key, kindsOf])

  const most = Math.max(1, ...Object.values(week))
  const movedAtAll = Object.values(week).some((n) => n > 0)

  const write = (field) => (e) => {
    const v = e.target.value
    setTally((prev) => ({ ...obj(prev), [key]: { ...obj(obj(prev)[key]), [field]: v } }))
  }

  const TALLY = [
    { id: 'steps', label: 'Steps', hint: '8,412' },
    { id: 'active', label: 'Active', hint: '1 h 52' },
    { id: 'distance', label: 'Distance', hint: '4.6 mi' },
  ]

  return (
    <section className="mos-bleed border-t border-stone-200 px-6 py-14 md:px-12 md:py-20">
      <div className="mx-auto max-w-5xl">
        {/* The spread's own line. It is the only place on the day that says
            what the day is for rather than what is in it. */}
        <div className="flex items-start justify-between gap-8">
          <h2 className="font-serif text-[46px] leading-[0.95] text-stone-900 sm:text-[62px]">
            Moved,
            <br />
            <span className="italic">not</span>
            <br />
            measured.
          </h2>
          <svg width="74" height="68" viewBox="0 0 74 68" fill="none" aria-hidden className="mt-2 shrink-0 sm:h-[86px] sm:w-[94px]">
            <path d="M37 3 L71 65 L3 65 Z" stroke="#16130F" strokeWidth="1.25" />
          </svg>
        </div>

        {/* The record. */}
        <div className="mt-14">
          {today.map((x, idx) => {
            const kept = done(x)
            const long = mins(x.minutes)
            const meta = [long ? `${long} min` : '', x.detail].filter(Boolean).join(' · ')
            const kinds = kindsOf(x)
            return (
              <SwipeAway
                key={x.id}
                ground="#F8F4EC"
                onAway={() => setRaw((prev) => arr(prev).filter((y) => y.id !== x.id))}
              >
                <div className="flex items-start gap-6 border-t border-stone-200 py-6">
                  <span className="mt-[9px] w-6 shrink-0 text-[10px] uppercase tracking-[0.16em] text-stone-400">{two(idx + 1)}</span>
                  <button
                    onClick={() => setOpen(x)}
                    className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70"
                  >
                    <span className={`block font-serif text-[26px] leading-tight sm:text-[30px] ${kept ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                      {x.name}
                    </span>
                    {meta && <span className="mt-1.5 block text-[10px] uppercase tracking-[0.16em] text-stone-500">{meta}</span>}
                    {/* What it asked of her. Read for her, never typed. */}
                    {!!kinds.length && (
                      <span className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                        {kinds.map((id) => {
                          const q = qualityOf(id)
                          if (!q) return null
                          return (
                            <span key={id} className="flex items-center gap-2">
                              <span className="block h-[3px] w-[18px]" style={{ background: q.tone }} />
                              <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: q.tone }}>{q.label}</span>
                            </span>
                          )
                        })}
                      </span>
                    )}
                  </button>
                  {/* Kept. Pressing it keeps it. */}
                  <button
                    onClick={() => setDone(x.id, !kept)}
                    aria-pressed={kept}
                    className="mt-[9px] shrink-0 text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-60"
                    style={{ color: kept ? '#A8A29E' : '#C0966F' }}
                  >
                    {kept ? 'Kept' : 'Keep'}
                  </button>
                </div>
              </SwipeAway>
            )
          })}

          <div className="border-t border-stone-200 pt-3">
            <button
              onClick={() => setAdding(true)}
              aria-label="Add something she moved for"
              className="mx-auto block px-6 py-2 text-[30px] leading-none text-stone-900 transition-opacity hover:opacity-60"
            >
              +
            </button>
          </div>
        </div>

        {/* The eight, over the seven days behind her. */}
        <div className="mt-14 border-t border-stone-200 pt-9">
          <p className="kicker text-stone-500">Seven days, in what they asked</p>
          <div className="mt-7 grid gap-x-16 gap-y-5 sm:grid-cols-2">
            {QUALITIES.map((q) => {
              const n = week[q.id] || 0
              return (
                <div key={q.id} className="flex items-center gap-5">
                  <span className="w-[86px] shrink-0 text-[13px] text-stone-600 sm:w-[104px] sm:text-[15px]">{q.label}</span>
                  <span className="relative block h-[9px] min-w-0 flex-1" style={{ background: '#EEEAE1' }}>
                    <span
                      className="absolute inset-y-0 left-0 block transition-[width] duration-500"
                      style={{ width: `${n ? Math.max(9, (n / most) * 100) : 0}%`, background: q.tone }}
                    />
                  </span>
                  <span className="w-5 shrink-0 text-right text-[13px] text-stone-500 sm:text-[15px]">{n || ''}</span>
                </div>
              )
            })}
          </div>
          {!movedAtAll && (
            <p className="mt-7 text-[13px] italic text-stone-400">
              The week fills itself as she keeps what she did.
            </p>
          )}
        </div>

        {/* The footnote: the only measuring on the page, and hers to write. */}
        <div className="mt-14 grid grid-cols-3 gap-8 border-t border-stone-200 pt-9">
          {TALLY.map((t) => (
            <label key={t.id} className="block">
              <span className="kicker block text-stone-500">{t.label}</span>
              <input
                value={tally[t.id] || ''}
                onChange={write(t.id)}
                placeholder={t.hint}
                autoComplete="off"
                data-no-dictation
                className="mt-3 w-full bg-transparent font-serif text-[34px] leading-none text-stone-900 outline-none placeholder:text-stone-300 sm:text-[44px]"
              />
            </label>
          ))}
        </div>
      </div>

      {adding && (
        <MovementSheet
          startKey={key}
          onClose={() => setAdding(false)}
          onSave={(m) => {
            setRaw((prev) => [...arr(prev), { ...m, id: uid(), order: arr(prev).length, completions: {}, seriesStart: key }])
            setAdding(false)
          }}
        />
      )}

      {open && (
        <MovementSheet
          startKey={open.seriesStart || key}
          item={open}
          onClose={() => setOpen(null)}
          onDrop={() => { setRaw((prev) => arr(prev).filter((y) => y.id !== open.id)); setOpen(null) }}
          onSave={(m) => {
            setRaw((prev) => arr(prev).map((y) => (y.id === open.id ? { ...y, ...m } : y)))
            setOpen(null)
          }}
        />
      )}
    </section>
  )
}

// ── Adding, or opening, a form of movement.
//
// Any kind at all: the name, how long it takes, and one line of however it is
// counted — three miles, four by eight. One field for the unit rather than
// three, because the thing being counted changes with the thing being done.
// Nothing here asks what it was for; that is read from the name.
function MovementSheet({ item, startKey, onSave, onDrop, onClose }) {
  const [name, setName] = useState(item ? item.name : '')
  const [length, setLength] = useState(item ? String(item.minutes || '') : '')
  const [detail, setDetail] = useState(item ? item.detail || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const [repeat, setRepeat] = useState(() => {
    const r = { frequency: (item && item.frequency) || 'once' }
    if (item && Array.isArray(item.daysOfWeek) && item.daysOfWeek.length) r.daysOfWeek = item.daysOfWeek
    if (item && item.interval) r.interval = item.interval
    if (item && item.intervalUnit) r.intervalUnit = item.intervalUnit
    if (item && item.seriesEnd) r.seriesEnd = item.seriesEnd
    return r
  })

  const field = useRef(null)
  const save = () => {
    const t = name.trim().toLowerCase()
    if (!t) { if (field.current) field.current.focus(); return }
    const r = repeat || {}
    onSave({
      name: t,
      minutes: mins(length) || '',
      detail: detail.trim().toLowerCase(),
      notes,
      frequency: r.frequency || 'once',
      daysOfWeek: r.daysOfWeek || [],
      interval: r.interval || 0,
      intervalUnit: r.intervalUnit || '',
      seriesEnd: r.seriesEnd || '',
    })
  }

  // Pressing an action must not first blur the field: on a phone that dismisses
  // the keyboard, the sheet grows back under her thumb, and the press lands on
  // nothing. Holding focus through the press keeps the button where she aimed.
  const hold = (e) => e.preventDefault()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ background: 'rgba(22,19,15,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="mos-scroll max-h-[calc(88vh_-_var(--mos-kb))] w-full max-w-md overflow-y-auto px-7 pb-9 pt-8 sm:px-9"
        style={{ background: '#68472C', color: '#F7F4ED' }}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        <p className="text-[10px] uppercase tracking-[0.22em] text-cream/60">Moved</p>

        <input
          autoFocus
          ref={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Reformer, with Ines"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          data-no-dictation
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
          className="mt-4 w-full border-b border-cream/30 bg-transparent pb-2 font-serif text-[30px] lowercase text-cream outline-none placeholder:text-cream/30"
        />

        <div className="mt-8 flex items-end gap-6">
          <label className="w-[40%] block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">How long</span>
            <span className="mt-2 flex items-baseline gap-2 border-b border-cream/30 pb-2">
              <input
                value={length}
                onChange={(e) => setLength(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="50"
                autoComplete="off"
                data-no-dictation
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
                className="min-w-0 w-full bg-transparent font-serif text-[26px] leading-none text-cream outline-none placeholder:text-cream/30"
              />
              <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-cream/60">min</span>
            </span>
          </label>
          <label className="min-w-0 flex-1 block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">However it is counted</span>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="3.1 mi · 4 × 8"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-no-dictation
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
              className="mt-2 w-full border-b border-cream/30 bg-transparent pb-2 text-[17px] lowercase text-cream outline-none placeholder:text-cream/30"
            />
          </label>
        </div>

        <div className="mt-8">
          <RepeatField value={repeat} startKey={startKey} onChange={setRepeat} />
        </div>

        <label className="mt-8 block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Anything worth remembering about it."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-no-dictation
            className="mos-scroll mt-3 block min-h-[150px] w-full resize-y border-b border-cream/30 bg-transparent pb-3 text-[16px] lowercase leading-relaxed text-cream outline-none placeholder:text-cream/35"
          />
        </label>

        <div className="mt-9 flex items-center justify-between gap-6">
          {onDrop ? (
            <button onMouseDown={hold} onClick={onDrop} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70" style={{ color: OXBLOOD }}>Let it go</button>
          ) : <span />}
          <div className="flex items-center gap-7">
            <button onMouseDown={hold} onClick={onClose} className="text-[10px] uppercase tracking-[0.22em] text-cream/60 transition-opacity hover:opacity-70">Cancel</button>
            <button onMouseDown={hold} onClick={save} className="text-[10px] uppercase tracking-[0.22em] text-cream transition-opacity hover:opacity-70">{item ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
