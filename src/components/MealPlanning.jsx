import React, { useMemo, useState } from 'react'
import { Plus, X, ChevronLeft, ChevronRight, Pencil, GripVertical } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseFor, PHASE_FOODS, PHASES } from '../lib/cycle'
import { dateKey, weekDays, addDays, isSameDay, DOW, DOW_LONG, MONTHS } from '../lib/date'
import { categorize, GROCERY_CATEGORIES } from '../lib/groceryCategories'
import FreqPicker from './shared/FreqPicker'
import NotesPopup, { hasNotes } from './shared/NotesPopup'
import ScopePrompt from './shared/ScopePrompt'
import Recipes from './Recipes'

const uid = () => Math.random().toString(36).slice(2, 10)

const SLOTS = [
  { id: 'empty', label: 'Empty stomach', supps: true },
  { id: 'breakfast', label: 'Breakfast', supps: true },
  { id: 'snack1', label: 'Snack', supps: false },
  { id: 'lunch', label: 'Lunch', supps: true },
  { id: 'snack2', label: 'Snack', supps: false },
  { id: 'dinner', label: 'Dinner', supps: true },
  { id: 'bed', label: 'Before bed', supps: true },
]

export default function MealPlanning({ cycleConfig, subPage = 'planner' }) {
  const today = new Date()
  const [selected, setSelected] = useState(new Date())
  const key = dateKey(selected)

  const [weekPlan, setWeekPlan] = useLocalStorage('mos:menu:weekplan', {})
  const [beverages, setBeverages] = useLocalStorage('mos:menu:hydration', {})

  const [popup, setPopup] = useState(null)
  const [scope, setScope] = useState(null) // { ctx, op, action }

  // History for autocomplete — every food / supp name ever entered.
  const history = useMemo(() => {
    const foods = new Set()
    const supps = new Set()
    Object.values(weekPlan || {}).forEach((day) => {
      Object.values(day || {}).forEach((slot) => {
        ;(slot.foods || []).forEach((f) => f.name && foods.add(f.name))
        ;(slot.supps || []).forEach((s) => s.name && supps.add(s.name))
      })
    })
    return { foods: [...foods], supps: [...supps] }
  }, [weekPlan])

  const phaseLabel = () => {
    const p = phaseFor(selected, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
    return p ? `${p.name} · Day ${p.cycleDay}` : ''
  }

  // ── mutate a single slot's list ──
  const mutateSlot = (k, slotId, listKey, fn) => {
    setWeekPlan((prev) => {
      const day = prev[k] || {}
      const slot = day[slotId] || { foods: [], supps: [] }
      return { ...prev, [k]: { ...day, [slotId]: { ...slot, [listKey]: fn(slot[listKey] || []) } } }
    })
  }

  // ── apply a remove/update across dates per recurrence scope ──
  const applyScoped = (scopeChoice, ctx, op) => {
    const { key: ck, slotId, listKey, item } = ctx
    setWeekPlan((prev) => {
      const next = {}
      Object.keys(prev).forEach((dk) => {
        const day = prev[dk]
        const inScope =
          scopeChoice === 'all' ||
          (scopeChoice === 'following' && dk >= ck) ||
          (scopeChoice === 'one' && dk === ck)
        if (!inScope || !day[slotId]) {
          next[dk] = day
          return
        }
        const slot = day[slotId]
        const list = slot[listKey] || []
        const matches = (it) => (scopeChoice === 'one' ? it.id === item.id : it.name === item.name)
        const newList =
          op.type === 'remove'
            ? list.filter((it) => !matches(it))
            : list.map((it) => (matches(it) ? { ...it, ...op.patch } : it))
        next[dk] = { ...day, [slotId]: { ...slot, [listKey]: newList } }
      })
      return next
    })
  }

  const addItem = (k, slotId, listKey, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    mutateSlot(k, slotId, listKey, (list) => [
      ...list,
      { id: uid(), name: trimmed, freq: 'daily', days: null, phases: [], notes: {} },
    ])
  }

  const removeItem = (k, slotId, listKey, item) => {
    if (item.freq && item.freq !== 'once') {
      setScope({ ctx: { key: k, slotId, listKey, item }, op: { type: 'remove' }, action: 'remove' })
    } else {
      mutateSlot(k, slotId, listKey, (list) => list.filter((i) => i.id !== item.id))
    }
  }

  const changeItem = (k, slotId, listKey, item, patch) => {
    if (item.freq && item.freq !== 'once') {
      setScope({ ctx: { key: k, slotId, listKey, item }, op: { type: 'update', patch }, action: 'change' })
    } else {
      mutateSlot(k, slotId, listKey, (list) => list.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))
    }
  }

  const setItemNotes = (k, slotId, listKey, id, notes) =>
    mutateSlot(k, slotId, listKey, (list) => list.map((i) => (i.id === id ? { ...i, notes } : i)))

  const reorderItem = (k, slotId, listKey, from, to) =>
    mutateSlot(k, slotId, listKey, (list) => {
      const copy = [...list]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })

  // ── beverage (free text, one per slot, no units) ──
  const beverageFor = (slotId) => (beverages[key] && beverages[key][slotId]) || ''
  const setBeverage = (slotId, text) => {
    setBeverages((prev) => {
      const day = prev[key] || {}
      return { ...prev, [key]: { ...day, [slotId]: text } }
    })
  }

  const openItemNotes = (k, slotId, listKey, item) => {
    setPopup({
      variant: listKey === 'supps' ? 'supplement' : 'food',
      itemName: item.name,
      initial: item.notes,
      cyclePhaseLabel: phaseLabel(),
      onSave: (notes) => {
        setItemNotes(k, slotId, listKey, item.id, notes)
        setPopup(null)
      },
    })
  }

  const phase = phaseFor(selected, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)

  return (
    <div>
      {subPage === 'grocery' && <GroceryList onOpenNotes={setPopup} />}
      {subPage === 'recipes' && <Recipes />}

      {subPage === 'planner' && (
        <>
          <DayNav selected={selected} setSelected={setSelected} today={today} />
          <DayHeader date={selected} phase={phase} />
          <PhaseNote phase={phase} hasPeriod={!!cycleConfig.lastPeriodStart} />

          <div className="border-t border-stone-200">
            {SLOTS.map((slot) => {
              const plan = weekPlan[key] || {}
              return (
                <MealSlot
                  key={slot.id}
                  slot={slot}
                  dateKeyStr={key}
                  foods={(plan[slot.id] && plan[slot.id].foods) || []}
                  supps={(plan[slot.id] && plan[slot.id].supps) || []}
                  beverage={beverageFor(slot.id)}
                  history={history}
                  onAdd={addItem}
                  onRemove={removeItem}
                  onChange={changeItem}
                  onReorder={reorderItem}
                  onSetBeverage={setBeverage}
                  onOpenItemNotes={openItemNotes}
                />
              )
            })}
          </div>
        </>
      )}

      {popup && (
        <NotesPopup
          open
          variant={popup.variant}
          itemName={popup.itemName}
          initial={popup.initial}
          cyclePhaseLabel={popup.cyclePhaseLabel}
          onClose={() => setPopup(null)}
          onSave={popup.onSave}
        />
      )}

      <ScopePrompt
        open={!!scope}
        itemName={scope ? scope.ctx.item.name : ''}
        action={scope ? scope.action : 'change'}
        onClose={() => setScope(null)}
        onChoose={(choice) => {
          applyScoped(choice, scope.ctx, scope.op)
          setScope(null)
        }}
      />
    </div>
  )
}

