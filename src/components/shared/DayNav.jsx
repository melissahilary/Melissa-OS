import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dateKey, weekDays, addDays, isSameDay, DOW, DOW_LONG, MONTHS } from '../../lib/date'

// Day navigation: prev/next arrows + a week of day initials.
// Shared by Meal Planning and Health & Fitness so both read identically.
export function DayNav({ selected, setSelected, today }) {
  const days = weekDays(selected)
  return (
    <div className="mb-10 flex items-center justify-center gap-5">
      <button
        onClick={() => setSelected(addDays(selected, -1))}
        className="text-stone-400 hover:text-stone-900"
        aria-label="Previous day"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="flex items-center gap-1.5">
        {days.map((d) => {
          const sel = isSameDay(d, selected)
          const isTod = isSameDay(d, today)
          return (
            <button
              key={dateKey(d)}
              onClick={() => setSelected(d)}
              className="flex flex-col items-center gap-1"
              aria-label={DOW_LONG[d.getDay()]}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                  sel ? 'bg-stone-900 text-cream' : 'text-stone-400 hover:text-stone-900'
                }`}
              >
                {DOW[d.getDay()][0]}
              </span>
              <span className={`h-1 w-1 rounded-full ${isTod ? 'bg-sand' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
      <button
        onClick={() => setSelected(addDays(selected, 1))}
        className="text-stone-400 hover:text-stone-900"
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

export function DayHeader({ date, phase }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="kicker text-stone-400 mb-1">{DOW_LONG[date.getDay()]}</p>
        <h2 className="font-serif italic text-4xl md:text-5xl leading-none text-stone-900">
          {MONTHS[date.getMonth()]} {date.getDate()}
        </h2>
      </div>
      {phase && (
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
          style={{ backgroundColor: phase.color, color: phase.ink }}
        >
          <span className="font-medium">{phase.name}</span>
          <span className="opacity-70">· Day {phase.cycleDay}</span>
        </span>
      )}
    </div>
  )
}
