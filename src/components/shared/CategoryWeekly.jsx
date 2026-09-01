import React, { useState } from 'react'
import { CalendarDays, AlignLeft } from 'lucide-react'
import { CloseIcon, NextIcon, PrevIcon } from './marks'
import { useActivities } from '../../hooks/useActivities'
import { blankActivity } from '../../lib/activities'
import { dateKey, parseKey, addDays, DOW_LONG, MONTHS_SHORT, isSameDay } from '../../lib/date'
import { useRegisterAdd } from './AddButton'
import { DayItemForm, partOf, occursOnCal } from './CategoryCalendar'

const PART_ORDER = { morning: 0, afternoon: 1, evening: 2 }
const PART_LABEL = { morning: 'Morning', afternoon: 'Midday', evening: 'Evening' }
const timeOf = (a) => (a.details && a.details.time) || '99:99'
const byPartThenTime = (a, b) => (PART_ORDER[partOf(a)] - PART_ORDER[partOf(b)]) || timeOf(a).localeCompare(timeOf(b))
// "14:30" → "2:30 PM"
const fmtTime = (t) => {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${ap}`
}

// A Monday–Sunday weekly agenda for one category. Each day is a clean row: the
// date on the left, the day's items on the right as airy hairline lines (a small
// time-of-day dot, a serif title, readable notes) — no boxes. Recurring items
// land on their matching weekdays; the same rich editor opens on tap.
export default function CategoryWeekly({ category, noun = 'Item' }) {
  const { activities, add, update, remove } = useActivities()
  const today = new Date()
  const todayKey = dateKey(today)
  const [editing, setEditing] = useState(null)
  const [anchorKey, setAnchorKey] = useState(todayKey)

  const anchor = parseKey(anchorKey)
  const monday = addDays(anchor, -((anchor.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = days[6]
  const shiftWeek = (n) => setAnchorKey(dateKey(addDays(anchor, n * 7)))
  const weekLabel = `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`

  const items = activities.filter((a) => a.type === 'protocol' && a.category === category && a.status !== 'archived')
  const forDay = (k) => items.filter((a) => occursOnCal(a, k)).sort(byPartThenTime)

  const openNew = (k) => setEditing({ dayKey: k, activity: blankActivity('protocol', { category, frequency: 'weekly', daysOfWeek: [parseKey(k).getDay()], timeOfDay: ['morning'], seriesStart: k }) })
  const openEdit = (a) => setEditing({ dayKey: a.seriesStart || todayKey, activity: a })
  const save = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }
  useRegisterAdd(() => openNew(todayKey), [todayKey])

  return (
    <div className="mb-14">
      {/* Week rail */}
      <div className="mb-8 flex items-center justify-center gap-5">
        <button onClick={() => shiftWeek(-1)} title="Previous week" className="text-stone-300 transition-colors hover:text-stone-900"><PrevIcon size={20} /></button>
        <div className="flex items-center gap-2">
          <span className="font-serif text-xl text-stone-900">{weekLabel}</span>
          <label className="relative inline-flex cursor-pointer items-center text-stone-300 hover:text-stone-700">
            <CalendarDays size={15} />
            <input type="date" value={anchorKey} onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()} onChange={(e) => e.target.value && setAnchorKey(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
        </div>
        <button onClick={() => shiftWeek(1)} title="Next week" className="text-stone-300 transition-colors hover:text-stone-900"><NextIcon size={20} /></button>
      </div>

      <div className="divide-y divide-stone-200 border-t border-stone-200">
        {days.map((d) => {
          const k = dateKey(d)
          const dayItems = forDay(k)
          const isTod = isSameDay(d, today)
          return (
            <div key={k} className="grid grid-cols-1 gap-1.5 py-5 sm:grid-cols-[128px_1fr] sm:gap-8">
              {/* Date */}
              <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-1">
                <span className={`font-serif text-xl ${isTod ? 'text-stone-900' : 'text-stone-800'}`}>{DOW_LONG[d.getDay()]}</span>
                <span className={`kicker ${isTod ? 'text-stone-900' : 'text-stone-400'}`}>{MONTHS_SHORT[d.getMonth()]} {d.getDate()}{isTod ? ' · Today' : ''}</span>
              </div>

              {/* Items */}
              <div>
                {dayItems.length === 0 ? (
                  <p className="pt-1 text-sm italic text-stone-300">Open</p>
                ) : (
                  dayItems.map((a) => {
                    const t = fmtTime(a.details && a.details.time)
                    return (
                      <div key={a.id} className={`group flex items-start gap-3 border-b border-stone-100 py-2.5 last:border-0 ${a.status === 'paused' ? 'opacity-55' : ''}`}>
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" title={PART_LABEL[partOf(a)]} />
                        <button onClick={() => openEdit(a)} className="min-w-0 flex-1 text-left">
                          <p className="font-serif text-base leading-snug text-stone-900">
                            {t && <span className="mr-2 text-sm text-stone-400 tabular-nums">{t}</span>}
                            {a.title || noun}
                            {a.notes && a.notes.trim() && <AlignLeft size={11} className="ml-2 inline-block align-middle text-stone-300" aria-label="Has notes" />}
                            {a.status === 'paused' && <span className="ml-2 align-middle text-[9px] uppercase tracking-[0.14em] text-stone-400">paused</span>}
                          </p>
                        </button>
                        {a.status === 'paused' && <button onClick={() => update(a.id, { status: 'active' })} title="Resume — bring back to Today" className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-stone-400 hover:text-stone-900">resume</button>}
                        <button onClick={() => remove(a.id)} title="Remove" className="hover-reveal shrink-0 text-stone-300 hover:text-stone-700"><CloseIcon size={15} /></button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
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
