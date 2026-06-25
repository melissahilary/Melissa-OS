import React, { useState } from 'react'
import { X, Pencil } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseFor, PHASE_FOODS } from '../lib/cycle'
import { dateKey } from '../lib/date'
import { categorize, GROCERY_CATEGORIES } from '../lib/groceryCategories'
import NotesPopup, { hasNotes } from './shared/NotesPopup'
import InlineText from './shared/InlineText'
import { DayNav, DayHeader } from './shared/DayNav'
import MealSlots, { AddMealForm } from './shared/MealSlots'
import { MEAL_SLOTS } from '../lib/meals'
import { useRegisterAdd } from './shared/AddButton'

const uid = () => Math.random().toString(36).slice(2, 10)

// Kept for compatibility with any older imports.
export const SLOTS = MEAL_SLOTS

export default function MealPlanning({ cycleConfig = {}, subPage = 'planner' }) {
  return (
    <div>
      {subPage === 'grocery' ? <GroceryList /> : <MealSchedule cycleConfig={cycleConfig} />}
    </div>
  )
}

// ── Schedule — editable meal slots backed by the unified meal store ──
function MealSchedule({ cycleConfig }) {
  const today = new Date()
  const [selected, setSelected] = useState(new Date())
  const key = dateKey(selected)
  const [meals, setMeals] = useLocalStorage('mos:meals', [])
  const [adding, setAdding] = useState(false)

  const addMeal = (item) => setMeals((prev) => [...(Array.isArray(prev) ? prev : []), item])
  const removeMeal = (id) => setMeals((prev) => (Array.isArray(prev) ? prev : []).filter((m) => m.id !== id))

  useRegisterAdd(() => setAdding(true), [])

  const phase = phaseFor(selected, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)

  return (
    <div>
      <DayNav selected={selected} setSelected={setSelected} today={today} />
      <DayHeader date={selected} phase={phase} />
      <PhaseNote phase={phase} hasPeriod={!!cycleConfig.lastPeriodStart} />

      <div className="border-t border-stone-200 pt-7">
        <MealSlots slotIds={MEAL_SLOTS.map((s) => s.id)} dateKeyStr={key} meals={meals} onAdd={addMeal} onRemove={removeMeal} />
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setAdding(false) }}>
          <div className="w-full max-w-md bg-cream border border-stone-300 p-6 shadow-2xl">
            <p className="font-serif italic text-2xl text-stone-900 mb-4">New meal item</p>
            <AddMealForm kind="food" dateKeyStr={key} showSlot onCancel={() => setAdding(false)} onSave={(item) => { addMeal(item); setAdding(false) }} />
          </div>
        </div>
      )}
    </div>
  )
}

// The day's cycle-phase nutrition guidance, kept calm and to the side.
function PhaseNote({ phase, hasPeriod }) {
  if (!hasPeriod) {
    return <p className="mb-12 text-sm text-stone-400">Set your last period on the Cycle page to see phase guidance here.</p>
  }
  if (!phase) return null
  return (
    <div className="mb-12 border-l-2 pl-4" style={{ borderColor: phase.color }}>
      <p className="kicker mb-1.5" style={{ color: phase.color }}>Prioritize this phase · {phase.range}</p>
      <p className="text-sm leading-relaxed text-stone-500">{PHASE_FOODS[phase.id].join(', ')}.</p>
    </div>
  )
}

// Muted status tones: a soft full-row tint + a stronger left border.
const STATUS_BORDER = { 'need to buy': '#C4959A', 'running low': '#C4A882', 'in stock': '#8A9E8A' }
const STATUS_BG = { 'need to buy': '#F9EDEE', 'running low': '#FAF5EE', 'in stock': '#EFF4EF' }
const FRIDGE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'in stock', label: 'In Stock' },
  { id: 'running low', label: 'Running Low' },
  { id: 'need to buy', label: 'Need to Buy' },
]

