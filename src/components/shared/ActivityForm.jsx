import React, { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import {
  FREQUENCIES, PARTS, ACTIVITY_CATEGORIES, PHASE_OPTS, WEEKDAYS, NO_DAYS_FREQ, blankActivity,
} from '../../lib/activities'
import { MEAL_SLOTS } from '../../lib/meals'
import { PHASES } from '../../lib/cycle'

const STATUS = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
]
const labelCls = 'kicker text-stone-400 mb-2 block'
const lineCls = 'w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900'

// Unified create/edit form for every activity type.
export default function ActivityForm({ activity, isNew, allowedCategories, onSave, onDelete, onClose }) {
  const categoryOpts = Array.isArray(allowedCategories) && allowedCategories.length
    ? ACTIVITY_CATEGORIES.filter((c) => allowedCategories.includes(c.id))
    : ACTIVITY_CATEGORIES
  const [draft, setDraft] = useState(() => ({
    ...blankActivity(activity.type),
    ...activity,
    phase: [...(activity.phase || [])],
    timeOfDay: [...(activity.timeOfDay || [])],
    daysOfWeek: [...(activity.daysOfWeek || [])],
    details: { ...activity.details },
  }))
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const setD = (k, v) => setDraft((d) => ({ ...d, details: { ...d.details, [k]: v } }))
  const toggleArr = (k, v) => setDraft((d) => ({ ...d, [k]: (d[k] || []).includes(v) ? d[k].filter((x) => x !== v) : [...(d[k] || []), v] }))
  const toggleDay = (n) => setDraft((d) => ({ ...d, daysOfWeek: (d.daysOfWeek || []).includes(n) ? d.daysOfWeek.filter((x) => x !== n) : [...(d.daysOfWeek || []), n] }))
  const setWeekdays = () => setDraft((d) => ({ ...d, daysOfWeek: [1, 2, 3, 4, 5] }))

  const t = draft.type
  const TYPE_LABEL = { event: 'Event', meal_item: 'Meal item', supplement: 'Supplement', protocol: 'Protocol' }[t]
  const showDays = !NO_DAYS_FREQ.includes(draft.frequency)

  const Chips = ({ value, options, onToggle, colored }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = (value || []).includes(o.id)
        const color = colored ? PHASES[o.id]?.color : null
        return (
          <button key={o.id} type="button" onClick={() => onToggle(o.id)} className="flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors"
            style={on ? (color ? { backgroundColor: color, color: PHASES[o.id].ink, borderColor: color } : { backgroundColor: '#1c1917', color: '#FAFAF7', borderColor: '#1c1917' }) : { borderColor: '#d6d3d1', color: '#57534e' }}>
            {color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )

  const Scheduling = (
    <>
      <div>
        <span className={labelCls}>Frequency</span>
        <select value={draft.frequency} onChange={(e) => set('frequency', e.target.value)} className={lineCls}>
          {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>
      {showDays && (
        <div>
          <span className={labelCls}>Days of Week</span>
          <div className="mb-2"><button type="button" onClick={setWeekdays} className="text-[11px] uppercase tracking-[0.16em] text-stone-400 hover:text-stone-900">Weekdays (Mon–Fri)</button></div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => {
              const on = (draft.daysOfWeek || []).includes(w.d)
              return <button key={w.d} type="button" onClick={() => toggleDay(w.d)} className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{w.label}</button>
            })}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div>
          <span className={labelCls}>Series start</span>
          <input type="date" value={draft.seriesStart || ''} onChange={(e) => set('seriesStart', e.target.value)} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
        <div>
          <span className={labelCls}>Series end</span>
          <input type="date" value={draft.seriesEnd || ''} onChange={(e) => set('seriesEnd', e.target.value)} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
      </div>
    </>
  )

  const TimeOfDay = (
    <div>
      <span className={labelCls}>Time of Day</span>
      <Chips value={draft.timeOfDay} options={PARTS} onToggle={(v) => toggleArr('timeOfDay', v)} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xl bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <div className="flex-1">
            <span className="kicker text-stone-400">{TYPE_LABEL}</span>
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder={`${TYPE_LABEL} name`} autoFocus className="mt-1 w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none" />
          </div>
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-6 py-5 space-y-6">
          {t === 'event' && (
            <>
              <div>
                <span className={labelCls}>Part of Day</span>
                <div className="flex flex-wrap gap-1.5">
                  {PARTS.map((o) => {
                    const on = (draft.details.partOfDay || 'morning') === o.id
                    return <button key={o.id} type="button" onClick={() => setD('partOfDay', o.id)} className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{o.label}</button>
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                <div><span className={labelCls}>Time</span><input type="time" value={draft.details.time || ''} onChange={(e) => setD('time', e.target.value)} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></div>
                <div><span className={labelCls}>Duration (min)</span><input type="number" value={draft.details.durationMinutes || ''} onChange={(e) => setD('durationMinutes', e.target.value)} className="w-20 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></div>
              </div>
              {Scheduling}
              <div><span className={labelCls}>Description</span><textarea value={draft.details.description || ''} onChange={(e) => setD('description', e.target.value)} className="w-full min-h-[80px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" /></div>
              <div><span className={labelCls}>Attendees</span><input value={draft.details.attendees || ''} onChange={(e) => setD('attendees', e.target.value)} placeholder="Comma separated" className={lineCls} /></div>
            </>
          )}

          {t === 'meal_item' && (
            <>
              <div><span className={labelCls}>Slot</span>
                <select value={draft.details.slot || 'breakfast'} onChange={(e) => setD('slot', e.target.value)} className={lineCls}>
                  {MEAL_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={!!draft.details.beverage} onChange={(e) => setD('beverage', e.target.checked)} /> Beverage</label>
              {Scheduling}
            </>
          )}

          {t === 'supplement' && (
            <>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                <div className="w-28"><span className={labelCls}>Dose</span><input value={draft.details.dose || ''} onChange={(e) => setD('dose', e.target.value)} className={lineCls} /></div>
                <div className="w-28"><span className={labelCls}>Unit</span>
                  <select value={draft.details.unit || 'mg'} onChange={(e) => setD('unit', e.target.value)} className={lineCls}>
                    {['mg', 'mcg', 'g', 'ml', 'IU'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {TimeOfDay}
              {Scheduling}
              <div><span className={labelCls}>Cycle length</span><input value={draft.details.cycleLength || ''} onChange={(e) => setD('cycleLength', e.target.value)} placeholder="e.g. 8 weeks on, 4 off" className={lineCls} /></div>
              <div><span className={labelCls}>Stack notes</span><textarea value={draft.details.stackNotes || ''} onChange={(e) => setD('stackNotes', e.target.value)} className="w-full min-h-[70px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" /></div>
              <div><span className={labelCls}>Provider</span><input value={draft.details.provider || ''} onChange={(e) => setD('provider', e.target.value)} className={lineCls} /></div>
            </>
          )}

          {t === 'protocol' && (
            <>
              <div><span className={labelCls}>Category</span>
                <select value={draft.category || 'nutrition'} onChange={(e) => set('category', e.target.value)} className={lineCls}>
                  {categoryOpts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div><span className={labelCls}>Phase</span><Chips value={draft.phase} options={PHASE_OPTS} onToggle={(v) => toggleArr('phase', v)} colored /></div>
              {TimeOfDay}
              {Scheduling}
              <div><span className={labelCls}>Status</span>
                <select value={draft.status} onChange={(e) => set('status', e.target.value)} className={lineCls}>
                  {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <p className="text-xs text-stone-400">Category-specific fields can be edited on the Protocols page.</p>
            </>
          )}

          {(t === 'event' || t === 'supplement' || t === 'protocol' || t === 'meal_item') && (
            <div><span className={labelCls}>Notes</span><textarea value={draft.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full min-h-[70px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" /></div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? <span /> : (
            <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-phase-menstrual"><Trash2 size={15} /> Delete</button>
          )}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button onClick={() => onSave({ ...draft, title: (draft.title || '').trim() || `Untitled ${TYPE_LABEL.toLowerCase()}` })} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
