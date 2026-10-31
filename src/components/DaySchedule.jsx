import React, { useEffect, useMemo, useRef, useState } from 'react'
import { parseKey } from '../lib/date'

// ── Today's schedule, as a day planner.
//
// Hours down the left and the day beside them, empty until she fills it. It
// was a spine before — only the hours that held something, printed in order —
// which reads well and plans nothing: there is nowhere to put the two o'clock
// she has not made yet. A grid has somewhere for everything, including what is
// not there, and the gaps are the point.
//
// An hour was also the only length anything could be. Drawing the length is
// how a day is written everywhere else she writes on one, so the grid takes a
// drag: press where it starts, pull to where it ends, and the two o'clock to
// half three is the thing she drew, not an hour the app guessed at.
//
// Nothing is pre-filled. The sittings are their own strip above this one, and
// the routines are the two blocks above that; what lands here is what she is
// due somewhere for.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const W = {
  ground: '#68472C',
  ivory: '#F7F4ED',
  muted: 'rgba(247,244,237,0.62)',
  faint: 'rgba(247,244,237,0.22)',
  hair: 'rgba(247,244,237,0.14)',
  cobalt: '#1D2FC4',
  block: 'rgba(247,244,237,0.10)',
  draft: 'rgba(247,244,237,0.14)',
}

const HOUR = 56 // the height of an hour, in pixels
const OPENS_AT = 6 // where the day is scrolled to when it opens
const SNAP = 15 // the quarter hour, which is as fine as a day is ever cut
const DAY = 24 * 60
const HOLD = 180 // how long a finger rests before it is drawing rather than scrolling

