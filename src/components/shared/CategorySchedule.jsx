import React, { useMemo, useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useActivities } from '../../hooks/useActivities'
import { useRegisterAdd } from './AddButton'
import { usePhaseColors } from '../../hooks/usePhaseColors'
import { phaseForConfig } from '../../lib/cycle'
import { useLifeStage } from '../../lib/lifeStage'
import { dateKey, parseKey, addDays, MONTHS, MONTHS_SHORT, DOW, fmtSpan } from '../../lib/date'
import { blankActivity } from '../../lib/activities'
import { occursOnCal, DayItemForm } from './CategoryCalendar'

// ── Schedule — one view of a pillar's time. A ribbon of days you glide along
// (today inked, cycle phase as an underline breath, item marks as dots), and
// beneath it the docket: the chosen day in full, then what's ahead.

const RANGE_BACK = 7 // days behind today the ribbon starts
const RANGE_FWD = 60 // days ahead it reaches

const fmtTime = (t) => {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${ap}`
}

export default function CategorySchedule({ category, noun = 'Item', cycleConfig = {} }) {
  const { activities, add, update, remove } = useActivities()
  const { colors } = usePhaseColors()
  const { flags } = useLifeStage()
  // The phase wash only breathes for stages that live by a cycle.
  const phaseCfg = flags.phases ? cycleConfig : {}
  const today = new Date()
  const todayK = dateKey(today)
  const [selKey, setSelKey] = useState(todayK)
  const [editing, setEditing] = useState(null)
  const ribbonRef = useRef(null)

  const mine = useMemo(() => activities.filter((a) => a.category === category && a.status !== 'archived'), [activities, category])

  const days = useMemo(() => Array.from({ length: RANGE_BACK + RANGE_FWD + 1 }, (_, i) => {
    const d = addDays(today, i - RANGE_BACK)
    const k = dateKey(d)
    return { d, k, items: mine.filter((a) => occursOnCal(a, k)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [mine, todayK])

  // Scroll today into view on mount.
  useEffect(() => {
    const el = ribbonRef.current
    if (!el) return
    const t = el.querySelector('[data-today="1"]')
    if (t) el.scrollLeft = t.offsetLeft - el.clientWidth / 2 + t.clientWidth / 2
  }, [])

  const sel = days.find((x) => x.k === selKey) || days[RANGE_BACK]
  const selD = parseKey(sel.k)

  // What's ahead — the next dated appointments / one-time items after the selected day.
  const ahead = useMemo(() => {
    const out = []
    for (const day of days) {
      if (day.k <= sel.k) continue
      day.items.forEach((a) => {
        const oneTime = a.frequency === 'asneeded' || a.frequency === 'once' || !!(a.details && a.details.time)
        if (oneTime) out.push({ a, k: day.k })
      })
      if (out.length >= 8) break
    }
    return out.slice(0, 8)
  }, [days, sel.k])

  const openNew = (k) => setEditing({ dayKey: k, activity: blankActivity('protocol', { category, frequency: 'asneeded', timeOfDay: ['morning'], seriesStart: k }) })
  useRegisterAdd(() => openNew(selKey), [selKey])
  const save = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }
  const scrollBy = (n) => { const el = ribbonRef.current; if (el) el.scrollBy({ left: n, behavior: 'smooth' }) }

  return (
    <div className="mb-10">
      {/* The ribbon */}
      <div className="relative">
        <button onClick={() => scrollBy(-360)} aria-label="Earlier" className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-cream/90 p-1.5 text-stone-400 shadow-sm hover:text-stone-900"><ChevronLeft size={16} /></button>
        <button onClick={() => scrollBy(360)} aria-label="Later" className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-cream/90 p-1.5 text-stone-400 shadow-sm hover:text-stone-900"><ChevronRight size={16} /></button>
        <div ref={ribbonRef} className="no-scrollbar flex gap-1.5 overflow-x-auto scroll-smooth px-1 pb-2">
          {days.map(({ d, k, items }) => {
            const on = k === sel.k
            const isToday = k === todayK
            const ph = phaseForConfig(phaseCfg, d)
            const tint = ph ? colors[ph.id] : null
            const monthStart = d.getDate() === 1 || k === days[0].k
            return (
              <div key={k} className="flex flex-col items-center">
                {/* month label floats above the first of each month */}
                <span className={`mb-1 h-3 text-[9px] tracking-[0.18em] text-stone-400 ${monthStart ? '' : 'invisible'}`}>{MONTHS_SHORT[d.getMonth()].toUpperCase()}</span>
                <button
                  data-today={isToday ? '1' : undefined}
                  onClick={() => setSelKey(k)}
                  className={`relative flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-2xl px-1 pb-2.5 pt-2 transition-colors ${on ? 'bg-stone-900 text-cream' : 'hover:bg-stone-500/5'}`}
                >
                  <span className={`text-[9px] tracking-wider ${on ? 'text-cream/60' : 'text-stone-400'}`}>{DOW[d.getDay()][0]}</span>
                  <span className={`font-serif text-lg leading-none tabular-nums ${on ? '' : isToday ? 'text-stone-900' : 'text-stone-600'}`}>{d.getDate()}</span>
                  {/* item marks */}
                  <span className="flex h-1.5 items-center gap-0.5">
                    {items.slice(0, 3).map((_, i) => <span key={i} className={`h-1 w-1 rounded-full ${on ? 'bg-cream/80' : 'bg-stone-400'}`} />)}
                  </span>
                  {/* the phase breathes as a soft underline */}
                  {tint && <span aria-hidden className="absolute inset-x-2 bottom-1 h-[2.5px] rounded-full" style={{ background: tint, opacity: on ? 0.9 : 0.55 }} />}
                  {isToday && !on && <span className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-stone-900" />}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* The docket — the chosen day in full */}
      <div className="mx-auto mt-7 max-w-2xl">
        <div className="mb-5 text-center">
          <h3 className="font-serif italic text-2xl text-stone-900">{sel.k === todayK ? 'Today' : `${MONTHS[selD.getMonth()]} ${selD.getDate()}`}</h3>
          {(() => { const ph = phaseForConfig(phaseCfg, selD); return ph ? <p className="kicker mt-1 text-stone-400">{ph.label} phase</p> : null })()}
        </div>

        {sel.items.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-stone-300">Nothing scheduled — tap + to add.</p>
        ) : (
          <div className="space-y-0.5">
            {[...sel.items]
              .sort((a, b) => (a.details?.time || '99:99').localeCompare(b.details?.time || '99:99'))
              .map((a) => (
                <button key={a.id} onClick={() => setEditing({ dayKey: sel.k, activity: a })} className="group flex w-full items-baseline gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/60">
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-stone-400">{fmtSpan(a.details?.time, a.details?.endTime) || '—'}</span>
                  <span className="flex-1 font-serif text-lg leading-tight text-stone-800">{a.title || noun}</span>
                  {(a.frequency === 'asneeded' || a.frequency === 'once') && <span className="kicker text-stone-300">once</span>}
                </button>
              ))}
          </div>
        )}

        {/* Ahead — the next dated moments in this pillar */}
        {ahead.length > 0 && (
          <div className="mt-10">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="kicker text-stone-400">Ahead</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>
            <div className="space-y-0.5">
              {ahead.map(({ a, k }) => {
                const d = parseKey(k)
                return (
                  <button key={`${a.id}:${k}`} onClick={() => setSelKey(k)} className="flex w-full items-baseline gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/60">
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-stone-400">{MONTHS_SHORT[d.getMonth()]} {d.getDate()}</span>
                    <span className="flex-1 text-sm text-stone-700">{a.title || noun}</span>
                    {fmtTime(a.details?.time) && <span className="text-xs tabular-nums text-stone-400">{fmtSpan(a.details?.time, a.details?.endTime)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <DayItemForm
          entry={editing}
          noun={noun}
          category={category}
          isNew={!activities.some((x) => x.id === editing.activity.id)}
          onSave={save}
          onDelete={() => { remove(editing.activity.id); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
