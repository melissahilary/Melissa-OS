import React, { useState } from 'react'
import { X } from 'lucide-react'
import { MEAL_SLOTS, slotMeta, MEAL_FREQ_OPTS, WEEKDAYS, mealOccursOn, blankMeal } from '../../lib/meals'

// Editable meal slots, shared by My Dream Day and Meal Planning Schedule.
// `slotIds` chooses which slots to render (Dream Day passes one part's slots;
// Meal Planning passes all). Adding writes a recurring meal item that then shows
// on every matching day automatically.
export default function MealSlots({ slotIds, dateKeyStr, meals, onAdd, onRemove, compact }) {
  const ids = slotIds || MEAL_SLOTS.map((s) => s.id)
  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      {ids.map((id) => {
        const slot = slotMeta(id)
        return (
          <div key={id}>
            <SlotList slot={slot} kind="food" label={slot.label} placeholder="add food" dateKeyStr={dateKeyStr} meals={meals} onAdd={onAdd} onRemove={onRemove} />
            {slot.supps && (
              <div className="mt-2 pl-3">
                <SlotList slot={slot} kind="supp" label="Supplements" placeholder="add supplement" sub dateKeyStr={dateKeyStr} meals={meals} onAdd={onAdd} onRemove={onRemove} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SlotList({ slot, kind, label, placeholder, sub, dateKeyStr, meals, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false)
  const items = (meals || []).filter((m) => m.slot === slot.id && m.kind === kind && mealOccursOn(m, dateKeyStr))
  return (
    <div>
      <p className={`kicker mb-1.5 ${sub ? 'text-stone-300' : 'text-stone-400'}`}>{label}</p>
      {items.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {items.map((m) => (
            <span key={m.id} className="group inline-flex items-center gap-1 border border-stone-300 bg-white/50 px-2 py-0.5 text-xs text-stone-700">
              {m.name}
              <button onClick={() => onRemove(m.id)} className="text-stone-300 transition-colors hover:text-stone-700">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {adding ? (
        <AddMealForm slot={slot} kind={kind} dateKeyStr={dateKeyStr} onCancel={() => setAdding(false)} onSave={(item) => { onAdd(item); setAdding(false) }} />
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm italic text-stone-300 hover:text-stone-600 transition-colors">
          {placeholder}
        </button>
      )}
    </div>
  )
}

// Inline form: name + frequency (+ days when not Daily). Used everywhere a meal
// item is added so the slot/frequency model is identical across the app.
export function AddMealForm({ slot, kind, dateKeyStr, onCancel, onSave, showSlot }) {
  const [draft, setDraft] = useState(() => ({ ...blankMeal(slot ? slot.id : 'breakfast', kind), startDate: dateKeyStr || '' }))
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const toggleDay = (n) => setDraft((d) => ({ ...d, days: d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n] }))
  const showDays = draft.frequency !== 'daily'
  const lineCls = 'bg-transparent border-b border-stone-300 pb-0.5 text-sm outline-none focus:border-stone-900'

  return (
    <div className="border border-stone-200 bg-white/40 p-2.5 space-y-2">
      <input
        autoFocus
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && draft.name.trim()) onSave({ ...draft, name: draft.name.trim() }) }}
        placeholder={kind === 'supp' ? 'Supplement name' : 'Meal item name'}
        className={`${lineCls} w-full`}
      />
      <div className="flex flex-wrap items-center gap-2">
        {showSlot && (
          <select value={draft.slot} onChange={(e) => set('slot', e.target.value)} className={lineCls}>
            {MEAL_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
        <select value={draft.frequency} onChange={(e) => set('frequency', e.target.value)} className={lineCls}>
          {MEAL_FREQ_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      {showDays && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((w) => {
            const on = draft.days.includes(w.d)
            return (
              <button key={w.d} type="button" onClick={() => toggleDay(w.d)} className={`px-2 py-0.5 text-[11px] border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{w.label}</button>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-3 pt-0.5">
        <button onClick={onCancel} className="text-xs text-stone-500 hover:text-stone-900">Cancel</button>
        <button onClick={() => draft.name.trim() && onSave({ ...draft, name: draft.name.trim() })} className="bg-stone-900 px-3 py-1 text-xs text-cream hover:bg-stone-700">Save</button>
      </div>
    </div>
  )
}
