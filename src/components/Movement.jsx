import React, { useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { activityOccursOn } from '../lib/activities'
import SwipeAway, { OXBLOOD } from './shared/SwipeAway'
import RepeatField from './shared/Repeat'

// ── Moved, not measured.
//
// What she did with her body today, kept the way the rest of the day is kept:
// a line, a time, and whatever unit that particular thing is counted in —
// fifty minutes, three miles, four sets of eight. The app does not care which,
// because a body does not keep one unit.
//
// The three numbers at the foot are the only measuring on the page, and they
// are hers to write rather than a device's to report: steps, time on her feet,
// distance. Everything above them is the record; they are the footnote.

const uid = () => Math.random().toString(36).slice(2, 10)
const arr = (v) => (Array.isArray(v) ? v : [])
const two = (n) => String(n).padStart(2, '0')

const spoken = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  if (!m) return ''
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}
const minutesOf = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export default function Movement({ dateKeyStr }) {
  const [raw, setRaw] = useLocalStorage('mos:movement', [])
  const [tallyRaw, setTally] = useLocalStorage('mos:movement:tally', {})
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(null)

  const key = dateKeyStr || dateKey(new Date())
  const all = arr(raw)
  const tally = (tallyRaw && typeof tallyRaw === 'object' ? tallyRaw : {})[key] || {}

  // What lands on this day, in the order of the day: the ones with an hour
  // first, in order; the ones without at the end, where "before bed" lives.
  const today = all
    .filter((x) => activityOccursOn({ ...x, seriesStart: x.seriesStart || '', type: 'protocol' }, key))
    .sort((a, b) => {
      const x = minutesOf(a.at)
      const y = minutesOf(b.at)
      if (x == null && y == null) return (a.order || 0) - (b.order || 0)
      if (x == null) return 1
      if (y == null) return -1
      return x - y
    })

  const done = (x) => !!(x.completions && x.completions[key])
  const setDone = (id, on) => setRaw((prev) => arr(prev).map((x) => {
    if (x.id !== id) return x
    const c = { ...(x.completions || {}) }
    if (on) c[key] = true
    else delete c[key]
    return { ...x, completions: c }
  }))

  // Which one she is in the middle of: the last hour that has come round and
  // has not been kept yet. Only on the day itself — "now" on a Thursday in
  // November is not a word that means anything.
  const now = new Date()
  const isToday = key === dateKey(now)
  const mins = now.getHours() * 60 + now.getMinutes()
  let nowId = null
  if (isToday) {
    today.forEach((x) => {
      const at = minutesOf(x.at)
      if (at != null && at <= mins && !done(x)) nowId = x.id
    })
  }

  const write = (field) => (e) => {
    const v = e.target.value
    setTally((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {}
      return { ...base, [key]: { ...(base[key] || {}), [field]: v } }
    })
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
            const meta = [spoken(x.at), x.detail].filter(Boolean).join(' · ')
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
                  </button>
                  {/* Kept, or the one she is in. Pressing it keeps it. */}
                  <button
                    onClick={() => setDone(x.id, !kept)}
                    aria-pressed={kept}
                    className="mt-[9px] shrink-0 text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-60"
                    style={{ color: kept ? '#A8A29E' : x.id === nowId ? '#1D2FC4' : '#C0966F' }}
                  >
                    {kept ? 'Kept' : x.id === nowId ? 'Now' : 'Keep'}
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
// Any kind at all: the name, the hour it happens at if it happens at one, and
// one line of however it is counted — fifty minutes, three miles, four by
// eight. One field for the unit rather than three, because the thing being
// counted changes with the thing being done.
function MovementSheet({ item, startKey, onSave, onDrop, onClose }) {
  const [name, setName] = useState(item ? item.name : '')
  const [at, setAt] = useState(item ? item.at || '' : '')
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
      at,
      detail: detail.trim().toLowerCase(),
      notes,
      frequency: r.frequency || 'once',
      daysOfWeek: r.daysOfWeek || [],
      interval: r.interval || 0,
      intervalUnit: r.intervalUnit || '',
      seriesEnd: r.seriesEnd || '',
    })
  }

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
          <label className="w-[46%] block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">At</span>
            <input
              type="time"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
              className="mt-2 w-full border-b border-cream/30 bg-transparent pb-2 font-serif text-[21px] leading-none text-cream outline-none md:text-[26px]"
              style={{ colorScheme: 'dark' }}
            />
          </label>
          <label className="min-w-0 flex-1 block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">However it is counted</span>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="50 min · 3.1 mi · 4 × 8"
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
            <button onClick={onDrop} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70" style={{ color: OXBLOOD }}>Let it go</button>
          ) : <span />}
          <div className="flex items-center gap-7">
            <button onClick={onClose} className="text-[10px] uppercase tracking-[0.22em] text-cream/60 transition-opacity hover:opacity-70">Cancel</button>
            <button onClick={save} className="text-[10px] uppercase tracking-[0.22em] text-cream transition-opacity hover:opacity-70">{item ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
