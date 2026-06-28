import React, { useState } from 'react'
import { X, Pencil } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PHASES } from '../lib/cycle'
import { categorize, GROCERY_CATEGORIES } from '../lib/groceryCategories'
import NotesPopup, { hasNotes } from './shared/NotesPopup'
import InlineText from './shared/InlineText'
import { AddMealForm } from './shared/MealSlots'
import { MEAL_SLOTS, slotMeta } from '../lib/meals'
import { useRegisterAdd } from './shared/AddButton'
import { useActivities } from '../hooks/useActivities'
import { blankActivity, FREQUENCIES } from '../lib/activities'
import ActivityForm from './shared/ActivityForm'

const uid = () => Math.random().toString(36).slice(2, 10)

// Kept for compatibility with any older imports.
export const SLOTS = MEAL_SLOTS

const FREQ_LABEL = Object.fromEntries(FREQUENCIES.map((f) => [f.id, f.label]))
const isRecurring = (a) => a.frequency !== 'asneeded' && a.frequency !== 'once'

// Layer 1 — the daily protocol, slot by slot (supplements grouped by part).
const DIET_ROWS = [
  { kind: 'food', slot: 'empty', label: 'Empty Stomach' },
  { kind: 'food', slot: 'breakfast', label: 'Breakfast' },
  { kind: 'supp', part: 'morning', slot: 'breakfast', label: 'Supplements' },
  { kind: 'food', slot: 'snack', label: 'Snack' },
  { kind: 'food', slot: 'lunch', label: 'Lunch' },
  { kind: 'supp', part: 'afternoon', slot: 'lunch', label: 'Supplements' },
  { kind: 'food', slot: 'snack', label: 'Snack' },
  { kind: 'food', slot: 'dinner', label: 'Dinner' },
  { kind: 'supp', part: 'evening', slot: 'dinner', label: 'Supplements' },
  { kind: 'food', slot: 'bed', label: 'Before Bed' },
  { kind: 'food', slot: 'drink', label: 'Drink' },
]

const SLOT_FILTERS = ['empty', 'breakfast', 'snack', 'lunch', 'dinner', 'bed', 'drink']
const PHASE_FILTERS = [
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
  { id: 'menstrual', label: 'Menstrual' },
]

export default function MealPlanning({ cycleConfig = {}, subPage = 'diet' }) {
  return (
    <div>
      {subPage === 'grocery' ? <GroceryList /> : <Diet />}
    </div>
  )
}

