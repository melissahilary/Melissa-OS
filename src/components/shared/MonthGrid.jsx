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

// The one month calendar grid used everywhere — same sizing and style; only the
// content differs. `itemsForDay(key)` returns that day's entries [{id,title,done}]
// to preview inside each cell. `floorMonth` (optional) disables paging before it.
export default function MonthGrid({ month, setMonth, selectedKey, onPickDay, today, cycleConfig = {}, itemsForDay, onOpenItem, floorMonth }) {
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
          const items = inMonth && itemsForDay ? (itemsForDay(key) || []) : []
          const phase = phaseForConfig(cycleConfig, cell)
          const tint = phase ? PHASE_TINT[phase.id] : undefined
          return (
            <div
              key={key}
              style={tint ? { backgroundColor: tint } : undefined}
              className={`group relative min-h-[78px] border-b border-r border-stone-200 px-1.5 py-1 text-left transition-colors ${inMonth ? '' : 'text-stone-300'} ${isSel ? 'ring-1 ring-inset ring-stone-900' : ''}`}
            >
              <button onClick={() => onPickDay(key)} className="block w-full text-left">
                <span className={`inline-flex h-6 w-6 items-center justify-center text-xs ${isTod ? 'bg-stone-900 text-cream rounded-full' : inMonth ? 'text-stone-700' : 'text-stone-300'}`}>
                  {cell.getDate()}
                </span>
              </button>

              {holiday && <p className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-stone-400">{holiday}</p>}

              <div className="mt-0.5 space-y-0.5">
                {items.slice(0, 2).map((ev) => (
                  <button key={ev.id} onClick={() => (onOpenItem ? onOpenItem(ev.id) : onPickDay(key))} className="flex w-full items-center gap-1 text-left">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                    <span className={`truncate text-[10px] ${ev.done ? 'text-stone-400 line-through' : 'text-stone-600'}`}>{ev.title || 'Untitled'}</span>
                  </button>
                ))}
                {items.length > 2 && (
                  <button onClick={() => onPickDay(key)} className="text-[9px] text-stone-400 hover:text-stone-700">+{items.length - 2} more</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        {PHASE_LEGEND.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (PHASES[p.id] && PHASES[p.id].color) || PHASE_TINT[p.id] }} />
            {p.label}
          </span>
        ))}
      </div>
    </>
  )
}
