import React, { useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { SITTINGS } from '../lib/meals'
import { parseKey } from '../lib/date'
import { pillarLabel } from '../lib/pillars'

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

// An hour, split so the meridiem can be set small beside the numerals.
const clockParts = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''))
  if (!m) return null
  const H = Number(m[1])
  return { face: `${H % 12 || 12}:${m[2]}`, mer: H < 12 ? 'am' : 'pm', mins: H * 60 + Number(m[2]) }
}

export default function DaySchedule({ dateKeyStr, rituals = [], meals = [], phase, onAdd }) {
  const [clockRaw] = useLocalStorage('mos:sittings', { standing: {}, days: {} })
  const standing = (clockRaw && clockRaw.standing) || {}
  const day = ((clockRaw && clockRaw.days) || {})[dateKeyStr] || {}

  const date = parseKey(dateKeyStr)

  const entries = useMemo(() => {
    const out = []

    // The sittings, at whatever hour they are set to, and only the ones that
    // actually hold something — an empty lunch is not an appointment.
    SITTINGS.forEach((s) => {
      const held = meals.filter((m) => m.slot === s.food || m.slot === s.drink)
      if (!held.length) return
      const at = day[s.id] || standing[s.id] || s.at
      out.push({ id: `sitting:${s.id}`, at, title: s.label, note: held.map((m) => m.name).join(' · ') })
    })

    // Anything else on the day that carries a clock time. Deduped, because a
    // thing that spans two parts of the day is still one thing at one hour.
    const seen = new Set()
    rituals.forEach((r) => {
      if (!r.time || seen.has(r.id)) return
      seen.add(r.id)
      out.push({ id: r.id, at: r.time, title: r.title, note: pillarLabel(r.category), done: r.done })
    })

    return out
      .map((e) => ({ ...e, clock: clockParts(e.at) }))
      .filter((e) => e.clock)
      .sort((a, b) => a.clock.mins - b.clock.mins)
  }, [meals, rituals, day, standing])

  // The cobalt mark goes on what is next, and only on the day itself — on any
  // other date nothing is "next".
  const now = new Date()
  const isToday = dateKeyStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const mins = now.getHours() * 60 + now.getMinutes()
  const nextId = isToday ? (entries.find((e) => e.clock.mins >= mins) || {}).id : null

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
          ) : entries.map((e) => (
            <div key={e.id} className="flex items-start gap-6 py-4 md:gap-8">
              <p className="w-[104px] shrink-0 text-right font-serif text-[30px] leading-none md:w-[124px] md:text-[34px]">
                {e.clock.face}
                <span className="ml-1.5 align-baseline text-[11px] tracking-[0.1em]" style={{ color: W.muted }}>{e.clock.mer}</span>
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
        </div>
      </div>

      {/* One way in, at the foot, on the right. */}
      <div className="flex justify-end border-t px-6 py-4 md:px-14" style={{ borderColor: W.faint }}>
        <button onClick={onAdd} className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70">
          <span className="text-base leading-none">+</span> Add to day
        </button>
      </div>
    </section>
  )
}
