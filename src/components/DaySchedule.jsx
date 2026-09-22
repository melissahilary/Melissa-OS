import React, { useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { SITTINGS } from '../lib/meals'
import { parseKey } from '../lib/date'


// ── Today's schedule.
//
// A spine rather than a grid: only the hours that hold something are drawn, in
// the order they happen, so an empty afternoon costs no space at all. The date
// is set at the scale a date is set at in print and the day is read down the
// right — one column to know where you are, one to know what is next.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const W = {
  ground: '#68472C',
  ivory: '#F7F4ED',
  muted: 'rgba(247,244,237,0.62)',
  faint: 'rgba(247,244,237,0.22)',
  cobalt: '#1D2FC4',
}

const COUNT_WORD = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
// How many things a line actually contains. A sitting with electrolytes, clove
// water, colostrum and the plate reads "four steps"; drinks with a friend has
// no steps and so says nothing at all, rather than carrying a description.
const steps = (n) => (n > 1 ? `${COUNT_WORD[n] || n} steps` : n === 1 ? 'one step' : '')

// An hour, split so the meridiem can be set small beside the numerals.
const clockParts = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  if (!m) return null
  const H = Number(m[1])
  return { face: `${H % 12 || 12}:${m[2]}`, mer: H < 12 ? 'am' : 'pm', mins: H * 60 + Number(m[2]) }
}

// Five hours at a time. A day read all at once is a wall; five is a page of
// it, and the arrows only exist when there is a sixth.
const PER_PAGE = 5

