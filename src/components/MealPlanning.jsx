import React, { useState, useEffect } from 'react'
import { Pencil, ChevronDown, Calendar, Share2, CircleCheck, CircleAlert, CircleX, CirclePause } from 'lucide-react'
import { CloseIcon, LoggedIcon, NextIcon } from './shared/marks'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { categorize, GROCERY_CATEGORIES } from '../lib/groceryCategories'
import Diet from './Diet'
import Supplements from './Supplements'
import CategorySchedule from './shared/CategorySchedule'
import NotesPopup, { hasNotes } from './shared/NotesPopup'
import InlineText from './shared/InlineText'
import { AddMealForm } from './shared/MealSlots'
import { MEAL_SLOTS, slotMeta, RECIPE_TAGS } from '../lib/meals'
import { useRegisterAdd } from './shared/AddButton'
import AddInline from './shared/AddInline'
import MonthGrid from './shared/MonthGrid'
import * as store from '../lib/dataStore'
import { useActivities } from '../hooks/useActivities'
import { blankActivity, FREQUENCIES, activityOccursOn } from '../lib/activities'
import { dateKey, parseKey, addDays, DOW, DOW_LONG, MONTHS, MONTHS_SHORT, isSameDay } from '../lib/date'
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
  { kind: 'food', slot: 'lunch', label: 'Lunch' },
  { kind: 'supp', part: 'afternoon', slot: 'lunch', label: 'Supplements' },
  { kind: 'food', slot: 'dinner', label: 'Dinner' },
  { kind: 'supp', part: 'evening', slot: 'dinner', label: 'Supplements' },
  { kind: 'food', slot: 'bed', label: 'Before Bed' },
  { kind: 'food', slot: 'drink', label: 'Drink' },
]