// ── Diet — Layer 1 (daily protocol) + Layer 2 (recipe library) ──
function Diet() {
  const { activities, add, update, remove } = useActivities()
  const [editing, setEditing] = useState(null)

  const newRecipe = () => blankActivity('meal_item', { details: { slot: 'breakfast', beverage: false } })
  useRegisterAdd(() => setEditing(newRecipe()), [])

  const recurring = activities.filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && a.status !== 'archived' && isRecurring(a))
  const addItem = (m) =>
    add(blankActivity(m.kind === 'supp' ? 'supplement' : 'meal_item', {
      title: m.name, frequency: m.frequency || 'daily', daysOfWeek: m.days || [],
      details: m.kind === 'supp' ? { slot: m.slot, dose: '', unit: 'mg' } : { slot: m.slot, beverage: m.slot === 'drink' },
    }))
  const saveRecipe = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  return (
    <div className="mb-10">
      {/* LAYER 1 — Your Protocol */}
      <section>
        <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">Your Protocol.</h2>
        <p className="kicker text-stone-400 mt-1 mb-6">What you eat every day</p>
        <div className="space-y-3">
          {DIET_ROWS.map((row, i) => <DietSlotRow key={i} row={row} meals={recurring} onAdd={addItem} onRemove={remove} />)}
        </div>
      </section>

      <hr className="my-12 border-stone-200" />

      {/* LAYER 2 — Your Recipes */}
      <RecipeLibrary activities={activities} onOpen={setEditing} onAdd={() => setEditing(newRecipe())} />

      {editing && (
        <ActivityForm
          activity={editing}
          isNew={!activities.some((x) => x.id === editing.id)}
          onSave={saveRecipe}
          onDelete={() => { remove(editing.id); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function DietSlotRow({ row, meals, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false)
  const items = meals.filter((a) =>
    row.kind === 'supp'
      ? a.type === 'supplement' && slotMeta(a.details.slot || 'breakfast').part === row.part
      : a.type === 'meal_item' && (a.details.slot || 'breakfast') === row.slot,
  )
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-b border-stone-100 pb-3">
      <span className="kicker w-32 shrink-0 text-stone-400">{row.label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {items.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1.5 border border-stone-300 bg-white/50 px-2 py-0.5 text-xs text-stone-700">
            {a.title}
            <span className="text-[9px] uppercase tracking-[0.1em] text-stone-400">{FREQ_LABEL[a.frequency] || a.frequency}</span>
            <button onClick={() => onRemove(a.id)} className="text-stone-400 hover:text-stone-700"><X size={11} /></button>
          </span>
        ))}
        {adding ? (
          <AddMealForm slot={slotMeta(row.slot)} kind={row.kind} onCancel={() => setAdding(false)} onSave={(item) => { onAdd({ ...item, slot: row.slot, kind: row.kind }); setAdding(false) }} />
        ) : (
          <button onClick={() => setAdding(true)} className="text-sm italic hover:text-stone-700" style={{ color: 'rgba(28, 28, 26, 0.7)' }}>
            {row.kind === 'supp' ? 'add supplement' : 'add food'}
          </button>
        )}
      </div>
    </div>
  )
}

function FilterCap({ label, on, onClick }) {
  return (
    <button onClick={onClick} className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${on ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-700'}`} style={on ? { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: '#a8a29e' } : undefined}>
      {label}
    </button>
  )
}

function RecipeLibrary({ activities, onOpen, onAdd }) {
  const [slotF, setSlotF] = useState(null)
  const [phaseF, setPhaseF] = useState(null)
  const recipes = activities.filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && a.status !== 'archived')
  const filtered = recipes.filter((a) =>
    (!slotF || (a.details.slot || 'breakfast') === slotF) && (!phaseF || (a.phase || []).includes(phaseF)),
  )
  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">Your Recipes.</h2>
          <p className="kicker text-stone-400 mt-1">Your kitchen library</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-400">{filtered.length}</span>
          <button onClick={onAdd} className="bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700">Add recipe</button>
        </div>
      </div>

      <div className="my-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y border-stone-100 py-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {SLOT_FILTERS.map((s) => <FilterCap key={s} label={slotMeta(s).label} on={slotF === s} onClick={() => setSlotF(slotF === s ? null : s)} />)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {PHASE_FILTERS.map((p) => <FilterCap key={p.id} label={p.label} on={phaseF === p.id} onClick={() => setPhaseF(phaseF === p.id ? null : p.id)} />)}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">No recipes yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => <RecipeCard key={a.id} a={a} onOpen={() => onOpen(a)} />)}
        </div>
      )}
    </section>
  )
}

function RecipeCard({ a, onOpen }) {
  const preview = (a.notes || '').split('\n').find((l) => l.trim()) || ''
  const ph = (a.phase || [])[0]
  return (
    <button onClick={onOpen} className="flex flex-col items-start border border-stone-200 bg-white/40 p-4 text-left transition-shadow hover:shadow-md">
      <h3 className="font-serif text-xl text-stone-900">{a.title || 'Untitled'}</h3>
      {preview ? (
        <p className="mt-1 line-clamp-1 text-sm text-stone-500">{preview}</p>
      ) : (
        <p className="mt-1 text-sm italic text-stone-300">No notes yet.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="kicker text-stone-400">{slotMeta(a.details.slot || 'breakfast').label}</span>
        {ph && PHASES[ph] && <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: PHASES[ph].color }}>{PHASES[ph].name}</span>}
        <span className="text-[10px] uppercase tracking-[0.1em] text-stone-400">{FREQ_LABEL[a.frequency] || a.frequency}</span>
      </div>
    </button>
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
