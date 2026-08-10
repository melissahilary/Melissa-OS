import React from 'react'
import { dateKey, monthGrid, MONTHS, DOW, isSameDay } from '../../lib/date'
import { phaseForConfig, PHASES } from '../../lib/cycle'
import { holidayFor } from '../../lib/holidays'

// Shared month tints + legend so the Today schedule and every category's Monthly
// view read identically.
export const PHASE_TINT = { menstrual: '#F9EDEE', follicular: '#EFF4EF', ovulation: '#FAF5EE', luteal: '#F0EEF4' }
const PHASE_LEGEND = [
  { id: 'menstrual', label: 'Menstrual' },
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
]

// A single rhythm dot — filled when that part of the day holds something.
const RhythmDot = ({ on }) => (
  <span className={`h-[5px] w-[5px] rounded-full ${on ? 'bg-stone-500' : 'bg-stone-300/50'}`} />
)

// The one month calendar grid used everywhere — same sizing and style; only the
// content differs. Rather than cram each day with event titles (a preview no
// small cell can hold), a cell shows the day's SHAPE: the cycle-phase tint,
// three rhythm dots (morning · midday · evening) that fill when something's on
// then, and a ✦ when the day carries a timed appointment or special one-off.
// `daySignal(key)` returns { morning, afternoon, evening, special }; tapping a
// day selects it and the full plan opens in the panel below the grid.
export default function MonthGrid({ month, setMonth, selectedKey, onPickDay, today, cycleConfig = {}, daySignal, floorMonth }) {
  const cells = monthGrid(month)
  const atFloor = floorMonth && month <= floorMonth
  const goPrev = () => { if (!atFloor) setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)) }
  const goNext = () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <button onClick={goPrev} disabled={atFloor} className={`px-3 py-1 text-base ${atFloor ? 'text-stone-200' : 'text-stone-500 hover:text-stone-900'}`}>‹</button>
        <h3 className="whitespace-nowrap text-center font-serif text-2xl text-stone-900">{MONTHS[month.getMonth()]} {month.getFullYear()}</h3>
        <button onClick={goNext} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">›</button>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-stone-200">
        {DOW.map((d) => (
          <div key={d} className="border-b border-r border-stone-200 px-2 py-1.5 text-center kicker text-stone-400">{d[0]}</div>
        ))}
        {cells.map((cell) => {
          const key = dateKey(cell)
          const inMonth = cell.getMonth() === month.getMonth()
          const isSel = key === selectedKey
          const isTod = isSameDay(cell, today)
          const holiday = holidayFor(cell)
          const sig = inMonth && daySignal ? (daySignal(key) || {}) : {}
          const hasRhythm = sig.morning || sig.afternoon || sig.evening
          const phase = phaseForConfig(cycleConfig, cell)
          const tint = phase ? PHASE_TINT[phase.id] : undefined
          return (
            <div
              key={key}
              onClick={() => inMonth && onPickDay(key)}
              role="button"
              tabIndex={inMonth ? 0 : -1}
              style={tint ? { backgroundColor: tint } : undefined}
              className={`relative min-h-[74px] border-b border-r border-stone-200 px-1.5 py-1.5 text-left transition-shadow ${inMonth ? 'cursor-pointer hover:shadow-[inset_0_0_0_1px_rgba(120,113,108,0.25)]' : 'text-stone-300'} ${isSel ? 'ring-1 ring-inset ring-stone-900' : ''}`}
            >
              <div className="flex items-start justify-between">
                <span className={`inline-flex h-6 w-6 items-center justify-center text-xs ${isTod ? 'rounded-full bg-stone-900 text-cream' : inMonth ? 'text-stone-700' : 'text-stone-300'}`}>
                  {cell.getDate()}
                </span>
                {sig.special && <span title="Appointment or special day" className="mt-0.5 text-[12px] leading-none text-stone-500">✦</span>}
              </div>

              {holiday && <p className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-stone-400">{holiday}</p>}

              {hasRhythm && (
                <div className="mt-2 flex items-center gap-1" title="morning · midday · evening" aria-hidden>
                  <RhythmDot on={sig.morning} />
                  <RhythmDot on={sig.afternoon} />
                  <RhythmDot on={sig.evening} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-stone-400">
          <span className="flex items-center gap-1"><RhythmDot on /><RhythmDot on /><RhythmDot on /><span className="ml-1">morning · midday · evening</span></span>
          <span className="flex items-center gap-1"><span className="text-stone-500">✦</span> appointment</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          {PHASE_LEGEND.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (PHASES[p.id] && PHASES[p.id].color) || PHASE_TINT[p.id] }} />
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
