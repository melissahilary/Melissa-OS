import React from 'react'
import { dateKey } from '../lib/date'

// ── The month, as a record.
//
// Ink ground, the month set at the scale a masthead is set at, and seven
// columns of hairline. What is printed in a cell is what is actually scheduled
// — an appointment, a draw, a thing that happens on a date. The daily habits
// are not here: they happen every day, so printing them thirty times says
// nothing and buries the one Tuesday that matters.
//
// Clicking a day turns that cell over to cream and the whole head of the page
// — the routines, the sittings, the schedule — follows it.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const INK = '#16130F'
const CREAM = '#F3EFE7'
const RULE = 'rgba(243,239,231,0.16)'
const DIM = 'rgba(243,239,231,0.55)'
// The accent, lifted for the ink ground. On the day she has opened, the cell
// turns to cream and what it holds is set in ink instead.
const COBALT_ON_INK = '#7C8BF0'

// A cell is a preview, not a list. It fills two lines and stops: names are
// taken until the line is full, so it ends on a whole name rather than a cut
// one, and what is left over is counted. A long title is cut back to whole
// words, the strength work — upper body, lower body, weights — is simply the
// gym, and everything is set lower case.
const LINE_BUDGET = 44
const GYMISH = /(upper|lower)\s*body|strength|weights|weight\s*training|lifting|resistance/i
// Everything in a cell is set lower case, however it was typed in. One item
// arrives as Pilates and the next as pilates, and a month that prints both as
// they came looks like two different registers on one page.
const short = (raw) => {
  const t = String(raw || '').trim().toLowerCase()
  if (!t) return ''
  if (GYMISH.test(t)) return 'gym'
  if (t.length <= 16) return t
  const words = t.split(/\s+/)
  let out = words[0]
  for (let i = 1; i < words.length; i += 1) {
    if ((`${out} ${words[i]}`).length > 16) break
    out = `${out} ${words[i]}`
  }
  return out
}

// As many names as two lines will hold, in the order they were given.
const fit = (names) => {
  const taken = []
  let len = 0
  for (const n of names) {
    const next = len ? len + 2 + n.length : n.length
    if (taken.length && next > LINE_BUDGET) break
    taken.push(n)
    len = next
  }
  return taken
}

export default function MonthCalendar({ month, setMonth, selectedKey, today, entriesFor, onPick }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  // Monday first, as the week is read here.
  const lead = (first.getDay() + 6) % 7
  const cells = []
  for (let i = 0; i < lead; i += 1) cells.push(null)
  for (let d = 1; d <= last.getDate(); d += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const todayKey = dateKey(today)
  const step = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <section className="mos-bleed" style={{ background: INK, color: CREAM }}>
      <div className="flex items-end justify-between gap-6 px-6 pb-8 pt-12 md:px-14 md:pb-10 md:pt-14">
        <h2 className="flex items-baseline gap-5">
          <span className="font-serif text-[58px] leading-none md:text-[86px]">{MONTHS[month.getMonth()]}</span>
          <span className="text-[11px] tracking-[0.22em]" style={{ color: DIM }}>{month.getFullYear()}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-6 pb-2">
          <button onClick={() => step(-1)} aria-label="Previous month" className="text-lg leading-none transition-opacity hover:opacity-60">&lsaquo;</button>
          <button onClick={() => step(1)} aria-label="Next month" className="text-lg leading-none transition-opacity hover:opacity-60">&rsaquo;</button>
        </div>
      </div>

      <div className="grid grid-cols-7 px-6 md:px-14">
        {DAYS.map((d) => (
          <p key={d} className="pb-4 text-[10px] uppercase tracking-[0.18em]" style={{ color: DIM }}>{d}</p>
        ))}
      </div>

      <div className="grid grid-cols-7 px-6 pb-12 md:px-14 md:pb-16" style={{ borderColor: RULE }}>
        {cells.map((d, idx) => {
          if (!d) return <div key={`x${idx}`} className="min-h-[92px] border-t md:min-h-[124px]" style={{ borderColor: RULE }} />
          const k = dateKey(d)
          const on = k === selectedKey
          const entries = entriesFor(k) || []
          return (
            <button
              key={k}
              onClick={() => onPick(k)}
              aria-current={on ? 'date' : undefined}
              className="flex min-h-[112px] flex-col items-start border-t p-3 text-left transition-colors md:min-h-[152px] md:p-5"
              style={{ borderColor: RULE, background: on ? CREAM : 'transparent', color: on ? INK : CREAM }}
            >
              <span className="font-serif text-[22px] leading-none md:text-[26px]">{d.getDate()}</span>
              {k === todayKey && !on && <span className="ml-2 align-middle text-[9px] uppercase tracking-[0.16em]" style={{ color: DIM }}>Today</span>}
              {/* One line, as a line is written: gym, pilates. Not a column of
                  one-word rows. What will not fit is counted at the end. */}
              {entries.length > 0 && (() => {
                const shown = fit(entries.map((e) => short(e.title)))
                const rest = entries.length - shown.length
                return (
                  <span className="mt-4 block text-[13px] leading-relaxed md:text-[14px]" style={{ color: on ? INK : COBALT_ON_INK }}>
                    <span className="block">{shown.join(', ')}</span>
                    {rest > 0 && (
                      <span className="mt-1 block text-[11px]" style={{ color: on ? 'rgba(22,19,15,0.55)' : DIM }}>+{rest} more</span>
                    )}
                  </span>
                )
              })()}
            </button>
          )
        })}
      </div>
    </section>
  )
}
