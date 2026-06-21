import React, { useMemo, useState } from 'react'
import { Plus, X, ChevronLeft, ChevronRight, Pencil, GripVertical } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  phaseFor, PHASE_FOODS, PHASES, INTENTION_FREQ, toLiters,
} from '../lib/cycle'
import {
  dateKey, weekDays, weekRangeLabel, addDays, isSameDay, DOW,
} from '../lib/date'
import { categorize, GROCERY_CATEGORIES } from '../lib/groceryCategories'
import SectionTitle from './shared/SectionTitle'
import FreqPicker from './shared/FreqPicker'
import NotesPopup, { hasNotes } from './shared/NotesPopup'
import ScopePrompt from './shared/ScopePrompt'
import Recipes from './Recipes'

const uid = () => Math.random().toString(36).slice(2, 10)

const SLOTS = [
  { id: 'empty', label: 'Empty stomach', supps: true, tint: '#F0EBE2' },
  { id: 'breakfast', label: 'Breakfast', supps: true, tint: '#EDE7DD' },
  { id: 'snack1', label: 'Snack', supps: false, tint: '#F5F0EA' },
  { id: 'lunch', label: 'Lunch', supps: true, tint: '#EDE7DD' },
  { id: 'snack2', label: 'Snack', supps: false, tint: '#F5F0EA' },
  { id: 'dinner', label: 'Dinner', supps: true, tint: '#EDE7DD' },
  { id: 'bed', label: 'Before bed', supps: true, tint: '#F0EBE2' },
]