export default function MealPlanning({ cycleConfig = {}, subPage = 'weekly' }) {
  return (
    <div>
      {subPage === 'schedule' || subPage === 'monthly' || subPage === 'weekly' ? <CategorySchedule category="nutrition" question="What do you want to eat today?" noun="Item" cycleConfig={cycleConfig} />
        : subPage === 'supplements' ? <Supplements />
        : subPage === 'ingredients' ? <TodaysIngredients />
          : subPage === 'diet' ? <Diet />
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
  const fullDay = (d) => `${DOW_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  const weekLabel = `${fullDay(monday)} - ${fullDay(sunday)}`

  const recurring = activities.filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && a.status !== 'archived')

  const addItem = (m) =>
    add(blankActivity(m.kind === 'supp' ? 'supplement' : 'meal_item', {
      title: m.name, frequency: m.frequency || 'daily', daysOfWeek: m.days || [], seriesStart: m.startDate || '',
      details: m.kind === 'supp' ? { slot: m.slot, dose: '', unit: 'mg' } : { slot: m.slot, beverage: m.slot === 'drink' },
    }))
  const saveItem = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  return (
    <div className="mb-10">
      <section>
        {/* Week navigation — prev · range + jump-to-date · next */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button onClick={() => shiftWeek(-1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">‹</button>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="font-serif text-lg text-stone-900">{weekLabel}</span>
            <label className="relative inline-flex cursor-pointer items-center text-stone-400 hover:text-stone-900">
              <Calendar size={16} />
              <input type="date" value={selKey} onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()} onChange={(e) => e.target.value && setSelKey(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
          </div>
          <button onClick={() => shiftWeek(1)} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">›</button>
        </div>

        {/* Each day of the week, stacked — its full flow, slot by slot */}
        <div className="space-y-8">
          {week.map((d) => {
            const k = dateKey(d)
            const items = recurring.filter((a) => activityOccursOn(a, k))
            const isTod = isSameDay(d, today)
            return (
              <section key={k} className="border-t border-stone-200 pt-4">
                <h3 className={`mb-3 font-serif italic text-2xl ${isTod ? 'text-stone-900' : 'text-stone-800'}`}>
                  {DOW_LONG[d.getDay()]}
                  <span className="ml-2 text-base not-italic text-stone-400">{MONTHS_SHORT[d.getMonth()]} {d.getDate()}</span>
                </h3>
                <div className="space-y-3">
                  {DIET_ROWS.map((row, i) => <DietSlotRow key={i} row={row} meals={items} dayKey={k} onAdd={addItem} onOpen={(a) => setEditing(a)} onResume={(id) => update(id, { status: 'active' })} />)}
                </div>
              </section>
            )
          })}
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

// ── Monthly — the cycle calendar; pick any day to see that day's full menu ──
// The month grid carries the cycle-phase tints; tapping a day drops its whole
// nourishment flow (empty stomach → drink) below, in the same quiet language as
// the Weekly, so each day reads like a little Today menu.
function NutritionMonthly({ cycleConfig = {} }) {
  const { activities, add, update, remove } = useActivities()
  const today = new Date()
  const [st, setSt] = useState(store.getStatus())
  useEffect(() => store.subscribeStatus(setSt), [])
  const signupKey = st.createdAt ? dateKey(new Date(st.createdAt)) : ''
  const signupMonthStart = signupKey ? new Date(parseKey(signupKey).getFullYear(), parseKey(signupKey).getMonth(), 1) : null

  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const [editing, setEditing] = useState(null)

  const meals = activities.filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && a.status !== 'archived')
  const forDay = (k) => meals.filter((a) => activityOccursOn(a, k))

  const newItem = () => blankActivity('meal_item', { details: { slot: 'breakfast', beverage: false } })
  useRegisterAdd(() => setEditing(newItem()), [])
  const addItem = (m) =>
    add(blankActivity(m.kind === 'supp' ? 'supplement' : 'meal_item', {
      title: m.name, frequency: m.frequency || 'daily', daysOfWeek: m.days || [], seriesStart: m.startDate || '',
      details: m.kind === 'supp' ? { slot: m.slot, dose: '', unit: 'mg' } : { slot: m.slot, beverage: m.slot === 'drink' },
    }))
  const saveItem = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  const selD = parseKey(selectedKey)
  const dayItems = forDay(selectedKey)

  return (
    <div className="mb-10">
      <MonthGrid
        month={month}
        setMonth={setMonth}
        selectedKey={selectedKey}
        onPickDay={setSelectedKey}
        today={today}
        cycleConfig={cycleConfig}
        floorMonth={signupMonthStart}
        daySignal={(k) => {
          const list = forDay(k)
          const SLOT_PART = { empty: 'morning', breakfast: 'morning', drink: 'morning', lunch: 'afternoon', snack: 'afternoon', dinner: 'evening', bed: 'evening' }
          const partOfMeal = (a) => SLOT_PART[a.details?.slot] || 'morning'
          return {
            morning: list.some((a) => partOfMeal(a) === 'morning'),
            afternoon: list.some((a) => partOfMeal(a) === 'afternoon'),
            evening: list.some((a) => partOfMeal(a) === 'evening'),
            special: false,
          }
        }}
      />

      {/* The picked day's full menu, slot by slot */}
      <section className="mt-8 border-t border-stone-200 pt-5">
        <h3 className="mb-4 font-serif italic text-2xl text-stone-900">
          {DOW_LONG[selD.getDay()]}
          <span className="ml-2 text-base not-italic text-stone-400">{MONTHS[selD.getMonth()]} {selD.getDate()}</span>
        </h3>
        <div className="space-y-3">
          {DIET_ROWS.map((row, i) => <DietSlotRow key={i} row={row} meals={dayItems} dayKey={selectedKey} onAdd={addItem} onOpen={(a) => setEditing(a)} onResume={(id) => update(id, { status: 'active' })} />)}
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

// One slot's flow for a day — a quiet, editorial line of item names (no boxes, no
// repeated cadence tags). Tap a name to edit or remove it in the full editor; a
// non-daily cadence shows as a small italic note, and paused items dim with resume.
function DietSlotRow({ row, meals, dayKey, onAdd, onOpen, onResume }) {
  const [adding, setAdding] = useState(false)
  const items = meals.filter((a) =>
    row.kind === 'supp'
      ? a.type === 'supplement' && slotMeta(a.details.slot || 'breakfast').part === row.part
      : a.type === 'meal_item' && (a.details.slot || 'breakfast') === row.slot,
  )
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-b border-stone-100 pb-3">
      <span className="kicker w-32 shrink-0 text-stone-400">{row.label}</span>
      <div className="flex flex-1 flex-wrap items-baseline gap-x-1 gap-y-1 text-sm">
        {items.map((a, idx) => (
          <span key={a.id} className={`inline-flex items-baseline gap-1.5 ${a.status === 'paused' ? 'opacity-50' : ''}`}>
            {idx > 0 && <span aria-hidden className="mr-1 text-stone-300">·</span>}
            <button onClick={() => onOpen && onOpen(a)} className="text-stone-700 transition-colors hover:text-stone-950">
              {a.title}
              {a.frequency && a.frequency !== 'daily' && <span className="ml-1.5 text-[10px] italic text-stone-400">{FREQ_LABEL[a.frequency] || a.frequency}</span>}
            </button>
            {a.status === 'paused' && <button onClick={() => onResume && onResume(a.id)} title="Resume — bring back to Today" className="text-[9px] uppercase tracking-[0.12em] text-stone-400 hover:text-stone-900">resume</button>}
          </span>
        ))}
        {adding ? (
          <AddMealForm slot={slotMeta(row.slot)} kind={row.kind} dateKeyStr={dayKey} onCancel={() => setAdding(false)} onSave={(item) => { onAdd({ ...item, slot: row.slot, kind: row.kind }); setAdding(false) }} />
        ) : (
          <button onClick={() => setAdding(true)} className="ml-2 text-sm italic text-stone-400 transition-colors hover:text-stone-700">
            {row.kind === 'supp' ? 'add supplement' : 'add food'}
          </button>
        )}
      </div>
    </div>
  )
}

// Soft cycle-phase colours for the filter dots.
const PHASE_DOT = { Follicular: '#8A9E8A', Ovulatory: '#C4A882', Luteal: '#A89BB8', Menstrual: '#C4959A' }
const CYCLE_TAGS = ['Follicular', 'Ovulatory', 'Luteal', 'Menstrual']

// One labelled row of filter chips — quiet tracked-caps that ink + underline
// when active, with an optional colour dot. No boxes.
function FilterGroup({ label, items, active, onPick }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="kicker w-16 shrink-0 text-stone-300">{label}</span>
      {items.map((it) => {
        const on = active === it.id
        return (
          <button
            key={it.id}
            onClick={() => onPick(it.id)}
            className={`flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors ${on ? 'font-medium text-stone-900' : 'text-stone-400 hover:text-stone-700'}`}
            style={on ? { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: '#a8a29e' } : undefined}
          >
            {it.dot && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: it.dot }} />}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

// The five time-of-day buckets a recipe (or supplement) can belong to.
const RECIPE_SLOTS = [
  { id: 'empty', label: 'Empty Stomach', slots: ['empty', 'emptydrink'] },
  { id: 'breakfast', label: 'Breakfast', slots: ['breakfast', 'drink'] },
  { id: 'lunch', label: 'Lunch', slots: ['lunch', 'lunchdrink'] },
  { id: 'dinner', label: 'Dinner', slots: ['dinner', 'dinnerdrink'] },
  { id: 'bed', label: 'Before Bed', slots: ['bed', 'beddrink'] },
]
const recipeBucket = (slot) => (RECIPE_SLOTS.find((b) => b.slots.includes(slot)) || RECIPE_SLOTS[1]).id

function RecipeLibrary({ activities, onOpen }) {
  const [slotF, setSlotF] = useState(null)
  // Recipes are food only — supplements live under Nutrition → Supplements.
  const recipes = activities.filter((a) => a.type === 'meal_item' && a.status !== 'archived')
  const filtered = recipes.filter((a) => !slotF || recipeBucket(a.details.slot || 'breakfast') === slotF)
  const pill = (on) => `rounded-full px-4 py-1.5 text-sm transition-colors ${on ? 'bg-stone-900 text-cream' : 'border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-800'}`
  return (
    <section>
      <div className="no-scrollbar mb-8 flex flex-wrap items-center justify-center gap-1.5 overflow-x-auto">
        <button onClick={() => setSlotF(null)} className={pill(!slotF)}>All</button>
        {RECIPE_SLOTS.map((b) => (
          <button key={b.id} onClick={() => setSlotF(slotF === b.id ? null : b.id)} className={pill(slotF === b.id)}>{b.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 py-16 text-center">
          <p className="font-serif italic text-xl text-stone-400">No recipes yet.</p>
          <p className="mt-1 text-sm text-stone-400">Tap the + to add your first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => <RecipeCard key={a.id} a={a} onOpen={() => onOpen(a)} />)}
        </div>
      )}
    </section>
  )
}

// A recipe reads as an elegant card: a soft tinted crown with a serif monogram
// (tint keyed to its cycle phase, else a stable colour from its name), the title,
// a quiet slot · frequency, and its tags as chips.
const RECIPE_PALETTE = ['#889072', '#C4A76A', '#A0654C', '#8E8074', '#8C7A5F', '#9E7B5A', '#7C8B6B', '#B08D45']
function recipeTint(a) {
  const phase = (tagsOf(a) || []).find((t) => CYCLE_TAGS.includes(t))
  if (phase) return PHASE_DOT[phase]
  const s = a.title || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return RECIPE_PALETTE[h % RECIPE_PALETTE.length]
}
function RecipeCard({ a, onOpen }) {
  const tint = recipeTint(a)
  const initial = ((a.title || '?').trim()[0] || '?').toUpperCase()
  const note = (a.notes || '').split('\n').find((l) => l.trim()) || ''
  return (
    <button onClick={onOpen} className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-cream/50 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative flex h-20 items-center justify-center" style={{ background: `linear-gradient(135deg, ${tint}26, ${tint}0d)` }}>
        <span className="font-serif text-4xl leading-none" style={{ color: tint, opacity: 0.6 }}>{initial}</span>
        <span aria-hidden className="absolute bottom-0 left-0 h-[3px] w-full" style={{ background: tint, opacity: 0.55 }} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-xl leading-tight text-stone-900">{a.title || 'Untitled'}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-stone-400">
          <span className="kicker">{slotMeta(a.details.slot || 'breakfast').label}</span>
          <span className="text-stone-300">·</span>
          <span className="kicker">{FREQ_LABEL[a.frequency] || a.frequency}</span>
        </div>
        {note && <p className="mt-2 line-clamp-1 text-sm leading-relaxed text-stone-500">{note}</p>}
      </div>
    </button>
  )
}

// Muted status tones: a soft full-row tint + a stronger left border.
// Legacy items stored "need to buy"; read it as the new "out of stock".
const normStatus = (s) => (s === 'need to buy' ? 'out of stock' : s || '')
const STATUS_BORDER = { 'out of stock': '#C4959A', 'need to buy': '#C4959A', 'running low': '#C4A882', 'in stock': '#8A9E8A', paused: '#D6D3D1' }
const STATUS_BG = { 'out of stock': '#F9EDEE', 'need to buy': '#F9EDEE', 'running low': '#FAF5EE', 'in stock': '#EFF4EF', paused: 'transparent' }
// Clickable status symbols, in the order shown on each row.
const STATUS_OPTS = [
  { id: 'in stock', label: 'In stock', icon: CircleCheck, color: '#6f8a6f' },
  { id: 'running low', label: 'Running low', icon: CircleAlert, color: '#b8964e' },
  { id: 'out of stock', label: 'Out of stock', icon: CircleX, color: '#b06b72' },
  { id: 'paused', label: 'Paused', icon: CirclePause, color: '#a8a29e' },
]
const FRIDGE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'in stock', label: 'In Stock' },
  { id: 'running low', label: 'Running Low' },
  { id: 'out of stock', label: 'Out of Stock' },
]

// ── What's In My Fridge ──
function GroceryList() {
  const [items, setItems] = useLocalStorage('mos:menu:groceries', [])
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [popup, setPopup] = useState(null)
  const [pausedOpen, setPausedOpen] = useState(false)

  useRegisterAdd(() => setAdding(true), [])
  const [copied, setCopied] = useState(false)

  // Paused items live in their own dropdown — kept out of the working list.
  const paused = items.filter((i) => normStatus(i.status) === 'paused')
  const active = items.filter((i) => normStatus(i.status) !== 'paused')
  const visible = filter === 'all' ? active : active.filter((i) => normStatus(i.status) === filter)

  // Build a plain-text shopping list — the things to buy (out of stock + running
  // low), grouped by aisle; falls back to the whole list if nothing's flagged.
  const buildListText = () => {
    const toBuy = active.filter((i) => ['out of stock', 'running low'].includes(normStatus(i.status)))
    const list = toBuy.length ? toBuy : active
    if (!list.length) return ''
    const groups = {}
    list.forEach((i) => { const c = categorize(i.name) || 'Other'; (groups[c] = groups[c] || []).push(i) })
    const cats = [...GROCERY_CATEGORIES, ...Object.keys(groups).filter((c) => !GROCERY_CATEGORIES.includes(c))]
    const out = ['Grocery List']
    cats.forEach((cat) => {
      const g = groups[cat]
      if (!g || !g.length) return
      out.push('', cat.toUpperCase())
      g.forEach((i) => out.push(`• ${i.name}${i.qty ? ` (${i.qty})` : ''}`))
    })
    return out.join('\n')
  }
  const shareList = async () => {
    const text = buildListText()
    if (!text) return
    if (navigator.share) { try { await navigator.share({ title: 'Grocery List', text }) } catch { /* cancelled */ } return }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

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

  // Marking something out of stock puts it straight on the shopping list —
  // deduped by name against what's already there and unbought.
  const addToShopping = (name) => {
    const t = (name || '').trim()
    if (!t) return
    const cur = store.get('mos:shopping', [])
    const arr = Array.isArray(cur) ? cur : []
    if (arr.some((x) => !x.bought && (x.text || '').trim().toLowerCase() === t.toLowerCase())) return
    store.set('mos:shopping', [{ id: uid(), text: t, bought: false, addedDate: dateKey(new Date()), boughtDate: '' }, ...arr])
  }

  const Row = (item) => {
    const st = normStatus(item.status)
    return (
      <div key={item.id} className="group flex items-center gap-3 py-2.5 pl-3" style={{ borderLeft: `3px solid ${STATUS_BORDER[st] || 'transparent'}`, backgroundColor: STATUS_BG[st] || 'transparent' }}>
        <div className="flex flex-1 items-center gap-1.5">
          <button onClick={() => setPopup({ variant: 'grocery', itemName: item.name, initial: item.notes, onSave: (notes) => { update(item.id, { notes }); setPopup(null) } })} className={`shrink-0 ${hasNotes(item.notes) ? 'text-stone-500' : 'text-stone-300 opacity-0 group-hover:opacity-100'}`} title="Notes">
            <Pencil size={11} />
          </button>
          <InlineText value={item.name} onChange={(name) => update(item.id, { name })} className="text-sm text-stone-800 bg-transparent outline-none" />
        </div>
        {item.qty && <span className="text-sm text-stone-500 tabular-nums">{item.qty}</span>}
        {item.store && <span className="kicker text-stone-400">{item.store}</span>}
        <div className="flex shrink-0 items-center gap-1.5">
          {STATUS_OPTS.map((s) => {
            const on = st === s.id
            const Icon = s.icon
            return (
              <button key={s.id} onClick={() => { update(item.id, { status: on ? '' : s.id }); if (!on && s.id === 'out of stock') addToShopping(item.name) }} title={s.label} aria-label={s.label} className={`transition-colors ${on ? '' : 'text-stone-300 hover:text-stone-500'}`} style={on ? { color: s.color } : undefined}>
                <Icon size={17} strokeWidth={1.75} />
              </button>
            )
          })}
        </div>
        <button onClick={() => remove(item.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><CloseIcon size={14} /></button>
      </div>
    )
  }

  return (
    <section className="mb-10">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={shareList} disabled={!active.length} className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-stone-500 transition-colors hover:text-stone-900 disabled:opacity-40 disabled:hover:text-stone-500">
          {copied ? <><LoggedIcon size={13} /> Copied</> : <><Share2 size={13} /> Share list</>}
        </button>
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

      <AddInline label="Add something to the fridge" onClick={() => setAdding(true)} className="mb-6" />

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
            {pausedOpen ? <ChevronDown size={14} className="text-stone-400" /> : <NextIcon size={14} className="text-stone-400" />}
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
              <option value="in stock">in stock</option>
              <option value="running low">running low</option>
              <option value="out of stock">out of stock</option>
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