const minutesOf = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
// An hour said the way it is said aloud: 6 AM, 12:30 PM, 9 PM.
const spokenHour = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
const spokenTime = (mins) => {
  const t = Math.min(mins, DAY - 1)
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}
// A quarter past, in the gutter, said the way a clock face says it.
const cutOf = (mins) => `${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')}`
const clockOf = (mins) => {
  const t = Math.min(mins, DAY - 1)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export default function DaySchedule({ dateKeyStr, appointments = [], phase, onAdd }) {
  const [adding, setAdding] = useState(null) // null | { at, until }
  const [draft, setDraft] = useState(null) // null | { start, end } — the thing being drawn
  const [hover, setHover] = useState(null) // the hour under a cursor, on a desktop
  const scroller = useRef(null)
  const layer = useRef(null)
  const drag = useRef(null)
  const date = parseKey(dateKeyStr)

  // What is on the day, placed at its hour.
  const placed = useMemo(() => {
    const seen = new Set()
    const on = []
    appointments.forEach((a) => {
      if (seen.has(a.id)) return
      seen.add(a.id)
      const start = minutesOf(a.time)
      // No hour, no place on a grid of hours — and no pile under the day
      // either, which is the thing a planner is meant to replace.
      if (start == null) return
      const end = minutesOf(a.endTime)
      on.push({ ...a, start, end: end && end > start ? end : start + 60 })
    })
    return on.sort((x, y) => x.start - y.start)
  }, [appointments])

  // Open on the morning rather than at midnight.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = OPENS_AT * HOUR
  }, [dateKeyStr])

  // ── Drawing an hour ───────────────────────────────────────────────
  //
  // Where a point on the glass falls on the day, to the quarter hour.
  const atY = (clientY) => {
    const el = layer.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const mins = ((clientY - r.top) / HOUR) * 60
    return Math.max(0, Math.min(DAY, Math.round(mins / SNAP) * SNAP))
  }

  const put = (v) => { if (drag.current) drag.current.span = v; setDraft(v) }

  const begin = (clientY) => {
    const m = Math.min(atY(clientY), DAY - SNAP)
    drag.current = { anchor: m, y: clientY, drew: false, span: null, raf: 0 }
    put({ start: m, end: m + SNAP })
    // Once a length is being drawn, the day carries on under the finger at
    // the edges, so a block can run past the bottom of the window without
    // letting go. Not before: a press that simply lands near the edge is
    // standing still, and the day should stand still with it.
    const creep = () => {
      const d = drag.current
      if (!d) return
      const sc = scroller.current
      if (sc && d.drew) {
        const r = sc.getBoundingClientRect()
        const over = d.y - (r.bottom - 36)
        const under = (r.top + 36) - d.y
        if (over > 0) { sc.scrollTop += Math.min(12, 3 + over / 8); carry(d.y) }
        else if (under > 0) { sc.scrollTop -= Math.min(12, 3 + under / 8); carry(d.y) }
      }
      d.raf = requestAnimationFrame(creep)
    }
    drag.current.raf = requestAnimationFrame(creep)
  }

  const carry = (clientY) => {
    const d = drag.current
    if (!d) return
    d.y = clientY
    const m = atY(clientY)
    if (Math.abs(m - d.anchor) >= SNAP) d.drew = true
    const start = Math.min(d.anchor, m)
    const end = Math.max(d.anchor, m)
    put({ start, end: end > start ? end : start + SNAP })
  }

  const finish = () => {
    const d = drag.current
    if (!d) return
    if (d.raf) cancelAnimationFrame(d.raf)
    drag.current = null
    const span = d.span
    setDraft(null)
    if (!span) return
    // A tap is still a tap: it means the hour it landed in, the way it always
    // has. A drag means exactly what she drew.
    const start = d.drew ? span.start : Math.floor(span.start / 60) * 60
    const end = d.drew ? span.end : start + 60
    setAdding({ at: clockOf(start), until: clockOf(end) })
  }

  // A mouse draws from the moment it goes down. A finger has to rest first,
  // because the same movement is how the day is scrolled — so nothing is
  // caught until it has stayed still long enough to mean it.
  useEffect(() => {
    const el = layer.current
    if (!el) return undefined
    let hold = 0
    let armed = false
    let origin = null

    const clear = () => { if (hold) { clearTimeout(hold); hold = 0 } }

    const onDown = (e) => {
      if (e.pointerType === 'touch') return
      e.preventDefault()
      armed = true
      begin(e.clientY)
    }
    const onMove = (e) => { if (armed && drag.current) carry(e.clientY) }
    const onUp = () => { if (armed) { armed = false; finish() } }

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      origin = { x: t.clientX, y: t.clientY }
      clear()
      hold = setTimeout(() => { hold = 0; armed = true; begin(origin.y) }, HOLD)
    }
    const onTouchMove = (e) => {
      const t = e.touches[0]
      if (!t) return
      if (!armed) {
        // Moved before it settled — she is reading the day, not writing on it.
        if (origin && (Math.abs(t.clientX - origin.x) > 8 || Math.abs(t.clientY - origin.y) > 8)) clear()
        return
      }
      if (e.cancelable) e.preventDefault()
      carry(t.clientY)
    }
    const onTouchEnd = () => {
      if (armed) { armed = false; clear(); finish(); return }
      // Lifted before it had settled, and never moved: a tap, which means the
      // hour it landed in — the way it always has.
      const tapped = !!hold && origin
      clear()
      if (tapped) {
        const at = Math.floor(atY(origin.y) / 60) * 60
        setAdding({ at: clockOf(at), until: clockOf(at + 60) })
      }
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    return () => {
      clear()
      if (drag.current && drag.current.raf) cancelAnimationFrame(drag.current.raf)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  // Where now is, and only on the day itself.
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowAt = dateKeyStr === todayKey ? now.getHours() * 60 + now.getMinutes() : null

  const rail = [MONTHS[date.getMonth()], phase && phase.cycleDay ? `Day ${phase.cycleDay}` : '', phase && phase.label]
    .filter(Boolean).join(' · ')

  return (
    <section className="mos-bleed" style={{ background: W.ground, color: W.ivory }}>
      <div className="grid md:grid-cols-[1fr_1.35fr]">
        {/* The date, set the way a date is set in print. */}
        <div className="px-6 pb-8 pt-12 md:px-14 md:pb-16 md:pt-16">
          <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: W.muted }}>Today&rsquo;s schedule</p>
          <p className="mt-6 font-serif leading-[0.82] text-[130px] md:text-[170px]">{date.getDate()}</p>
          <p className="mt-2 font-serif text-[52px] leading-none md:text-[64px]">{WEEKDAYS[date.getDay()]}</p>
          <p className="mt-6 text-[10px] uppercase tracking-[0.22em]" style={{ color: W.muted }}>{rail}</p>
        </div>

        {/* The day itself. Hours down the left, the day beside them. */}
        <div
          ref={scroller}
          className="mos-scroll max-h-[560px] overflow-y-auto border-t md:max-h-[640px] md:border-l md:border-t-0"
          style={{ borderColor: W.faint }}
        >
          <div ref={layer} className="relative select-none" style={{ height: DAY / 60 * HOUR, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
            {/* The hours. Drawn, not pressed — the whole face takes the drag,
                so the lines are only ever lines. */}
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="pointer-events-none absolute left-0 right-0 flex items-start border-t"
                style={{ top: h * HOUR, height: HOUR, borderColor: W.hair, background: hover === h && !draft ? 'rgba(255,255,255,0.055)' : undefined }}
              >
                <span
                  className="w-[72px] shrink-0 pl-5 pt-1.5 text-[10px] uppercase tracking-[0.16em] md:w-[86px] md:pl-8"
                  style={{ color: W.muted }}
                >
                  {spokenHour(h)}
                </span>
                {hover === h && !draft && (
                  <span className="mt-1.5 hidden text-[10px] uppercase tracking-[0.18em] md:block" style={{ color: W.muted }}>+</span>
                )}
              </div>
            ))}

            {/* What she is due somewhere for, at the hour she is due. */}
            {placed.map((e) => (
              <div
                key={e.id}
                className="pointer-events-none absolute right-4 md:right-8"
                style={{
                  top: (e.start / 60) * HOUR + 2,
                  height: Math.max(((e.end - e.start) / 60) * HOUR - 4, 28),
                  left: 72,
                }}
              >
                <div
                  className="h-full overflow-hidden px-3.5 py-1.5"
                  style={{ background: W.block, borderLeft: `2px solid ${W.ivory}` }}
                >
                  {/* The hour and the thing on one line, so a half-hour block
                      says as much as a two-hour one. */}
                  <p className={`truncate text-[15px] lowercase leading-snug ${e.done ? 'line-through' : ''}`} style={e.done ? { color: W.muted } : undefined}>
                    <span className="mr-2.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: W.muted }}>{spokenTime(e.start)}</span>
                    {e.title}
                  </p>
                </div>
              </div>
            ))}

            {/* The length she is drawing, with a mark at each end and the two
                hours said in the gutter as they change. */}
            {draft && (
              <>
                <div
                  className="pointer-events-none absolute right-4 md:right-8"
                  style={{
                    top: (draft.start / 60) * HOUR,
                    height: Math.max(((draft.end - draft.start) / 60) * HOUR, 14),
                    left: 72,
                    background: W.draft,
                    outline: `1px solid ${W.ivory}`,
                  }}
                >
                  <span className="absolute left-0 top-0 block h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: W.ivory }} />
                  <span className="absolute bottom-0 right-0 block h-[9px] w-[9px] translate-x-1/2 translate-y-1/2 rounded-full" style={{ background: W.ivory }} />
                </div>
                {/* Only the ends that fall between the hours are said: on the
                    hour the gutter has already said it. */}
                {[draft.start, draft.end].filter((m) => m % 60).map((m, i) => (
                  <span
                    key={i}
                    className="pointer-events-none absolute left-0 flex h-[15px] w-[72px] items-center whitespace-nowrap pl-5 text-[10px] uppercase tracking-[0.1em] md:w-[86px] md:pl-8"
                    style={{ top: (m / 60) * HOUR - 7, color: W.ivory, background: W.ground }}
                  >
                    {cutOf(m)}
                  </span>
                ))}
              </>
            )}

            {/* Now. */}
            {nowAt != null && (
              <div className="pointer-events-none absolute left-[72px] right-0" style={{ top: (nowAt / 60) * HOUR }}>
                <span className="block h-px w-full" style={{ background: W.cobalt }} />
              </div>
            )}

            {/* The face that takes the drag. Everything above it is drawn on
                top and passes its touches straight through. */}
            <div
              className="absolute inset-0"
              style={{ touchAction: 'pan-y' }}
              onPointerMove={(e) => { if (e.pointerType === 'mouse' && !drag.current) setHover(Math.floor(atY(e.clientY) / 60)) }}
              onPointerLeave={() => setHover(null)}
            />
          </div>
        </div>
      </div>

      {/* No mark at the foot of this one. The day is the way in: press where it
          starts and pull to where it ends, which is how a day is written on
          everywhere else she writes on one. */}

      {adding && (
        <AddToDay
          at={adding.at}
          until={adding.until}
          onClose={() => setAdding(null)}
          onSave={(title, at, until) => { onAdd(title, at, until); setAdding(null) }}
        />
      )}
    </section>
  )
}