export default function MealPlanning({ cycleConfig, subPage = 'planner' }) {
  const [anchor, setAnchor] = useState(new Date())
  const days = useMemo(() => weekDays(anchor), [anchor])
  const today = new Date()

  const [weekPlan, setWeekPlan] = useLocalStorage('mos:menu:weekplan', {})
  const [hydration, setHydration] = useLocalStorage('mos:menu:hydration', {})

  // Universal notes popup + recurrence scope prompt state.
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

  const phaseLabelFor = (date) => {
    const p = phaseFor(date, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
    return p ? `${p.name} · Day ${p.cycleDay}` : ''
  }

  // ── mutate a single slot's list ──
  const mutateSlot = (key, slotId, listKey, fn) => {
    setWeekPlan((prev) => {
      const day = prev[key] || {}
      const slot = day[slotId] || { foods: [], supps: [] }
      return { ...prev, [key]: { ...day, [slotId]: { ...slot, [listKey]: fn(slot[listKey] || []) } } }
    })
  }

  // ── apply a remove/update across dates per recurrence scope ──
  const applyScoped = (scopeChoice, ctx, op) => {
    const { key, slotId, listKey, item } = ctx
    setWeekPlan((prev) => {
      const next = {}
      Object.keys(prev).forEach((dk) => {
        const day = prev[dk]
        const inScope =
          scopeChoice === 'all' ||
          (scopeChoice === 'following' && dk >= key) ||
          (scopeChoice === 'one' && dk === key)
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

  const addItem = (key, slotId, listKey, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    mutateSlot(key, slotId, listKey, (list) => [
      ...list,
      { id: uid(), name: trimmed, freq: 'daily', days: null, phases: [], notes: {} },
    ])
  }

  // Remove — prompt for scope when the item recurs.
  const removeItem = (key, slotId, listKey, item) => {
    if (item.freq && item.freq !== 'once') {
      setScope({ ctx: { key, slotId, listKey, item }, op: { type: 'remove' }, action: 'remove' })
    } else {
      mutateSlot(key, slotId, listKey, (list) => list.filter((i) => i.id !== item.id))
    }
  }

  // Frequency / day / phase change — prompt for scope when the item recurs.
  const changeItem = (key, slotId, listKey, item, patch) => {
    if (item.freq && item.freq !== 'once') {
      setScope({ ctx: { key, slotId, listKey, item }, op: { type: 'update', patch }, action: 'change' })
    } else {
      mutateSlot(key, slotId, listKey, (list) => list.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))
    }
  }

  // Notes change is always "this event only".
  const setItemNotes = (key, slotId, listKey, id, notes) =>
    mutateSlot(key, slotId, listKey, (list) => list.map((i) => (i.id === id ? { ...i, notes } : i)))

  const reorderItem = (key, slotId, listKey, from, to) =>
    mutateSlot(key, slotId, listKey, (list) => {
      const copy = [...list]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })

  // ── hydration ──
  const setHydrationEntry = (key, slotId, patch) => {
    setHydration((prev) => {
      const day = prev[key] || {}
      const cur = day[slotId] || { amount: '', unit: 'oz', notes: {} }
      return { ...prev, [key]: { ...day, [slotId]: { ...cur, ...patch } } }
    })
  }
  const dayLiters = (key) => {
    const day = hydration[key] || {}
    return Object.values(day).reduce((sum, e) => sum + toLiters(e.amount, e.unit), 0)
  }

  // ── popup openers ──
  const openItemNotes = (key, slotId, listKey, item) => {
    setPopup({
      variant: listKey === 'supps' ? 'supplement' : 'food',
      itemName: item.name,
      initial: item.notes,
      cyclePhaseLabel: phaseLabelFor(days.find((d) => dateKey(d) === key) || today),
      onSave: (notes) => {
        setItemNotes(key, slotId, listKey, item.id, notes)
        setPopup(null)
      },
    })
  }
  const openDrinkNotes = (key, slotId, slotLabel) => {
    const entry = (hydration[key] || {})[slotId] || {}
    setPopup({
      variant: 'drink',
      itemName: `${slotLabel} — drink`,
      initial: entry.notes,
      cyclePhaseLabel: phaseLabelFor(days.find((d) => dateKey(d) === key) || today),
      onSave: (notes) => {
        setHydrationEntry(key, slotId, { notes })
        setPopup(null)
      },
    })
  }

  // ── primary phase across the week ──
  const weekPhase = useMemo(() => {
    if (!cycleConfig.lastPeriodStart) return null
    const counts = {}
    days.forEach((d) => {
      const p = phaseFor(d, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
      if (p) counts[p.id] = (counts[p.id] || 0) + 1
    })
    let bestId = null
    let best = 0
    Object.entries(counts).forEach(([id, n]) => {
      if (n > best) {
        best = n
        bestId = id
      }
    })
    return bestId ? { phase: PHASES[bestId], count: best } : null
  }, [days, cycleConfig.lastPeriodStart, cycleConfig.cycleLength])

  return (
    <div>
      <SectionTitle kicker="01 · Daily Journal" title="Meal Planning." />

      {subPage === 'grocery' && <GroceryList onOpenNotes={setPopup} />}
      {subPage === 'recipes' && <Recipes />}

      {subPage === 'planner' && (
        <>
          {/* ── Weekly Meal Plan ── */}
          <section className="mb-14">
            <PhaseBanner anchor={anchor} setAnchor={setAnchor} weekPhase={weekPhase} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
              {days.map((d) => {
                const key = dateKey(d)
                const isTod = isSameDay(d, today)
                const phase = phaseFor(d, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
                return (
                  <DayCard
                    key={key}
                    date={d}
                    dateKeyStr={key}
                    isToday={isTod}
                    phase={phase}
                    liters={dayLiters(key)}
                    plan={weekPlan[key] || {}}
                    hydration={hydration[key] || {}}
                    history={history}
                    onAdd={addItem}
                    onRemove={removeItem}
                    onChange={changeItem}
                    onReorder={reorderItem}
                    onSetHydration={setHydrationEntry}
                    onOpenItemNotes={openItemNotes}
                    onOpenDrinkNotes={openDrinkNotes}
                  />
                )
              })}
            </div>
          </section>

          {/* Intentions live at the bottom of the planner. */}
          <Intentions />
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

// ── Phase banner ────────────────────────────────────────────────────
function PhaseBanner({ anchor, setAnchor, weekPhase }) {
  return (
    <div className="mb-6 overflow-hidden">
      <div className="flex items-center justify-between bg-stone-900 px-5 py-3 text-cream">
        <button onClick={() => setAnchor(addDays(anchor, -7))} className="text-stone-400 hover:text-cream">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif italic text-xl">Week of {weekRangeLabel(anchor)}</span>
        <button onClick={() => setAnchor(addDays(anchor, 7))} className="text-stone-400 hover:text-cream">
          <ChevronRight size={18} />
        </button>
      </div>

      {weekPhase ? (
        <div className="px-5 py-5" style={{ backgroundColor: weekPhase.phase.color, color: weekPhase.phase.ink }}>
          <div className="flex items-end justify-between gap-4">
            <h3 className="font-serif italic text-3xl md:text-4xl leading-none">{weekPhase.phase.name}.</h3>
            <div className="text-right">
              <p className="kicker opacity-80">{weekPhase.phase.range.toUpperCase()}</p>
              <div className="mt-1.5 flex items-center justify-end gap-2">
                <div className="h-1 w-24 bg-black/20">
                  <div className="h-full bg-current" style={{ width: `${(weekPhase.count / 7) * 100}%` }} />
                </div>
                <span className="text-xs tabular-nums">{weekPhase.count} / 7</span>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t pt-4" style={{ borderColor: 'rgba(0,0,0,0.3)' }}>
            <p className="kicker opacity-80 mb-2">Prioritize this phase</p>
            <p className="text-sm leading-relaxed opacity-95">{PHASE_FOODS[weekPhase.phase.id].join(', ')}.</p>
          </div>
        </div>
      ) : (
        <div className="bg-stone-100 px-5 py-5 text-sm text-stone-500">
          Set your last period start on the Today page to see phase guidance here.
        </div>
      )}
    </div>
  )
}

// ── Day card ────────────────────────────────────────────────────────
function DayCard({
  date, dateKeyStr, isToday, phase, liters, plan, hydration, history,
  onAdd, onRemove, onChange, onReorder, onSetHydration, onOpenItemNotes, onOpenDrinkNotes,
}) {
  return (
    <div className={`border border-stone-200 ${isToday ? 'ring-1 ring-inset ring-stone-900' : ''}`}>
      <div className={`px-3 py-2.5 ${isToday ? 'bg-stone-900 text-cream' : 'bg-white/50 text-stone-900'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className={`kicker ${isToday ? 'text-stone-300' : 'text-stone-400'}`}>{DOW[date.getDay()]}</p>
            <p className="font-serif italic text-2xl leading-none mt-0.5">{date.getDate()}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {liters > 0 && (
              <span className={`text-xs tabular-nums ${isToday ? 'text-sand' : 'text-stone-500'}`}>
                {liters.toFixed(2)}L
              </span>
            )}
            {phase && (
              <span className="flex items-center gap-1 text-[10px]">
                <span>{phase.abbr}</span>
                <span className="opacity-60">{phase.cycleDay}</span>
                <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: phase.color }} />
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        {SLOTS.map((slot) => (
          <MealSlot
            key={slot.id}
            slot={slot}
            dateKeyStr={dateKeyStr}
            foods={(plan[slot.id] && plan[slot.id].foods) || []}
            supps={(plan[slot.id] && plan[slot.id].supps) || []}
            hydra={hydration[slot.id] || { amount: '', unit: 'oz', notes: {} }}
            history={history}
            onAdd={onAdd}
            onRemove={onRemove}
            onChange={onChange}
            onReorder={onReorder}
            onSetHydration={onSetHydration}
            onOpenItemNotes={onOpenItemNotes}
            onOpenDrinkNotes={onOpenDrinkNotes}
          />
        ))}
      </div>
    </div>
  )
}

// ── Meal slot ───────────────────────────────────────────────────────
function MealSlot({
  slot, dateKeyStr, foods, supps, hydra, history,
  onAdd, onRemove, onChange, onReorder, onSetHydration, onOpenItemNotes, onOpenDrinkNotes,
}) {
  return (
    <div className="border-t border-stone-200 px-3 py-2.5" style={{ backgroundColor: slot.tint }}>
      <div className="flex items-start justify-between gap-2">
        <p className="kicker text-stone-500">{slot.label}</p>
        <div className="flex items-center gap-1.5">
          {foods.length > 0 && <span className="text-[10px] text-stone-400">{foods.length}</span>}
          <div className="flex items-center gap-0.5">
            <input
              type="number"
              value={hydra.amount}
              onChange={(e) => onSetHydration(dateKeyStr, slot.id, { amount: e.target.value })}
              placeholder="0"
              className="w-9 bg-white/70 border border-stone-300 px-1 py-0.5 text-[10px] text-right outline-none focus:border-stone-900"
            />
            <select
              value={hydra.unit}
              onChange={(e) => onSetHydration(dateKeyStr, slot.id, { unit: e.target.value })}
              className="bg-white/70 border border-stone-300 px-0.5 py-0.5 text-[10px] outline-none"
            >
              <option value="oz">oz</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
            </select>
            <button
              onClick={() => onOpenDrinkNotes(dateKeyStr, slot.id, slot.label)}
              className="text-stone-400 hover:text-stone-900"
              title="Drink notes"
            >
              <Pencil size={10} className={hasNotes(hydra.notes) ? 'text-stone-900' : ''} />
            </button>
          </div>
        </div>
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
        placeholder="+"
        suggestions={history.foods}
        existing={foods.map((f) => f.name)}
        onCommit={(name) => onAdd(dateKeyStr, slot.id, 'foods', name)}
      />

      {slot.supps && (
        <div className="mt-2 border-t border-stone-300/60 pt-2">
          <p className="kicker text-stone-500 mb-1.5">Supplements</p>
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
            placeholder="+"
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

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
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

// ── Bubble ──────────────────────────────────────────────────────────
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
      <span className="group inline-flex cursor-grab items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[11px] text-cream active:cursor-grabbing">
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
    <span className="group inline-flex cursor-grab items-center gap-1 border border-stone-900 bg-cream px-2 py-0.5 text-[11px] text-stone-900 active:cursor-grabbing">
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
    <div className="relative mt-1">
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
        className="w-full bg-transparent border-b border-stone-300/70 pb-0.5 text-[11px] outline-none focus:border-stone-900"
      />
      {focused && matches.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-0.5 w-full border border-stone-300 bg-cream shadow-lg">
          {matches.map((m) => (
            <button
              key={m}
              onMouseDown={() => commit(m)}
              className="block w-full px-2 py-1 text-left text-[11px] text-stone-700 hover:bg-stone-100"
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Intentions ──────────────────────────────────────────────────────
function Intentions() {
  const [items, setItems] = useLocalStorage('mos:menu:incorporations', [])
  const [draft, setDraft] = useState({ name: '', category: 'food', freq: 'daily' })

  const add = () => {
    if (!draft.name.trim()) return
    setItems((prev) => [...prev, { id: uid(), name: draft.name.trim(), category: draft.category, freq: draft.freq }])
    setDraft({ name: '', category: 'food', freq: 'daily' })
  }
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))
  const update = (id, patch) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  const groups = [
    { key: 'food', label: 'Foods.' },
    { key: 'drink', label: 'Drinks.' },
    { key: 'supplement', label: 'Supplements.' },
  ]

  return (
    <section className="mb-14 border-t border-stone-200 pt-10">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="kicker text-stone-400 mb-2">The intentions</p>
          <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">What I'm bringing into my diet.</h2>
        </div>
        <span className="text-sm text-stone-400">{items.length} on the list</span>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Something new to fold in"
          className="min-w-[200px] flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className="border-b border-stone-300 bg-transparent pb-1.5 text-sm outline-none"
        >
          <option value="food">food</option>
          <option value="supplement">supplement</option>
          <option value="drink">drink</option>
        </select>
        <select
          value={draft.freq}
          onChange={(e) => setDraft({ ...draft, freq: e.target.value })}
          className="border-b border-stone-300 bg-transparent pb-1.5 text-sm outline-none"
        >
          {INTENTION_FREQ.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button onClick={add} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700">
          <Plus size={16} />
        </button>
      </div>

      <div className="space-y-6">
        {groups.map((g) => {
          const list = items.filter((i) => i.category === g.key)
          if (!list.length) return null
          return (
            <div key={g.key}>
              <h3 className="font-serif text-xl text-stone-700 mb-2">{g.label}</h3>
              <div className="divide-y divide-stone-100">
                {list.map((item) => (
                  <div key={item.id} className="group flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-stone-800">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <select
                        value={item.freq}
                        onChange={(e) => update(item.id, { freq: e.target.value })}
                        className="bg-transparent text-xs text-stone-500 outline-none"
                      >
                        {INTENTION_FREQ.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => remove(item.id)}
                        className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Grocery list (date field + auto-categorized) ────────────────────
function GroceryList({ onOpenNotes }) {
  const [items, setItems] = useLocalStorage('mos:menu:groceries', [])
  const [draft, setDraft] = useState({ name: '', qty: '', store: '', date: '' })

  const add = () => {
    if (!draft.name.trim()) return
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        name: draft.name.trim(),
        qty: draft.qty.trim(),
        store: draft.store.trim(),
        date: draft.date,
        category: categorize(draft.name),
        done: false,
        notes: {},
      },
    ])
    setDraft({ name: '', qty: '', store: '', date: '' })
  }
  const toggle = (id) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))
  const clearDone = () => setItems((prev) => prev.filter((i) => !i.done))
  const update = (id, patch) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  const anyDone = items.some((i) => i.done)

  return (
    <section className="mb-10">
      <header className="mb-4 flex items-end justify-between">
        <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900">Grocery list</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-400">{items.length} on the list</span>
          {anyDone && (
            <button onClick={clearDone} className="text-xs text-stone-500 hover:text-stone-900">
              Clear done →
            </button>
          )}
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Item"
          className="min-w-[160px] flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
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
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          className="bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
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
                    <div key={item.id} className="group flex items-center gap-3 py-2.5">
                      <button
                        onClick={() => toggle(item.id)}
                        className={`h-4 w-4 shrink-0 border ${item.done ? 'bg-stone-900 border-stone-900' : 'border-stone-400'}`}
                      />
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
                        className={`flex flex-1 items-center gap-1.5 text-left text-sm ${
                          item.done ? 'text-stone-400 line-through' : 'text-stone-800'
                        }`}
                      >
                        {hasNotes(item.notes) && <Pencil size={11} className="text-stone-500" />}
                        {item.name}
                      </button>
                      {item.date && <span className="text-xs text-stone-400 tabular-nums">{item.date.slice(5)}</span>}
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
