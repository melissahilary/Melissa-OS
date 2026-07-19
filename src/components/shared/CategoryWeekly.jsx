import React, { useState } from 'react'
import { X, Calendar } from 'lucide-react'
import { useActivities } from '../../hooks/useActivities'
import { blankActivity } from '../../lib/activities'
import { dateKey, parseKey, addDays, DOW_LONG, MONTHS, MONTHS_SHORT, isSameDay } from '../../lib/date'
import { useRegisterAdd } from './AddButton'
import { DayItemForm, PARTS, partOf, occursOnCal } from './CategoryCalendar'

// A Monday–Sunday weekly schedule for one category. Every item uses the same rich
// recurrence editor as the Monthly view (Daily / Weekdays / … / Custom), and there
// is a single global Add button. Recurring items land on their matching weekdays.
export default function CategoryWeekly({ category, noun = 'Item' }) {
  const { activities, add, update, remove } = useActivities()
  const today = new Date()
  const todayKey = dateKey(today)
  const [editing, setEditing] = useState(null)
  const [anchorKey, setAnchorKey] = useState(todayKey)

  // Monday of the viewed week → the seven day dates.
  const anchor = parseKey(anchorKey)
  const monday = addDays(anchor, -((anchor.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = days[6]
  const shiftWeek = (n) => setAnchorKey(dateKey(addDays(anchor, n * 7)))
  const fullDay = (d) => `${DOW_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  const weekLabel = `${fullDay(monday)} - ${fullDay(sunday)}`

  const items = activities.filter((a) => a.type === 'protocol' && a.category === category && a.status !== 'archived')
  const forDay = (k) => items.filter((a) => occursOnCal(a, k))

  const openNew = (k) => setEditing({ dayKey: k, activity: blankActivity('protocol', { category, frequency: 'weekly', daysOfWeek: [parseKey(k).getDay()], timeOfDay: ['morning'], seriesStart: k }) })
  const openEdit = (a) => setEditing({ dayKey: a.seriesStart || todayKey, activity: a })
  const save = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }
  useRegisterAdd(() => openNew(todayKey), [todayKey])

  return (
    <div className="mb-10">
      {/* Week navigation — prev · range + jump-to-date · next */}
      <div className="mb-6 flex items-center justify-between gap-2">
        <button onClick={() => shiftWeek(-1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">‹</button>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="font-serif text-lg text-stone-900">{weekLabel}</span>
          <label className="relative inline-flex cursor-pointer items-center text-stone-400 hover:text-stone-900">
            <Calendar size={16} />
            <input type="date" value={anchorKey} onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()} onChange={(e) => e.target.value && setAnchorKey(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
        </div>
        <button onClick={() => shiftWeek(1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">›</button>
      </div>

      <div className="space-y-6">
      {days.map((d) => {
        const k = dateKey(d)
        const dayItems = forDay(k)
        const isTod = isSameDay(d, today)
        return (
          <section key={k} className="border-t border-stone-200 pt-4">
            <h3 className={`font-serif italic text-2xl mb-3 ${isTod ? 'text-stone-900' : 'text-stone-800'}`}>
              {DOW_LONG[d.getDay()]}
              <span className="ml-2 text-base not-italic text-stone-400">{MONTHS_SHORT[d.getMonth()]} {d.getDate()}</span>
            </h3>
            {dayItems.length === 0 ? (
              <p className="text-sm italic text-stone-400">Nothing scheduled.</p>
            ) : (
              <div className="space-y-5">
                {PARTS.map((pt) => {
                  const list = dayItems.filter((a) => partOf(a) === pt.id)
                  if (!list.length) return null
                  return (
                    <div key={pt.id}>
                      <p className="kicker text-stone-400 mb-2">{pt.label}</p>
                      <div className="space-y-2">
                        {list.map((a) => (
                          <div key={a.id} className="group flex items-start gap-3 border border-stone-200 bg-white/40 px-4 py-2.5">
                            <button onClick={() => openEdit(a)} className="min-w-0 flex-1 text-left">
                              <p className="text-sm text-stone-800">{a.title || noun}</p>
                              {a.notes && a.notes.trim() && <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-stone-500">{a.notes}</p>}
                            </button>
                            <button onClick={() => remove(a.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={15} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
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
