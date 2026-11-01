import React, { useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { PILLARS } from '../lib/pillars'
import SwipeAway, { OXBLOOD } from './shared/SwipeAway'

// ── The lists that are not the day.
//
// Everything above these is scheduled: it happens at an hour, or it repeats.
// These are the opposite — things that are simply owed, or wanted, or thought
// of, with no clock on them at all. They share one strip across the full
// measure and one is open at a time, because they are alternatives rather
// than companions.
//
// The strip carries the name and the count; the list below carries nothing but
// the list. No card head, no number, no right-hand column — the strip has
// already said what this is and how much of it there is. A row comes off the
// list the way it comes off everywhere else — slid aside, not crossed out.

const uid = () => Math.random().toString(36).slice(2, 10)

// The topics a reminder is filed under: General, and then the twelve the index
// carries. Nothing on this page prints them any more — the lists read the same
// as one another — but a reminder the app raises itself is still filed where
// the rest of its subject lives.
export const TOPICS = [{ id: 'general', label: 'General' }, ...PILLARS]

const arr = (v) => (Array.isArray(v) ? v : [])

// Three rows and then a scroll. The row is given a height rather than left to
// work one out, so three of them is a number and not a guess — a fraction of a
// row at the foot of a list reads as a mistake. No bar drawn either, for the same reason the
// routines draw none: the rail is the thing, not its furniture.
// Written out rather than worked out: the stylesheet is built by reading
// these files for class names, and a name assembled at run time is a name it
// never sees. Three rows of 55 is 165.
const PANE = 'no-scrollbar max-h-[165px] overflow-y-auto'
// The lists sit inside a rail that snaps sideways, and a drag that begins on
// a row has two readings: turn the page, or scroll the list. Saying pan-y on
// the pane settles it in the list's favour, which is the one she means when
// her finger is on a line of it.
const PANE_STYLE = { touchAction: 'pan-y' }
const ROW = 'flex h-[55px] items-center gap-4'
// The row slides on its own ground, so the red comes up from under it rather
// than through it. Nothing is ruled off from the row above — the space does
// that, and a list of hairlines reads as a form.
const GROUND = '#EEEAE1'

// The one mark of state in all three lists: a square hairline that fills when
// it is kept, got, or done with. Never a tick icon, and never a colour.
function Box({ on, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={!!on}
      aria-label={label}
      className={`h-[15px] w-[15px] shrink-0 border transition-colors ${on ? 'border-stone-700 bg-stone-700' : 'border-stone-400 hover:border-stone-900'}`}
    />
  )
}

// The way in, at the foot of every list: one cobalt mark under the last rule.
// Opened, it is not a form underneath the list — it is the next row of it,
// wearing the same empty box, so what she types looks like what it is about
// to become. Never a filled button; the lists are ledgers.
function AddLine({ onAdd, placeholder }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const commit = () => {
    const t = draft.trim().toLowerCase()
    if (!t) { setOpen(false); return }
    onAdd(t)
    setDraft('')
  }
  if (open) {
    return (
      <div className={ROW}>
        <span aria-hidden className="h-[15px] w-[15px] shrink-0 border border-stone-300" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(''); setOpen(false) } }}
          onBlur={commit}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          data-no-dictation
          className="min-w-0 flex-1 bg-transparent text-[17px] lowercase leading-snug outline-none placeholder:text-stone-400"
        />
      </div>
    )
  }
  return (
    <button onClick={() => setOpen(true)} aria-label={placeholder} className="mx-auto mt-3 block px-6 py-2 text-[30px] leading-none text-cobalt transition-opacity hover:opacity-60">+</button>
  )
}

// ── What is already done.
//
// A kept line leaves the list: the point of a list is what is left on it, and
// a day's worth of struck-through rows is a day's worth of nothing to do. It
// is not gone, though — the line at the foot says how many there are and
// brings them back for as long as she wants to look at them.
function Done({ n, open, onToggle, children }) {
  if (!n) return null
  return (
    <div className="mt-7">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="mx-auto block kicker text-stone-400 underline underline-offset-[6px] transition-colors hover:text-stone-700"
      >
        {open ? 'Hide completed' : `Show completed (${n})`}
      </button>
      {open && <div className="mt-5">{children}</div>}
    </div>
  )
}

