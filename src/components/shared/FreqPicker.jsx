import React, { useEffect, useRef, useState } from 'react'
import { FREQ_OPTIONS, freqCode } from '../../lib/cycle'
import { DOW } from '../../lib/date'

// A compact frequency tag that opens a non-clipping panel with the full list
// of frequencies plus optional explicit weekday selection.
export default function FreqPicker({ value, days, onChange, dark = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggleDay = (i) => {
    const cur = Array.isArray(days) ? days : []
    const next = cur.includes(i) ? cur.filter((d) => d !== i) : [...cur, i].sort((a, b) => a - b)
    onChange(value, next.length ? next : null)
  }

  return (
    <span className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={`px-1 text-[10px] leading-none tabular-nums transition-colors ${
          dark ? 'text-stone-300 hover:text-cream' : 'text-stone-500 hover:text-stone-900'
        }`}
        title="Change frequency"
      >
        {freqCode(value)}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-44 border border-stone-300 bg-cream p-2 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="kicker text-stone-400 mb-1.5 px-1">Frequency</p>
          <div className="grid grid-cols-2 gap-1">
            {FREQ_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value, days)
                  setOpen(false)
                }}
                className={`px-2 py-1 text-left text-xs border transition-colors ${
                  value === opt.value
                    ? 'bg-stone-900 text-cream border-stone-900'
                    : 'border-stone-200 text-stone-600 hover:border-stone-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="kicker text-stone-400 mb-1.5 mt-3 px-1">Specific days</p>
          <div className="flex flex-wrap gap-1">
            {DOW.map((d, i) => {
              const active = Array.isArray(days) && days.includes(i)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`h-7 w-7 text-[10px] border transition-colors ${
                    active
                      ? 'bg-stone-900 text-cream border-stone-900'
                      : 'border-stone-200 text-stone-500 hover:border-stone-500'
                  }`}
                >
                  {d[0]}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
