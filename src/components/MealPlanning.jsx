import React, { useState } from 'react'
import { X, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { categorize, GROCERY_CATEGORIES } from '../lib/groceryCategories'
import NotesPopup, { hasNotes } from './shared/NotesPopup'
import InlineText from './shared/InlineText'
import { AddMealForm } from './shared/MealSlots'
import { MEAL_SLOTS, slotMeta, RECIPE_TAGS } from '../lib/meals'
import { useRegisterAdd } from './shared/AddButton'
import CategoryCalendar from './shared/CategoryCalendar'
import { useActivities } from '../hooks/useActivities'
import { blankActivity, FREQUENCIES, activityOccursOn } from '../lib/activities'
import { dateKey, parseKey, addDays, DOW, DOW_LONG, MONTHS_SHORT, isSameDay } from '../lib/date'
import ActivityForm from './shared/ActivityForm'

const uid = () => Math.random().toString(36).slice(2, 10)

const tagsOf = (a) => (a.details && Array.isArray(a.details.tags) ? a.details.tags : [])

// Kept for compatibility with any older imports.
export const SLOTS = MEAL_SLOTS

const FREQ_LABEL = Object.fromEntries(FREQUENCIES.map((f) => [f.id, f.label]))

// The daily protocol, slot by slot (supplements grouped by part).
const DIET_ROWS = [
  { kind: 'food', slot: 'empty', label: 'Empty Stomach' },
  { kind: 'food', slot: 'breakfast', label: 'Breakfast' },
  { kind: 'supp', part: 'morning', slot: 'breakfast', label: 'Supplements' },
  { kind: 'food', slot: 'snack', label: 'Snack' },
  { kind: 'food', slot: 'lunch', label: 'Lunch' },
  { kind: 'supp', part: 'afternoon', slot: 'lunch', label: 'Supplements' },
  { kind: 'food', slot: 'snack2', label: 'Snack' },
  { kind: 'food', slot: 'dinner', label: 'Dinner' },
  { kind: 'supp', part: 'evening', slot: 'dinner', label: 'Supplements' },
  { kind: 'food', slot: 'bed', label: 'Before Bed' },
  { kind: 'food', slot: 'drink', label: 'Drink' },
]

export default function MealPlanning({ cycleConfig = {}, subPage = 'weekly' }) {
  return (
    <div>
      {subPage === 'monthly' ? <CategoryCalendar category="nutrition" cycleConfig={cycleConfig} noun="Meal" />
        : subPage === 'ingredients' ? <TodaysIngredients />
          : subPage === 'recipes' ? <Recipes />
            : subPage === 'grocery' ? <GroceryList />
              : <NutritionWeekly />}
    </div>
  )
}

// ── Weekly — the daily protocol, one day at a time, slot by slot ──
// A Monday–Sunday day picker; each day shows its full flow (empty stomach →
// before bed) filtered to the items scheduled that day. Adding writes a recurring
// meal item; the black Add opens the full editor (tags, ingredients, cadence).
function NutritionWeekly() {
  const { activities, add, update, remove } = useActivities()
  const [editing, setEditing] = useState(null)
  const today = new Date()
  const [selKey, setSelKey] = useState(dateKey(today))

  const newItem = () => blankActivity('meal_item', { details: { slot: 'breakfast', beverage: false } })
  useRegisterAdd(() => setEditing(newItem()), [])

  // Monday of the selected week → the seven day dates.
  const sel = parseKey(selKey)
  const monday = addDays(sel, -((sel.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = week[6]
  const shiftWeek = (n) => setSelKey(dateKey(addDays(sel, n * 7)))
  const weekLabel = monday.getMonth() === sunday.getMonth()
    ? `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()}–${sunday.getDate()}`
    : `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}`
  const isThisWeek = dateKey(monday) === dateKey(addDays(today, -((today.getDay() + 6) % 7)))

  const recurring = activities.filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && a.status !== 'archived')
  const dayItems = recurring.filter((a) => activityOccursOn(a, selKey))

  const addItem = (m) =>
    add(blankActivity(m.kind === 'supp' ? 'supplement' : 'meal_item', {
      title: m.name, frequency: m.frequency || 'daily', daysOfWeek: m.days || [], seriesStart: m.startDate || '',
      details: m.kind === 'supp' ? { slot: m.slot, dose: '', unit: 'mg' } : { slot: m.slot, beverage: m.slot === 'drink' },
    }))
  const saveItem = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  return (
    <div className="mb-10">
      <section>
        <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">Your Protocol.</h2>
        <p className="kicker text-stone-400 mt-1 mb-6">What you eat, day by day</p>

        {/* Week navigation — prev · range + jump-to-date · next */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button onClick={() => shiftWeek(-1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">‹</button>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="font-serif text-lg text-stone-900 whitespace-nowrap">{weekLabel}</span>
            {!isThisWeek && <button onClick={() => setSelKey(dateKey(today))} className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-700">This week</button>}
            <input type="date" value={selKey} onChange={(e) => e.target.value && setSelKey(e.target.value)} className="bg-transparent border-b border-stone-200 pb-0.5 text-xs text-stone-500 outline-none focus:border-stone-900" />
          </div>
          <button onClick={() => shiftWeek(1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">›</button>
        </div>

        {/* Day picker — Mon–Sun */}
        <div className="mb-8 grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const k = dateKey(d)
            const on = k === selKey
            const isTod = isSameDay(d, today)
            return (
              <button
                key={k}
                onClick={() => setSelKey(k)}
                className={`flex flex-col items-center gap-1 border py-2 transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-600 hover:border-stone-400'}`}
              >
                <span className="text-[9px] uppercase tracking-[0.14em]">{DOW[d.getDay()][0]}</span>
                <span className={`flex h-7 w-7 items-center justify-center text-sm tabular-nums ${!on && isTod ? 'rounded-full bg-stone-900 text-cream' : ''}`}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>

        <p className="kicker text-stone-400 mb-4">{DOW_LONG[sel.getDay()]}</p>
        <div className="space-y-3">
          {DIET_ROWS.map((row, i) => <DietSlotRow key={i} row={row} meals={dayItems} dayKey={selKey} onAdd={addItem} onRemove={remove} />)}
        </div>
      </section>

      {editing && (
        <ActivityForm
          activity={editing}
          isNew={!activities.some((x) => x.id === editing.id)}
          onSave={saveItem}
          onDelete={() => { remove(editing.id); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ── Recipes — the kitchen library, tag-filtered ──
function Recipes() {
  const { activities, add, update, remove } = useActivities()
  const [editing, setEditing] = useState(null)
  const newRecipe = () => blankActivity('meal_item', { details: { slot: 'breakfast', beverage: false } })
  useRegisterAdd(() => setEditing(newRecipe()), [])
  const saveRecipe = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  return (
    <div className="mb-10">
      <RecipeLibrary activities={activities} onOpen={setEditing} />
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

// ── Today's Ingredients — everything scheduled to consume today, broken down to
// ingredients and grouped like the fridge. Read-only (no Add button). ──
function TodaysIngredients() {
  const { activities } = useActivities()
  const todayKey = dateKey(new Date())

  const items = activities.filter((a) => a.type === 'meal_item' && a.status !== 'archived' && activityOccursOn(a, todayKey))
  // An item's ingredients: its explicit ingredients list if given, else its title.
  const names = []
  items.forEach((a) => {
    const raw = a.details && typeof a.details.ingredients === 'string' ? a.details.ingredients : ''
    const parts = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length) names.push(...parts)
    else if ((a.title || '').trim()) names.push(a.title.trim())
  })
  // Dedupe case-insensitively, keeping first-seen casing.
  const seen = new Map()
  names.forEach((n) => { const k = n.toLowerCase(); if (!seen.has(k)) seen.set(k, n) })
  const unique = [...seen.values()]

  // Group by grocery category; anything uncategorized falls into "Other".
  const groups = {}
  unique.forEach((n) => { const cat = categorize(n) || 'Other'; (groups[cat] = groups[cat] || []).push(n) })
  const orderedCats = [...GROCERY_CATEGORIES, 'Other'].filter((c) => groups[c] && groups[c].length)

  return (
    <section className="mb-10">
      <div className="mb-6">
        <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">Today's Ingredients.</h2>
        <p className="kicker text-stone-400 mt-1">Everything you're set to consume today</p>
      </div>

      {unique.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">Nothing scheduled to eat today.</p>
      ) : (
        <div className="space-y-6">
          {orderedCats.map((cat) => (
            <div key={cat}>
              <h3 className="kicker text-stone-400 mb-2 border-b border-stone-100 pb-1.5">{cat}</h3>
              <div className="flex flex-wrap gap-1.5">
                {groups[cat].map((n) => (
                  <span key={n} className="border border-stone-300 bg-white/50 px-2.5 py-1 text-sm text-stone-700">{n}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function DietSlotRow({ row, meals, dayKey, onAdd, onRemove }) {
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
          <AddMealForm slot={slotMeta(row.slot)} kind={row.kind} dateKeyStr={dayKey} onCancel={() => setAdding(false)} onSave={(item) => { onAdd({ ...item, slot: row.slot, kind: row.kind }); setAdding(false) }} />
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

function RecipeLibrary({ activities, onOpen }) {
  const [tagF, setTagF] = useState(null)
  const recipes = activities.filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && a.status !== 'archived')
  const filtered = recipes.filter((a) => !tagF || tagsOf(a).includes(tagF))
  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">Your Recipes.</h2>
          <p className="kicker text-stone-400 mt-1">Your kitchen library</p>
        </div>
        <span className="text-sm text-stone-400">{filtered.length}</span>
      </div>

      <div className="my-6 flex flex-wrap gap-x-4 gap-y-1.5 border-y border-stone-100 py-3">
        {RECIPE_TAGS.map((t) => <FilterCap key={t} label={t} on={tagF === t} onClick={() => setTagF(tagF === t ? null : t)} />)}
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
  const tags = tagsOf(a)
  return (
    <button onClick={onOpen} className="flex flex-col items-start border border-stone-200 bg-white/40 p-4 text-left transition-shadow hover:shadow-md">
      <h3 className="font-serif text-xl text-stone-900">{a.title || 'Untitled'}</h3>
      {preview ? (
        <p className="mt-1 line-clamp-1 text-sm text-stone-500">{preview}</p>
      ) : (
        <p className="mt-1 text-sm italic text-stone-300">No notes yet.</p>
      )}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((t) => <span key={t} className="border border-stone-200 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-stone-500">{t}</span>)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="kicker text-stone-400">{slotMeta(a.details.slot || 'breakfast').label}</span>
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
  const [pausedOpen, setPausedOpen] = useState(false)

  useRegisterAdd(() => setAdding(true), [])

  // Paused items live in their own dropdown — kept out of the working list.
  const paused = items.filter((i) => i.status === 'paused')
  const active = items.filter((i) => i.status !== 'paused')
  const visible = filter === 'all' ? active : active.filter((i) => i.status === filter)

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

  const Row = (item) => (
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
        <option value="paused">paused</option>
      </select>
      {item.qty && <span className="text-sm text-stone-500 tabular-nums">{item.qty}</span>}
      {item.store && <span className="kicker text-stone-400">{item.store}</span>}
      <button onClick={() => remove(item.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={14} /></button>
    </div>
  )

  return (
    <section className="mb-10">
      <header className="mb-4 flex items-center justify-end">
        <span className="text-sm text-stone-400">{active.length} on the list</span>
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
        <p className="font-serif italic text-lg text-stone-400">{active.length === 0 ? 'Fridge is good. List is empty.' : 'Nothing matches that filter.'}</p>
      ) : (
        <div className="space-y-6">
          {GROCERY_CATEGORIES.map((cat) => {
            const list = visible.filter((i) => categorize(i.name) === cat)
            if (!list.length) return null
            return (
              <div key={cat}>
                <h3 className="kicker text-stone-400 mb-2 border-b border-stone-100 pb-1.5">{cat}</h3>
                <div className="divide-y divide-stone-100">
                  {list.map(Row)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Paused — items you're not repurchasing right now */}
      {paused.length > 0 && (
        <div className="mt-10 border-t border-stone-200 pt-4">
          <button onClick={() => setPausedOpen((o) => !o)} className="flex w-full items-center justify-between">
            <span className="kicker text-stone-400">Paused · {paused.length}</span>
            {pausedOpen ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
          </button>
          {pausedOpen && (
            <div className="mt-4 divide-y divide-stone-100">
              {paused.map(Row)}
            </div>
          )}
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
              <option value="paused">paused</option>
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
