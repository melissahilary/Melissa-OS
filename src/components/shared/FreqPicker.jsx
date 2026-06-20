import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FREQ_OPTIONS, freqCode, PHASES } from '../../lib/cycle'
import { DOW } from '../../lib/date'

const PHASE_LIST = [PHASES.menstrual, PHASES.follicular, PHASES.ovulation, PHASES.luteal]

// A compact frequency tag that opens a portal popover (never clipped) with the
// full frequency list, explicit weekday selection, and cycle-phase assignment.
export default function FreqPicker({ value, days, phases, onChange, dark = false }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const place = () => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const width = 208
    let left = r.right - width
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    setCoords({ top: r.bottom + 6, left })
  }

  useLayoutEffect(() => {
    if (open) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    const onScroll = () => place()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const curDays = Array.isArray(days) ? days : []
  const curPhases = Array.isArray(phases) ? phases : []

  const toggleDay = (i) => {
    const next = curDays.includes(i) ? curDays.filter((d) => d !== i) : [...curDays, i].sort((a, b) => a - b)
    onChange(value, next.length ? next : null, curPhases)
  }
  const togglePhase = (id) => {
    const next = curPhases.includes(id) ? curPhases.filter((p) => p !== id) : [...curPhases, id]
    onChange(value, days, next)
  }

  return (
    <span className="relative inline-block">
      <button
        ref={btnRef}
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

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: 208 }}
            className="z-[70] border border-stone-300 bg-cream p-2.5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="kicker text-stone-400 mb-1.5 px-0.5">Frequency</p>
            <div className="grid grid-cols-2 gap-1">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value, days, curPhases)
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

            <p className="kicker text-stone-400 mb-1.5 mt-3 px-0.5">Specific days</p>
            <div className="flex flex-wrap gap-1">
              {DOW.map((d, i) => {
                const active = curDays.includes(i)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`h-7 w-7 text-[10px] border transition-colors ${
                      active ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-200 text-stone-500 hover:border-stone-500'
                    }`}
                  >
                    {d[0]}
                  </button>
                )
              })}
            </div>

            <p className="kicker text-stone-400 mb-1.5 mt-3 px-0.5">Cycle phase</p>
            <div className="grid grid-cols-2 gap-1">
              {PHASE_LIST.map((p) => {
                const active = curPhases.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePhase(p.id)}
                    className="flex items-center gap-1.5 px-2 py-1 text-left text-xs border transition-colors"
                    style={
                      active
                        ? { backgroundColor: p.color, color: p.ink, borderColor: p.color }
                        : { borderColor: '#e7e5e4', color: '#57534e' }
                    }
                  >
                    <span className="inline-block h-2 w-2" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
