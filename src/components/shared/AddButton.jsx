import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X, Plus, Check, CircleCheck, CalendarClock, Utensils, GlassWater, Pill, Target, ShoppingBag, StickyNote } from 'lucide-react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useActivities } from '../../hooks/useActivities'
import { blankActivity } from '../../lib/activities'
import { dateKey } from '../../lib/date'

// ── The universal Add. One + button, always present; one sheet, always the same.
// You say what you're adding, it shows only the fields that matter, and a toast
// tells you exactly where it landed. Pages may still register a full editor via
// useRegisterAdd — the sheet offers it as "Open the full editor" when present.

const AddCtx = createContext(() => {})
const uid = () => Math.random().toString(36).slice(2, 10)

export function useRegisterAdd(handler, deps = []) {
  const register = useContext(AddCtx)
  useEffect(() => {
    register(handler)
    return () => register(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// Legacy chooser kept for pages that still import it.
export function AddChooser({ options, onPick, onClose, recommended }) {
  const base = 'w-full border px-4 py-3 text-left text-sm text-stone-800 transition-colors hover:border-stone-900'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="kicker text-stone-400">Add to your day</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="max-h-[64vh] space-y-2 overflow-y-auto">
          {(options || []).map((o) => (
            <button key={o.id} onClick={() => onPick(o.id)} className={`${base} ${recommended === o.id ? 'border-stone-900' : 'border-stone-300'}`}>
              <span className="font-serif text-lg">{o.label}</span>
              {o.blurb && <span className="block text-xs text-stone-500">{o.blurb}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// What can be added, and the one or two fields each type actually needs.
const TYPES = [
  { id: 'todo', label: 'To-do', icon: CircleCheck },
  { id: 'appt', label: 'Appointment', icon: CalendarClock },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'drink', label: 'Drink', icon: GlassWater },
  { id: 'supp', label: 'Supplement', icon: Pill },
  { id: 'goal', label: 'Goal', icon: Target },
  { id: 'shop', label: 'To buy', icon: ShoppingBag },
  { id: 'note', label: 'Note', icon: StickyNote },
]

const BLOCKS = [
  { id: 'morning', label: 'Morning', part: 'morning' },
  { id: 'daytime', label: 'Daytime', part: 'afternoon' },
  { id: 'evening', label: 'Evening', part: 'evening' },
]
const MEALTIMES = [
  { id: 'empty', label: 'Empty Stomach', food: 'empty', drink: 'emptydrink', supp: 'empty' },
  { id: 'breakfast', label: 'Breakfast', food: 'breakfast', drink: 'drink', supp: 'breakfast' },
  { id: 'lunch', label: 'Lunch', food: 'lunch', drink: 'lunchdrink', supp: 'lunch' },
  { id: 'dinner', label: 'Dinner', food: 'dinner', drink: 'dinnerdrink', supp: 'dinner' },
  { id: 'bed', label: 'Before Bed', food: 'bed', drink: 'beddrink', supp: 'bed' },
]

// Which type the sheet opens on, by where you are in the app.
const PAGE_DEFAULT = {
  today: 'todo', dream: 'goal', menu: 'food',
  skincare: 'todo', haircare: 'todo', fitness: 'todo', workout: 'appt',
  aesthetics: 'appt', diagnostics: 'appt', mindset: 'note',
}

export function AddProvider({ children }) {
  const ref = useRef(null)
  const [hasHandler, setHasHandler] = useState(false)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const register = useCallback((fn) => {
    ref.current = fn
    setHasHandler(!!fn)
  }, [])

  const [activeRaw, setActivePage] = useLocalStorage('mos:active', 'today')
  // The floating + belongs to the home page, where you're adding to the day at
  // large. Inside a pillar you're adding to that section, so the way in lives
  // in the section itself (see AddInline).
  const onHome = (typeof activeRaw === 'string' ? activeRaw : 'today') === 'today'
  const [, setSubs] = useLocalStorage('mos:subpages', {})
  const showToast = (text, dest) => {
    setToast({ text, dest })
    setTimeout(() => setToast(null), 3400)
  }
  const goTo = (dest) => {
    if (!dest) return
    setActivePage(dest.page)
    if (dest.sub) setSubs((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [dest.page]: dest.sub }))
    setToast(null)
  }

  return (
    <AddCtx.Provider value={register}>
      {children}

      {onHome && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Add something"
          title="Add"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: '#1C1C1A', color: '#FAFAF7' }}
        >
          <Plus size={22} strokeWidth={1.75} />
        </button>
      )}

      {open && <QuickAdd onClose={() => setOpen(false)} onDone={showToast} fullEditor={hasHandler ? () => { setOpen(false); ref.current && ref.current() } : null} />}

      {toast && (
        <button onClick={() => goTo(toast.dest)} className="fixed bottom-24 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream shadow-xl transition-transform hover:scale-[1.02]">
          <Check size={14} strokeWidth={2.5} /> {toast.text}
          {toast.dest && <span className="ml-1 border-l border-cream/30 pl-2.5 text-cream/80">View →</span>}
        </button>
      )}
    </AddCtx.Provider>
  )
}

function QuickAdd({ onClose, onDone, fullEditor }) {
  const { add } = useActivities()
  const [activeRaw] = useLocalStorage('mos:active', 'today')
  const [goalsRaw, setGoals] = useLocalStorage('mos:dream:goals', [])
  const [shopRaw, setShop] = useLocalStorage('mos:shopping', [])
  const [notesRaw, setNotes] = useLocalStorage('mos:today:notes-v2', [])

  const [type, setType] = useState(PAGE_DEFAULT[typeof activeRaw === 'string' ? activeRaw : 'today'] || 'todo')
  const [title, setTitle] = useState('')
  const [block, setBlock] = useState('morning')
  const [mealtime, setMealtime] = useState('breakfast')
  const [date, setDate] = useState(dateKey(new Date()))
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 120)
    return () => { document.removeEventListener('keydown', onEsc); clearTimeout(t) }
  }, [onClose])

  const partForTime = (t) => { if (!t) return 'morning'; const h = parseInt(t.slice(0, 2), 10); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening' }
  const mt = MEALTIMES.find((m) => m.id === mealtime) || MEALTIMES[1]
  const blockMeta = BLOCKS.find((b) => b.id === block) || BLOCKS[0]

  const save = () => {
    const t = title.trim()
    if (!t) return
    if (type === 'todo') {
      add(blankActivity('protocol', { title: t, category: 'wellness', frequency: 'daily', seriesStart: dateKey(new Date()), timeOfDay: [blockMeta.part], details: { block } }))
      onDone(`To-do added · ${blockMeta.label}`, { page: 'today' })
    } else if (type === 'appt') {
      add(blankActivity('event', { title: t, category: 'personal', frequency: 'once', seriesStart: date, details: { time: time || '', endTime: time ? (endTime || '') : '', partOfDay: partForTime(time), description: '', attendees: '', durationMinutes: '' } }))
      onDone(`Appointment set · ${date}${time ? ` at ${time}` : ''}`, { page: 'today' })
    } else if (type === 'food' || type === 'drink') {
      add(blankActivity('meal_item', { title: t, category: 'nutrition', frequency: 'daily', details: { slot: type === 'drink' ? mt.drink : mt.food, beverage: type === 'drink' } }))
      onDone(`${type === 'drink' ? 'Drink' : 'Food'} added · ${mt.label}`, { page: 'today' })
    } else if (type === 'supp') {
      add(blankActivity('supplement', { title: t, category: 'supplements', frequency: 'daily', details: { slot: mt.supp, dose: '', unit: 'mg' } }))
      onDone(`Supplement added · ${mt.label}`, { page: 'menu', sub: 'supplements' })
    } else if (type === 'goal') {
      setGoals((prev) => [...(Array.isArray(prev) ? prev : []), { id: uid(), title: t, vision: '', pillar: 'mindset', phase: 'now', target: '', status: 'active', milestones: [] }])
      onDone('Goal added · Dream Planning', { page: 'dream' })
    } else if (type === 'shop') {
      setShop((prev) => [{ id: uid(), text: t, bought: false, addedDate: dateKey(new Date()), boughtDate: '' }, ...(Array.isArray(prev) ? prev : [])])
      onDone('Added to your shopping list', { page: 'today' })
    } else if (type === 'note') {
      setNotes((prev) => [{ id: uid(), title: t, body: '', date: dateKey(new Date()) }, ...(Array.isArray(prev) ? prev : [])])
      onDone("Noted · Today's Notes", { page: 'today' })
    }
    onClose()
  }

  const chip = (on) => `flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pb-1 pt-5">
          <span className="kicker text-stone-400">Add</span>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>

        {/* What is it? — the name comes first, big and serif */}
        <div className="px-6 pt-2">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            placeholder="What are you adding?"
            className="w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-2xl text-stone-900 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-900"
          />
        </div>

        {/* Type chips */}
        <div className="flex flex-wrap gap-1.5 px-6 pt-4">
          {TYPES.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setType(t.id)} className={chip(type === t.id)}>
                <Icon size={13} strokeWidth={1.75} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Only the fields this type needs */}
        <div className="min-h-[64px] px-6 pt-4">
          {type === 'todo' && (
            <div className="flex items-center gap-2">
              <span className="kicker text-stone-400">When</span>
              {BLOCKS.map((b) => <button key={b.id} onClick={() => setBlock(b.id)} className={chip(block === b.id)}>{b.label}</button>)}
            </div>
          )}
          {(type === 'food' || type === 'drink' || type === 'supp') && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="kicker text-stone-400">Mealtime</span>
              {MEALTIMES.map((m) => <button key={m.id} onClick={() => setMealtime(m.id)} className={chip(mealtime === m.id)}>{m.label}</button>)}
            </div>
          )}
          {type === 'appt' && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="kicker text-stone-400">When</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-full border border-stone-300 bg-transparent px-3.5 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-900" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-full border border-stone-300 bg-transparent px-3.5 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-900" />
              {!!time && <>
                <span className="text-xs text-stone-400">to</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-full border border-stone-300 bg-transparent px-3.5 py-1.5 text-xs text-stone-700 outline-none focus:border-stone-900" />
              </>}
            </div>
          )}
          {type === 'goal' && <p className="text-xs italic text-stone-400">It lands on your Dream Planning board — open it there to add the why, milestones, and the plan.</p>}
          {type === 'shop' && <p className="text-xs italic text-stone-400">Straight onto your shopping list.</p>}
          {type === 'note' && <p className="text-xs italic text-stone-400">Kept in Today's Notes with today's date.</p>}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-4">
          {fullEditor ? (
            <button onClick={fullEditor} className="text-xs text-stone-400 underline-offset-2 hover:text-stone-700 hover:underline">Open the full editor</button>
          ) : <span />}
          <button
            onClick={save}
            disabled={!title.trim()}
            className={`rounded-full px-8 py-2.5 text-sm transition-colors ${title.trim() ? 'bg-stone-900 text-cream hover:bg-stone-700' : 'cursor-not-allowed bg-stone-200 text-stone-400'}`}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
