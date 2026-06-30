import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import { parseKey, dateKey } from '../lib/date'
import { useRegisterAdd } from './shared/AddButton'

const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday-first
const PARTS = [{ id: 'morning', label: 'Morning' }, { id: 'afternoon', label: 'Afternoon' }, { id: 'evening', label: 'Evening' }]
const PART_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }

const firstLine = (t) => (t || '').split('\n').map((s) => s.trim()).find(Boolean) || 'Workout'
const isRecurring = (a) => a.frequency !== 'asneeded' && a.frequency !== 'once'
// The date of the given weekday within the current week.
const thisWeekDate = (weekday) => { const d = new Date(); d.setDate(d.getDate() + (weekday - d.getDay())); return dateKey(d) }

export default function Fitness() {
  return <Workouts />
}

// ── Workouts — a Monday–Sunday weekly schedule, each workout an Agenda event ──
function Workouts() {
  const { activities, add, update, remove } = useActivities()
  const [editing, setEditing] = useState(null) // { weekday, activity }

  const workouts = activities.filter((a) => a.type === 'event' && a.category === 'fitness' && a.status !== 'archived')
  const forDay = (wd) => workouts.filter((a) => (isRecurring(a) ? (a.daysOfWeek || []).includes(wd) : a.seriesStart && parseKey(a.seriesStart).getDay() === wd))

  const openNew = (wd) => setEditing({ weekday: wd, activity: blankActivity('event', { category: 'fitness', frequency: 'weekly', daysOfWeek: [wd], details: { partOfDay: 'morning', description: '' } }) })
  const openEdit = (a) => setEditing({ weekday: (a.daysOfWeek || [])[0] != null ? a.daysOfWeek[0] : (a.seriesStart ? parseKey(a.seriesStart).getDay() : 1), activity: a })
  const save = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  useRegisterAdd(() => openNew(new Date().getDay()), [])

  return (
    <div className="mb-10 space-y-6">
      {WEEK.map((wd) => {
        const items = forDay(wd)
        return (
          <section key={wd} className="border-t border-stone-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif italic text-2xl text-stone-900">{DOW_LONG[wd]}</h3>
              <button onClick={() => openNew(wd)} className="text-sm text-stone-500 hover:text-stone-900">Add workout</button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm italic text-stone-400">Rest day.</p>
            ) : (
              <div className="space-y-2">
                {items.map((a) => (
                  <div key={a.id} className="group flex items-start gap-3 border border-stone-200 bg-white/40 px-4 py-3">
                    <button onClick={() => openEdit(a)} className="min-w-0 flex-1 text-left">
                      <p className="font-serif text-lg text-stone-900">{a.title || 'Workout'}</p>
                      {a.details.description && a.details.description.trim() && (
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-500">{a.details.description}</p>
                      )}
                      <p className="kicker text-stone-400 mt-2">{PART_LABEL[a.details.partOfDay || 'morning']}{isRecurring(a) ? ' · Weekly' : ' · One-time'}</p>
                    </button>
                    <button onClick={() => remove(a.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {editing && (
        <WorkoutForm
          entry={editing}
          isNew={!activities.some((x) => x.id === editing.activity.id)}
          onSave={save}
          onDelete={() => { remove(editing.activity.id); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function WorkoutForm({ entry, isNew, onSave, onDelete, onClose }) {
  const { weekday } = entry
  const [name, setName] = useState(entry.activity.title || '')
  const [text, setText] = useState(entry.activity.details.description || '')
  const [part, setPart] = useState(entry.activity.details.partOfDay || 'morning')
  const [weekly, setWeekly] = useState(isRecurring(entry.activity))

  const submit = () => {
    const nm = name.trim() || firstLine(text)
    if (!nm) return
    onSave({
      ...entry.activity,
      title: nm,
      category: 'fitness',
      frequency: weekly ? 'weekly' : 'asneeded',
      daysOfWeek: weekly ? [weekday] : [],
      seriesStart: weekly ? '' : thisWeekDate(weekday),
      details: { ...entry.activity.details, partOfDay: part, description: text.trim() },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
          <span className="kicker text-stone-400">{DOW_LONG[weekday]} workout</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <span className="kicker text-stone-400 mb-1.5 block">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lower Power"
              className="w-full bg-transparent border-b border-stone-300 pb-1.5 font-serif text-2xl text-stone-900 placeholder-stone-300 outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <span className="kicker text-stone-400 mb-1.5 block">Workout</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Squats: 4x5-8 (heavy), 2-3 min rest\nDeadlifts: 4x5 (heavy), 3 min rest\nHip thrusts: 4x8 (heavy), 90 sec rest'}
              className="w-full min-h-[180px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <span className="kicker text-stone-400 mb-2 block">Time of day</span>
            <div className="flex gap-1.5">
              {PARTS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPart(p.id)} className={`px-2.5 py-1 text-xs border transition-colors ${part === p.id ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{p.label}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Repeat every {DOW_LONG[weekday]}
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? <span /> : <button onClick={onDelete} className="text-sm text-stone-400 hover:text-phase-menstrual">Delete</button>}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button onClick={submit} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
