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
}

const HOUR = 56 // the height of an hour, in pixels
const OPENS_AT = 6 // where the day is scrolled to when it opens

const minutesOf = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
// An hour said the way it is said aloud: 6 AM, 12:30 PM, 9 PM.
const spokenHour = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
const spokenTime = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}

export default function DaySchedule({ dateKeyStr, appointments = [], phase, onAdd }) {
  const [adding, setAdding] = useState(null) // null | { at }
  const grid = useRef(null)
  const date = parseKey(dateKeyStr)

  // What is on the day, placed at its hour. Anything without one waits above
  // the grid rather than being guessed into a slot.
  const { placed, loose } = useMemo(() => {
    const seen = new Set()
    const on = []
    const off = []
    appointments.forEach((a) => {
      if (seen.has(a.id)) return
      seen.add(a.id)
      const start = minutesOf(a.time)
      if (start == null) { off.push(a); return }
      const end = minutesOf(a.endTime)
      on.push({ ...a, start, end: end && end > start ? end : start + 60 })
    })
    on.sort((x, y) => x.start - y.start)
    return { placed: on, loose: off }
  }, [appointments])

  // Open on the morning rather than at midnight.
  useEffect(() => {
    const el = grid.current
    if (el) el.scrollTop = OPENS_AT * HOUR
  }, [dateKeyStr])

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

          {/* Anything on the day with no hour on it yet. */}
          {loose.length > 0 && (
            <div className="mt-10 border-t pt-5" style={{ borderColor: W.faint }}>
              <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: W.muted }}>No hour set</p>
              {loose.map((e) => (
                <p key={e.id} className="mt-2.5 text-[17px] leading-snug">{e.title}</p>
              ))}
            </div>
          )}
        </div>

        {/* The day itself. Hours down the left, the day beside them. */}
        <div
          ref={grid}
          className="mos-scroll max-h-[560px] overflow-y-auto border-t md:max-h-[640px] md:border-l md:border-t-0"
          style={{ borderColor: W.faint }}
        >
          <div className="relative" style={{ height: 24 * HOUR }}>
            {Array.from({ length: 24 }, (_, h) => (
              <button
                key={h}
                onClick={() => setAdding({ at: `${String(h).padStart(2, '0')}:00` })}
                aria-label={`Add something at ${spokenHour(h)}`}
                className="absolute left-0 right-0 flex items-start border-t text-left transition-colors hover:bg-white/[0.04]"
                style={{ top: h * HOUR, height: HOUR, borderColor: W.hair }}
              >
                <span
                  className="w-[72px] shrink-0 pl-5 pt-1.5 text-[10px] uppercase tracking-[0.16em] md:w-[86px] md:pl-8"
                  style={{ color: W.muted }}
                >
                  {spokenHour(h)}
                </span>
              </button>
            ))}

            {/* What she is due somewhere for, at the hour she is due. */}
            {placed.map((e) => (
              <div
                key={e.id}
                className="absolute right-4 md:right-8"
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
                  <p className={`truncate text-[15px] leading-snug ${e.done ? 'line-through' : ''}`} style={e.done ? { color: W.muted } : undefined}>
                    <span className="mr-2.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: W.muted }}>{spokenTime(e.start)}</span>
                    {e.title}
                  </p>
                </div>
              </div>
            ))}

            {/* Now. */}
            {nowAt != null && (
              <div className="pointer-events-none absolute left-[72px] right-0" style={{ top: (nowAt / 60) * HOUR }}>
                <span className="block h-px w-full" style={{ background: W.cobalt }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* One way in, at the foot, on the right. */}
      <div className="flex justify-end border-t px-6 py-4 md:px-14" style={{ borderColor: W.faint }}>
        <button onClick={() => setAdding({ at: '' })} className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70">
          <span className="text-base leading-none">+</span> Add to day
        </button>
      </div>

      {adding && (
        <AddToDay
          at={adding.at}
          onClose={() => setAdding(null)}
          onSave={(title, at) => { onAdd(title, at); setAdding(null) }}
        />
      )}
    </section>
  )
}

// ── Add to day.
//
// An hour and the thing itself, and nothing else to fill in. Anything that
// wants a pillar, a repeat or a note is edited afterwards; this is the line
// she writes while standing up.
function AddToDay({ at: opensAt, onClose, onSave }) {
  const [at, setAt] = useState(opensAt || '')
  const [title, setTitle] = useState('')
  const save = () => { const t = title.trim(); if (!t) return; onSave(t, at) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(22,19,15,0.55)' }} onClick={onClose}>
      <div
        className="w-full max-w-md p-8"
        style={{ background: W.ground, color: W.ivory }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
      >
        <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: W.muted }}>Add to day</p>

        <label className="mt-8 block">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: W.muted }}>Time</span>
          <input
            type="time"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            className="mt-2 w-full border-b bg-transparent pb-2 font-serif text-[28px] leading-none outline-none"
            style={{ borderColor: W.faint, color: W.ivory, colorScheme: 'dark' }}
          />
        </label>

        <label className="mt-7 block">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: W.muted }}>What</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Drinks with Cheryl"
            className="mt-2 w-full border-b bg-transparent pb-2 text-[19px] outline-none placeholder:opacity-40"
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