// ── A plain list.
//
// Task list, reminders, wishlist, ideas, follow ups: the same list each time —
// a box, a line, slid aside to take it off, and what is kept folded away under
// the count. They differ only in what they are called and where they are kept,
// so they are one component and not five.
function Plain({ storeKey, field, placeholder }) {
  const [raw, setRaw] = useLocalStorage(storeKey, [])
  const [showing, setShowing] = useState(false)
  const [open, setOpen] = useState(null) // the line being opened
  const items = arr(raw)
  const live = items.filter((x) => !x.done)
  const done = items.filter((x) => x.done)

  const row = (x) => (
    <SwipeAway
      key={x.id}
      ground={GROUND}
      onAway={() => setRaw((prev) => arr(prev).filter((y) => y.id !== x.id))}
    >
      <div className={ROW}>
        <Box
          on={x.done}
          onClick={() => setRaw((prev) => arr(prev).map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)))}
          label={x[field]}
        />
        <Line
          value={x[field]}
          done={x.done}
          onChange={(t) => setRaw((prev) => arr(prev).map((y) => (y.id === x.id ? { ...y, [field]: t } : y)))}
          onOpen={() => setOpen(x)}
        />
      </div>
    </SwipeAway>
  )

  return (
    <div>
      <div className={PANE} style={PANE_STYLE}>{live.map(row)}</div>
      <AddLine
        onAdd={(t) => setRaw((prev) => [...arr(prev), { id: uid(), [field]: t, topic: 'general', done: false }])}
        placeholder={placeholder}
      />
      <Done n={done.length} open={showing} onToggle={() => setShowing((v) => !v)}>
        {done.map(row)}
      </Done>
      {open && (
        <OpenLine
          line={open}
          field={field}
          onSave={(text, note) => {
            setRaw((prev) => arr(prev).map((y) => (y.id === open.id ? { ...y, [field]: text, notes: note } : y)))
            setOpen(null)
          }}
          onDrop={() => { setRaw((prev) => arr(prev).filter((y) => y.id !== open.id)); setOpen(null) }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

// ── The line itself, written on where it lies.
//
// It was a button: press it and a sheet came up to change a word in. On a
// desk that is the wrong instrument — the line is text, and text is edited by
// putting the cursor in it, dragging across a phrase and typing over it. So
// the line is the field. What is typed is kept as it is typed; there is no
// save, because a list is not a form.
//
// The sheet is still there for everything a line cannot hold — the notes —
// and it opens on a double click, or on a press held down on a phone.
function Line({ value, done, onChange, onOpen }) {
  const hold = useRef(0)
  const press = () => { clearTimeout(hold.current); hold.current = setTimeout(onOpen, 550) }
  const let_go = () => clearTimeout(hold.current)
  return (
    <input
      value={value || ''}
      // What she typed, exactly as she typed it. Lower-casing it on the way
      // through means React writes back a different string from the one in
      // the field, and the caret is thrown to the end on every keystroke —
      // so a word changed in the middle of a line ends up at the end of it.
      // The case is settled when she leaves the line; the page has shown it
      // in lower case all along.
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(e.target.value.trim().toLowerCase())}
      onDoubleClick={onOpen}
      onTouchStart={press}
      onTouchEnd={let_go}
      onTouchMove={let_go}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      data-no-dictation
      data-no-swipe
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className={`min-w-0 flex-1 bg-transparent text-[17px] lowercase leading-snug outline-none ${done ? 'text-stone-500 line-through' : 'text-stone-900'}`}
    />
  )
}

// ── A line, opened.
//
// The same room as everything else that opens on this page, in the same
// brown: the line itself, somewhere to say more about it, and the three ways
// out. A list that cannot be corrected is a list she stops trusting.
function OpenLine({ line, field, onSave, onDrop, onClose }) {
  const [text, setText] = useState(line[field] || '')
  const [note, setNote] = useState(line.notes || '')
  const save = () => { const t = text.trim().toLowerCase(); if (!t) return; onSave(t, note) }
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ background: 'rgba(22,19,15,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="mos-scroll max-h-[calc(88vh_-_var(--mos-kb))] w-full max-w-md overflow-y-auto px-7 pb-9 pt-8 sm:px-9"
        style={{ background: '#68472C', color: '#F7F4ED' }}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          data-no-dictation
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
          className="w-full border-b border-cream/30 bg-transparent pb-2 font-serif text-[30px] lowercase text-cream outline-none"
        />

        <label className="mt-8 block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">Notes</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            placeholder="Anything worth remembering about it."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-no-dictation
            className="mos-scroll mt-3 block min-h-[150px] w-full resize-y border-b border-cream/30 bg-transparent pb-3 text-[16px] lowercase leading-relaxed text-cream outline-none placeholder:text-cream/35"
          />
        </label>

        <div className="mt-9 flex items-center justify-between gap-6">
          <button onClick={onDrop} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70" style={{ color: OXBLOOD }}>Delete</button>
          <div className="flex items-center gap-7">
            <button onClick={onClose} className="text-[10px] uppercase tracking-[0.22em] text-cream/60 transition-opacity hover:opacity-70">Cancel</button>
            <button onClick={save} className="text-[10px] uppercase tracking-[0.22em] text-cream transition-opacity hover:opacity-70">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shopping list.
//
// One running list, anything at all, struck through when got. No quantities and
// no measurements — the line says what it is. It keeps the store the old list
// at the foot of the page used, so nothing already written down is lost.
function Shopping() {
  const [raw, setRaw] = useLocalStorage('mos:shopping', [])
  const [showing, setShowing] = useState(false)
  const items = arr(raw)
  const todayKey = dateKey(new Date())
  const here = items.filter((it) => !it.bought || it.boughtDate === todayKey)
  const live = here.filter((it) => !it.bought)
  const done = here.filter((it) => it.bought)

  const toggle = (id) => setRaw((prev) => arr(prev).map((it) => (
    it.id === id ? { ...it, bought: !it.bought, boughtDate: !it.bought ? todayKey : '' } : it)))
  const row = (it) => (
    <SwipeAway
      key={it.id}
      ground={GROUND}
      onAway={() => setRaw((prev) => arr(prev).filter((x) => x.id !== it.id))}
    >
      <div className={ROW}>
        <Box on={it.bought} onClick={() => toggle(it.id)} label={it.text} />
        <Line
          value={it.text}
          done={it.bought}
          onChange={(t) => setRaw((prev) => arr(prev).map((y) => (y.id === it.id ? { ...y, text: t } : y)))}
          onOpen={() => {}}
        />
      </div>
    </SwipeAway>
  )

  return (
    <div>
      <div className={PANE} style={PANE_STYLE}>{live.map(row)}</div>
      <AddLine
        onAdd={(text) => setRaw((prev) => [{ id: uid(), text, bought: false, addedDate: todayKey, boughtDate: '' }, ...arr(prev)])}
        placeholder="Anything at all"
      />
      <Done n={done.length} open={showing} onToggle={() => setShowing((v) => !v)}>
        {done.map(row)}
      </Done>
    </div>
  )
}

// ── The strip.
//
// Three names spread evenly across the full measure, each with its count set
// beneath it in the same scale contrast the readings above use. The one that
// is open carries a cobalt rule under its whole third; the others carry the
// hairline. Nothing else distinguishes them — no box, no fill.
//
// There are six lists and three places, so the strip turns: a chevron at its
// end brings the next three, drawn the way everything pressed in this house is
// drawn. Turning it only changes what she can see — the list she had open
// stays open until she picks another.
const TABS = [
  { id: 'tasks', label: 'Task list', key: 'mos:tasks', field: 'title', placeholder: 'Something owed' },
  { id: 'reminders', label: 'Reminders', key: 'mos:reminders', field: 'text', placeholder: 'A reminder' },
  { id: 'shopping', label: 'Shopping list', shopping: true },
  { id: 'wishlist', label: 'Wishlist', key: 'mos:wishlist', field: 'text', placeholder: 'Something wanted' },
  { id: 'ideas', label: 'Ideas', key: 'mos:ideas', field: 'text', placeholder: 'An idea' },
  { id: 'followups', label: 'Follow ups', key: 'mos:followups', field: 'text', placeholder: 'Someone to come back to' },
]
const PER = 3
const PAGES = Math.ceil(TABS.length / PER)

// The way to the rest of them, built as a fourth name on the strip rather than
// as a control hung off its end. A bordered square beside three columns of
// type was a form field standing next to a masthead; this is the same two
// lines the other three are — a name, and under it where their counts sit, the
// chevron drawn at the weight of a numeral.
function Turn({ back, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={back ? 'The first three lists' : 'The other lists'}
      className="group -mb-px border-b-2 border-transparent pb-4 pl-4 text-right transition-colors hover:border-stone-400"
    >
      <span className="kicker block text-stone-500 transition-colors group-hover:text-stone-900">{back ? 'Back' : 'More'}</span>
      <span className="mt-2 flex h-[30px] items-center justify-end text-stone-400 transition-colors group-hover:text-stone-900">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className={back ? '' : 'rotate-180'}>
          <path d="M15 4 L7 12 L15 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
      </span>
    </button>
  )
}

export default function DayLists() {
  const [tab, setTab] = useLocalStorage('mos:daylists:tab', 'tasks')
  const [tasks] = useLocalStorage('mos:tasks', [])
  const [reminders] = useLocalStorage('mos:reminders', [])
  const [shopping] = useLocalStorage('mos:shopping', [])
  const [wishlist] = useLocalStorage('mos:wishlist', [])
  const [ideas] = useLocalStorage('mos:ideas', [])
  const [followups] = useLocalStorage('mos:followups', [])

  // Each count is what is still owed, which is the same thing the list shows:
  // a kept line is off both.
  const left = (v) => arr(v).filter((x) => !x.done).length
  const counts = {
    tasks: left(tasks),
    reminders: left(reminders),
    shopping: arr(shopping).filter((it) => !it.bought).length,
    wishlist: left(wishlist),
    ideas: left(ideas),
    followups: left(followups),
  }

  const active = TABS.find((t) => t.id === tab) || TABS[0]
  const at = TABS.indexOf(active)
  // Open on the page the open list is on.
  const [page, setPage] = useState(Math.max(0, Math.floor(at / PER)))
  const shown = TABS.slice(page * PER, page * PER + PER)

  return (
    <section className="mt-10">
      <div className={`grid border-b border-stone-300 ${PAGES > 1 ? 'grid-cols-[1fr_1fr_1fr_auto]' : 'grid-cols-3'}`}>
        {shown.map((t) => {
          const on = t.id === active.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={on ? 'true' : undefined}
              className={`-mb-px border-b-2 pb-4 pr-4 text-left transition-colors ${on ? 'border-cobalt' : 'border-transparent hover:border-stone-400'}`}
            >
              <span className={`kicker block ${on ? 'text-stone-900' : 'text-stone-500'}`}>{t.label}</span>
              <span className={`mt-2 block font-serif text-[30px] leading-none ${on ? 'text-stone-900' : 'text-stone-400'}`}>{counts[t.id]}</span>
            </button>
          )
        })}
        {PAGES > 1 && <Turn back={page > 0} onClick={() => setPage((p) => (p + 1) % PAGES)} />}
      </div>
      {/* Each list sits on its own panel — a step down from the page ground,
          the way the three specimens are drawn. The strip stays on the page
          above it; the box holds the list itself. */}
      <div className="mt-8 px-6 py-8 md:px-10 md:py-10" style={{ backgroundColor: GROUND }}>
        {active.shopping
          ? <Shopping />
          : <Plain key={active.id} storeKey={active.key} field={active.field} placeholder={active.placeholder} />}
      </div>
    </section>
  )
}