// ── Add to day.
//
// The two hours she drew and the thing itself, and nothing else to fill in.
// Anything that wants a pillar, a repeat or a note is edited afterwards; this
// is the line she writes while standing up.
function AddToDay({ at: opensAt, until: opensUntil, onClose, onSave }) {
  const [at, setAt] = useState(opensAt || '')
  const [until, setUntil] = useState(opensUntil || '')
  const [title, setTitle] = useState('')
  const save = () => { const t = title.trim().toLowerCase(); if (!t) return; onSave(t, at, until) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(22,19,15,0.55)' }} onClick={onClose}>
      <div
        className="w-full max-w-md p-8"
        style={{ background: W.ground, color: W.ivory }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
      >
        <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: W.muted }}>Add to day</p>

        <div className="mt-8 flex items-end gap-6">
          <label className="min-w-0 flex-1 block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: W.muted }}>From</span>
            <input
              type="time"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              className="mt-2 w-full border-b bg-transparent pb-2 font-serif text-[21px] leading-none outline-none md:text-[26px]"
              style={{ borderColor: W.faint, color: W.ivory, colorScheme: 'dark' }}
            />
          </label>
          <label className="min-w-0 flex-1 block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: W.muted }}>To</span>
            <input
              type="time"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="mt-2 w-full border-b bg-transparent pb-2 font-serif text-[21px] leading-none outline-none md:text-[26px]"
              style={{ borderColor: W.faint, color: W.ivory, colorScheme: 'dark' }}
            />
          </label>
        </div>

        <label className="mt-7 block">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: W.muted }}>What</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Drinks with Cheryl"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            data-no-dictation
            className="mt-2 w-full border-b bg-transparent pb-2 text-[19px] lowercase outline-none placeholder:opacity-40"
            style={{ borderColor: W.faint, color: W.ivory }}
          />
        </label>

        <div className="mt-9 flex items-center justify-end gap-7">
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70" style={{ color: W.muted }}>Cancel</button>
          <button onClick={save} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70">Add</button>
        </div>
      </div>
    </div>
  )
}