export default function DaySchedule({ dateKeyStr, appointments = [], meals = [], phase, onAdd }) {
  const [adding, setAdding] = useState(false)
  const [page, setPage] = useState(0)
  const [clockRaw] = useLocalStorage('mos:sittings', { standing: {}, days: {} })
  const standing = (clockRaw && clockRaw.standing) || {}
  const day = ((clockRaw && clockRaw.days) || {})[dateKeyStr] || {}
  const hidden = (clockRaw && clockRaw.hidden) || {}

  const date = parseKey(dateKeyStr)

  const entries = useMemo(() => {
    const out = []

    // The sittings, at whatever hour they are set to — the ones that hold
    // something, and never one she has put away.
    SITTINGS.forEach((s) => {
      if (hidden[s.id]) return
      const held = meals.filter((m) => m.slot === s.food || m.slot === s.drink)
      if (!held.length) return
      const at = day[s.id] || standing[s.id] || s.at
      out.push({ id: `sitting:${s.id}`, at, title: s.label, note: steps(held.length) })
    })

    // And the day's appointments — the same ones the month carries. One with
    // an hour takes its place in the order; one without is still somewhere she
    // has to be, so it waits at the end rather than not being said at all.
    const seen = new Set()
    appointments.forEach((a) => {
      if (seen.has(a.id)) return
      seen.add(a.id)
      out.push({ id: a.id, at: a.time || '', title: a.title, note: '', done: a.done })
    })

    const timed = out.filter((e) => clockParts(e.at)).map((e) => ({ ...e, clock: clockParts(e.at) }))
    const untimed = out.filter((e) => !clockParts(e.at)).map((e) => ({ ...e, clock: null }))
    timed.sort((a, b) => a.clock.mins - b.clock.mins)
    return [...timed, ...untimed]
  }, [meals, appointments, day, standing, hidden])

  // The cobalt mark goes on what is next, and only on the day itself — on any
  // other date nothing is "next".
  const now = new Date()
  const isToday = dateKeyStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const mins = now.getHours() * 60 + now.getMinutes()
  const nextId = isToday ? (entries.find((e) => e.clock && e.clock.mins >= mins) || {}).id : null

  const pages = Math.max(1, Math.ceil(entries.length / PER_PAGE))
  const pg = Math.min(page, pages - 1)
  const shown = entries.slice(pg * PER_PAGE, pg * PER_PAGE + PER_PAGE)

  const rail = [MONTHS[date.getMonth()], phase && phase.cycleDay ? `Day ${phase.cycleDay}` : '', phase && phase.label]
    .filter(Boolean).join(' · ')

  return (
    <section className="mos-bleed mt-10" style={{ background: W.ground, color: W.ivory }}>
      <div className="grid md:grid-cols-[1fr_1fr]">
        {/* The date, set the way a date is set in print. */}
        <div className="px-6 pb-10 pt-12 md:px-14 md:pb-16 md:pt-16">
          <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: W.muted }}>Today&rsquo;s schedule</p>
          <p className="mt-6 font-serif leading-[0.82] text-[130px] md:text-[170px]">{date.getDate()}</p>
          <p className="mt-2 font-serif text-[52px] leading-none md:text-[64px]">{WEEKDAYS[date.getDay()]}</p>
          <p className="mt-6 text-[10px] uppercase tracking-[0.22em]" style={{ color: W.muted }}>{rail}</p>
        </div>

        {/* The day itself, read down. */}
        <div className="px-6 pb-10 md:px-14 md:pb-16 md:pt-16 md:border-l" style={{ borderColor: W.faint }}>
          {entries.length === 0 ? (
            <p className="py-6 text-[15px] italic" style={{ color: W.muted }}>Nothing is set for today.</p>
          ) : shown.map((e) => (
            <div key={e.id} className="flex items-start gap-6 py-4 md:gap-8">
              <p className="w-[104px] shrink-0 text-right font-serif text-[30px] leading-none md:w-[124px] md:text-[34px]">
                {e.clock ? (
                  <>
                    {e.clock.face}
                    <span className="ml-1.5 align-baseline text-[11px] tracking-[0.1em]" style={{ color: W.muted }}>{e.clock.mer}</span>
                  </>
                ) : (
                  <span style={{ color: W.muted }}>&mdash;</span>
                )}
              </p>
              <span
                className="mt-0.5 w-px shrink-0 self-stretch"
                style={{ background: e.id === nextId ? W.cobalt : W.faint, width: e.id === nextId ? 2 : 1 }}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-[19px] leading-snug ${e.done ? 'line-through' : ''}`} style={e.done ? { color: W.muted } : undefined}>{e.title}</p>
                {e.note && <p className="mt-1 text-[14px] leading-snug" style={{ color: W.muted }}>{e.note}</p>}
              </div>
            </div>
          ))}

          {/* Both ways along the day, under what they move. The one that can
              still be taken is lit; the one at the end of its travel is not. */}
          {pages > 1 && (
            <div className="mt-8 flex items-center justify-end gap-6">
              <button
                onClick={() => setPage(Math.max(0, pg - 1))}
                disabled={pg === 0}
                aria-label="Earlier"
                className="text-xl leading-none transition-opacity hover:opacity-60 disabled:cursor-default"
                style={{ color: pg === 0 ? W.muted : W.ivory }}
              >
                &larr;
              </button>
              <button
                onClick={() => setPage(Math.min(pages - 1, pg + 1))}
                disabled={pg === pages - 1}
                aria-label="Later"
                className="text-xl leading-none transition-opacity hover:opacity-60 disabled:cursor-default"
                style={{ color: pg === pages - 1 ? W.muted : W.ivory }}
              >
                &rarr;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* One way in, at the foot, on the right. */}
      <div className="flex justify-end border-t px-6 py-4 md:px-14" style={{ borderColor: W.faint }}>
        <button onClick={() => setAdding(true)} className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70">
          <span className="text-base leading-none">+</span> Add to day
        </button>
      </div>

      {adding && <AddToDay onClose={() => setAdding(false)} onSave={(title, at) => { onAdd(title, at); setAdding(false) }} />}
    </section>
  )
}

// ── Add to day.
//
// An hour and the thing itself, and nothing else to fill in. Anything that
// wants a pillar, a repeat or a note is edited afterwards; this is the line
// she writes while standing up.
function AddToDay({ onClose, onSave }) {
  const [at, setAt] = useState('')
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