// ── Day navigation: arrows + a week of day initials ─────────────────
function DayNav({ selected, setSelected, today }) {
  const days = weekDays(selected)
  return (
    <div className="mb-10 flex items-center justify-center gap-5">
      <button
        onClick={() => setSelected(addDays(selected, -1))}
        className="text-stone-400 hover:text-stone-900"
        aria-label="Previous day"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="flex items-center gap-1.5">
        {days.map((d) => {
          const sel = isSameDay(d, selected)
          const isTod = isSameDay(d, today)
          return (
            <button
              key={dateKey(d)}
              onClick={() => setSelected(d)}
              className="flex flex-col items-center gap-1"
              aria-label={DOW_LONG[d.getDay()]}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                  sel ? 'bg-stone-900 text-cream' : 'text-stone-400 hover:text-stone-900'
                }`}
              >
                {DOW[d.getDay()][0]}
              </span>
              <span className={`h-1 w-1 rounded-full ${isTod ? 'bg-sand' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
      <button
        onClick={() => setSelected(addDays(selected, 1))}
        className="text-stone-400 hover:text-stone-900"
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

function DayHeader({ date, phase }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="kicker text-stone-400 mb-1">{DOW_LONG[date.getDay()]}</p>
        <h2 className="font-serif italic text-4xl md:text-5xl leading-none text-stone-900">
          {MONTHS[date.getMonth()]} {date.getDate()}
        </h2>
      </div>
      {phase && (
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
          style={{ backgroundColor: phase.color, color: phase.ink }}
        >
          <span className="font-medium">{phase.name}</span>
          <span className="opacity-70">· Day {phase.cycleDay}</span>
        </span>
      )}
    </div>
  )
}

// The day's cycle-phase nutrition guidance, kept calm and to the side.
function PhaseNote({ phase, hasPeriod }) {
  if (!hasPeriod) {
    return (
      <p className="mb-12 text-sm text-stone-400">
        Set your last period on the Today page to see phase guidance here.
      </p>
    )
  }
  if (!phase) return null
  return (
    <div className="mb-12 border-l-2 pl-4" style={{ borderColor: phase.color }}>
      <p className="kicker mb-1.5" style={{ color: phase.color }}>
        Prioritize this phase · {phase.range}
      </p>
      <p className="text-sm leading-relaxed text-stone-500">{PHASE_FOODS[phase.id].join(', ')}.</p>
    </div>
  )
}

// ── Meal slot — full width, breathing room, journal feel ────────────
function MealSlot({
  slot, dateKeyStr, foods, supps, beverage, history,
  onAdd, onRemove, onChange, onReorder, onSetBeverage, onOpenItemNotes,
}) {
  return (
    <div className="border-b border-stone-200 py-7">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="kicker text-stone-500">{slot.label}</h3>
        <input
          value={beverage}
          onChange={(e) => onSetBeverage(slot.id, e.target.value)}
          placeholder="beverage"
          className="w-44 bg-transparent border-b border-stone-200 pb-1 text-sm italic text-stone-500 placeholder-stone-300 outline-none focus:border-stone-500 transition-colors"
        />
      </div>

      <BubbleList
        items={foods}
        kind="food"
        dateKeyStr={dateKeyStr}
        slotId={slot.id}
        listKey="foods"
        onRemove={onRemove}
        onChange={onChange}
        onReorder={onReorder}
        onOpenItemNotes={onOpenItemNotes}
      />
      <ItemInput
        placeholder="add food"
        suggestions={history.foods}
        existing={foods.map((f) => f.name)}
        onCommit={(name) => onAdd(dateKeyStr, slot.id, 'foods', name)}
      />

      {slot.supps && (
        <div className="mt-5">
          <p className="kicker text-stone-400 mb-2">Supplements</p>
          <BubbleList
            items={supps}
            kind="supp"
            dateKeyStr={dateKeyStr}
            slotId={slot.id}
            listKey="supps"
            onRemove={onRemove}
            onChange={onChange}
            onReorder={onReorder}
            onOpenItemNotes={onOpenItemNotes}
          />
          <ItemInput
            placeholder="add supplement"
            suggestions={history.supps}
            existing={supps.map((s) => s.name)}
            onCommit={(name) => onAdd(dateKeyStr, slot.id, 'supps', name)}
          />
        </div>
      )}
    </div>
  )
}

// ── Draggable bubble list (reorder within a slot) ───────────────────
function BubbleList({ items, kind, dateKeyStr, slotId, listKey, onRemove, onChange, onReorder, onOpenItemNotes }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  if (!items.length) return null

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {items.map((item, idx) => (
        <span
          key={item.id}
          draggable
          onDragStart={() => setDragIdx(idx)}
          onDragOver={(e) => {
            e.preventDefault()
            if (overIdx !== idx) setOverIdx(idx)
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dragIdx !== null && dragIdx !== idx) {
              onReorder(dateKeyStr, slotId, listKey, dragIdx, idx)
            }
            setDragIdx(null)
            setOverIdx(null)
          }}
          onDragEnd={() => {
            setDragIdx(null)
            setOverIdx(null)
          }}
          className={overIdx === idx && dragIdx !== null && dragIdx !== idx ? 'ring-1 ring-stone-900' : ''}
        >
          <Bubble
            item={item}
            kind={kind}
            onClick={() => onOpenItemNotes(dateKeyStr, slotId, listKey, item)}
            onFreq={(freq, days, phases) => onChange(dateKeyStr, slotId, listKey, item, { freq, days, phases })}
            onRemove={() => onRemove(dateKeyStr, slotId, listKey, item)}
          />
        </span>
      ))}
    </div>
  )
}

function PhaseDots({ phases }) {
  if (!phases || !phases.length) return null
  return (
    <span className="flex items-center gap-0.5">
      {phases.map((id) => (
        <span key={id} className="inline-block h-1.5 w-1.5" style={{ backgroundColor: PHASES[id]?.color }} />
      ))}
    </span>
  )
}

function Bubble({ item, kind, onClick, onFreq, onRemove }) {
  const noted = hasNotes(item.notes)
  if (kind === 'supp') {
    return (
      <span className="group inline-flex cursor-grab items-center gap-1 rounded-full bg-stone-900 px-2.5 py-1 text-[11px] text-cream active:cursor-grabbing">
        <GripVertical size={9} className="text-stone-500" />
        <button onClick={onClick} className="flex items-center gap-1">
          {noted && <Pencil size={9} className="text-sand" />}
          {item.name}
        </button>
        <PhaseDots phases={item.phases} />
        <FreqPicker value={item.freq} days={item.days} phases={item.phases} onChange={onFreq} dark />
        <button onClick={onRemove} className="text-stone-400 hover:text-cream">
          <X size={10} />
        </button>
      </span>
    )
  }
  return (
    <span className="group inline-flex cursor-grab items-center gap-1 border border-stone-900 bg-cream px-2.5 py-1 text-[11px] text-stone-900 active:cursor-grabbing">
      <GripVertical size={9} className="text-stone-400" />
      <button onClick={onClick} className="flex items-center gap-1">
        {noted && <Pencil size={9} className="text-stone-900" />}
        {item.name}
      </button>
      <PhaseDots phases={item.phases} />
      <FreqPicker value={item.freq} days={item.days} phases={item.phases} onChange={onFreq} />
      <button onClick={onRemove} className="text-stone-400 hover:text-stone-900">
        <X size={10} />
      </button>
    </span>
  )
}

// ── Item input with autocomplete ────────────────────────────────────
function ItemInput({ placeholder, suggestions, existing, onCommit }) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const matches = useMemo(() => {
    if (!draft.trim()) return []
    const q = draft.trim().toLowerCase()
    return (suggestions || [])
      .filter((s) => s.toLowerCase().includes(q) && !existing.includes(s))
      .slice(0, 6)
  }, [draft, suggestions, existing])

  const commit = (name) => {
    onCommit(name)
    setDraft('')
  }

  return (
    <div className="relative">
      <input
        value={draft}
        onChange={(e) => {
          const v = e.target.value
          if (v.endsWith(',')) commit(v.slice(0, -1))
          else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className="w-full max-w-xs bg-transparent border-b border-stone-200 pb-1 text-sm text-stone-700 placeholder-stone-300 outline-none focus:border-stone-900"
      />
      {focused && matches.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-0.5 w-full max-w-xs border border-stone-300 bg-cream shadow-lg">
          {matches.map((m) => (
            <button
              key={m}
              onMouseDown={() => commit(m)}
              className="block w-full px-2 py-1 text-left text-sm text-stone-700 hover:bg-stone-100"
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Muted status tones: a soft full-row tint + a stronger left border.
const STATUS_BORDER = {
  'need to buy': '#C4959A',
  'running low': '#C4A882',
  'in stock': '#8A9E8A',
}
const STATUS_BG = {
  'need to buy': '#F9EDEE',
  'running low': '#FAF5EE',
  'in stock': '#EFF4EF',
}

// ── Grocery list (auto-categorized) ─────────────────────────────────
function GroceryList({ onOpenNotes }) {
  const [items, setItems] = useLocalStorage('mos:menu:groceries', [])
  const [draft, setDraft] = useState({ name: '', status: '', qty: '', store: '' })

  const add = () => {
    if (!draft.name.trim()) return
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        name: draft.name.trim(),
        status: draft.status,
        qty: draft.qty.trim(),
        store: draft.store.trim(),
        category: categorize(draft.name),
        done: false,
        notes: {},
      },
    ])
    setDraft({ name: '', status: '', qty: '', store: '' })
  }
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))
  const update = (id, patch) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  return (
    <section className="mb-10">
      <header className="mb-4 flex items-center justify-end">
        <span className="text-sm text-stone-400">{items.length} on the list</span>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Item"
          className="min-w-[160px] flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <select
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          className="border-b border-stone-300 bg-transparent pb-1.5 text-sm text-stone-600 outline-none"
        >
          <option value="">status</option>
          <option value="need to buy">need to buy</option>
          <option value="running low">running low</option>
          <option value="in stock">in stock</option>
        </select>
        <input
          value={draft.qty}
          onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Qty"
          className="w-16 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <input
          value={draft.store}
          onChange={(e) => setDraft({ ...draft, store: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Store"
          className="w-28 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={add} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700">
          <Plus size={16} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">Fridge is good. List is empty.</p>
      ) : (
        <div className="space-y-6">
          {GROCERY_CATEGORIES.map((cat) => {
            const list = items.filter((i) => categorize(i.name) === cat)
            if (!list.length) return null
            return (
              <div key={cat}>
                <h3 className="kicker text-stone-400 mb-2 border-b border-stone-100 pb-1.5">{cat}</h3>
                <div className="divide-y divide-stone-100">
                  {list.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 py-2.5 pl-3"
                      style={{
                        borderLeft: `3px solid ${STATUS_BORDER[item.status] || 'transparent'}`,
                        backgroundColor: STATUS_BG[item.status] || 'transparent',
                      }}
                    >
                      <button
                        onClick={() =>
                          onOpenNotes({
                            variant: 'grocery',
                            itemName: item.name,
                            initial: item.notes,
                            onSave: (notes) => {
                              update(item.id, { notes })
                              onOpenNotes(null)
                            },
                          })
                        }
                        className="flex flex-1 items-center gap-1.5 text-left text-sm text-stone-800"
                      >
                        {hasNotes(item.notes) && <Pencil size={11} className="text-stone-500" />}
                        {item.name}
                      </button>
                      <select
                        value={item.status || ''}
                        onChange={(e) => update(item.id, { status: e.target.value })}
                        className="bg-transparent text-xs text-stone-500 outline-none"
                      >
                        <option value="">status</option>
                        <option value="need to buy">need to buy</option>
                        <option value="running low">running low</option>
                        <option value="in stock">in stock</option>
                      </select>
                      {item.qty && <span className="text-sm text-stone-500 tabular-nums">{item.qty}</span>}
                      {item.store && <span className="kicker text-stone-400">{item.store}</span>}
                      <button
                        onClick={() => remove(item.id)}
                        className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
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
}