// ── What's In My Fridge ──
function GroceryList() {
  const [items, setItems] = useLocalStorage('mos:menu:groceries', [])
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [popup, setPopup] = useState(null)

  useRegisterAdd(() => setAdding(true), [])

  const visible = filter === 'all' ? items : items.filter((i) => i.status === filter)

  const add = (draft) => {
    if (!draft.name.trim()) return
    setItems((prev) => [
      ...prev,
      { id: uid(), name: draft.name.trim(), status: draft.status, qty: draft.qty.trim(), store: draft.store.trim(), category: categorize(draft.name), done: false, notes: {} },
    ])
    setAdding(false)
  }
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))
  const update = (id, patch) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  return (
    <section className="mb-10">
      <header className="mb-4 flex items-center justify-end">
        <span className="text-sm text-stone-400">{items.length} on the list</span>
      </header>

      {/* Status filter — plain tracked-caps text, soft underline when active */}
      <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-stone-100 py-3">
        {FRIDGE_FILTERS.map((f) => {
          const on = filter === f.id
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${on ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-700'}`} style={on ? { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: '#a8a29e' } : undefined}>
              {f.label}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">{items.length === 0 ? 'Fridge is good. List is empty.' : 'Nothing matches that filter.'}</p>
      ) : (
        <div className="space-y-6">
          {GROCERY_CATEGORIES.map((cat) => {
            const list = visible.filter((i) => categorize(i.name) === cat)
            if (!list.length) return null
            return (
              <div key={cat}>
                <h3 className="kicker text-stone-400 mb-2 border-b border-stone-100 pb-1.5">{cat}</h3>
                <div className="divide-y divide-stone-100">
                  {list.map((item) => (
                    <div key={item.id} className="group flex items-center gap-3 py-2.5 pl-3" style={{ borderLeft: `3px solid ${STATUS_BORDER[item.status] || 'transparent'}`, backgroundColor: STATUS_BG[item.status] || 'transparent' }}>
                      <div className="flex flex-1 items-center gap-1.5">
                        <button onClick={() => setPopup({ variant: 'grocery', itemName: item.name, initial: item.notes, onSave: (notes) => { update(item.id, { notes }); setPopup(null) } })} className={`shrink-0 ${hasNotes(item.notes) ? 'text-stone-500' : 'text-stone-300 opacity-0 group-hover:opacity-100'}`} title="Notes">
                          <Pencil size={11} />
                        </button>
                        <InlineText value={item.name} onChange={(name) => update(item.id, { name })} className="text-sm text-stone-800 bg-transparent outline-none" />
                      </div>
                      <select value={item.status || ''} onChange={(e) => update(item.id, { status: e.target.value })} className="bg-transparent text-xs text-stone-500 outline-none">
                        <option value="">status</option>
                        <option value="need to buy">need to buy</option>
                        <option value="running low">running low</option>
                        <option value="in stock">in stock</option>
                      </select>
                      {item.qty && <span className="text-sm text-stone-500 tabular-nums">{item.qty}</span>}
                      {item.store && <span className="kicker text-stone-400">{item.store}</span>}
                      <button onClick={() => remove(item.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {adding && <GroceryAddModal onClose={() => setAdding(false)} onSave={add} />}
      {popup && (
        <NotesPopup open variant={popup.variant} itemName={popup.itemName} initial={popup.initial} onClose={() => setPopup(null)} onSave={popup.onSave} />
      )}
    </section>
  )
}

function GroceryAddModal({ onClose, onSave }) {
  const [draft, setDraft] = useState({ name: '', status: '', qty: '', store: '' })
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-cream border border-stone-300 p-6 shadow-2xl">
        <p className="font-serif italic text-2xl text-stone-900 mb-4">Add item</p>
        <div className="space-y-4">
          <input autoFocus value={draft.name} onChange={(e) => set('name', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSave(draft)} placeholder="Item" className="w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
          <div className="flex flex-wrap gap-4">
            <select value={draft.status} onChange={(e) => set('status', e.target.value)} className="border-b border-stone-300 bg-transparent pb-1 text-sm text-stone-600 outline-none">
              <option value="">status</option>
              <option value="need to buy">need to buy</option>
              <option value="running low">running low</option>
              <option value="in stock">in stock</option>
            </select>
            <input value={draft.qty} onChange={(e) => set('qty', e.target.value)} placeholder="Qty" className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
            <input value={draft.store} onChange={(e) => set('store', e.target.value)} placeholder="Store" className="w-28 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
          <button onClick={() => onSave(draft)} className="bg-stone-900 px-5 py-2 text-sm text-cream hover:bg-stone-700">Save</button>
        </div>
      </div>
    </div>
  )
}
