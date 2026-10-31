import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { PILLARS } from '../lib/pillars'
import SwipeAway from './shared/SwipeAway'

// ── The three lists that are not the day.
//
// Everything above these is scheduled: it happens at an hour, or it repeats.
// These three are the opposite — things that are simply owed, with no clock on
// them at all. They share one strip across the full measure and one is open at
// a time, because they are alternatives rather than companions.
//
// The strip carries the name and the count; the list below carries nothing but
// the list. No card head, no number, no right-hand column — the strip has
// already said what this is and how much of it there is. A row comes off the
// list the way it comes off everywhere else — slid aside, not crossed out.

const uid = () => Math.random().toString(36).slice(2, 10)

// The topics a reminder can be filed under: General, and then the twelve the
// index carries, so a reminder is filed where the rest of its subject lives.
export const TOPICS = [{ id: 'general', label: 'General' }, ...PILLARS]
const topicLabel = (id) => (TOPICS.find((t) => t.id === id) || { label: 'General' }).label

const arr = (v) => (Array.isArray(v) ? v : [])

// Ten rows and then a scroll. The height is the rows, not a guess at them.
const PANE = 'mos-scroll max-h-[560px] overflow-y-auto'
const ROW = 'flex items-center gap-4 py-4'
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
        {open ? 'Hide completed' : `Show completed · ${n}`}
      </button>
      {open && <div className="mt-5">{children}</div>}
    </div>
  )
}

// ── Task list.
//
// Things owed, with no due date on any of them. The box is a square hairline
// that fills when it is kept — never a tick icon, and never a colour.
function Tasks() {
  const [raw, setRaw] = useLocalStorage('mos:tasks', [])
  const [showing, setShowing] = useState(false)
  const items = arr(raw)
  const live = items.filter((t) => !t.done)
  const done = items.filter((t) => t.done)

  const toggle = (id) => setRaw((prev) => arr(prev).map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const row = (t) => (
    <SwipeAway
      key={t.id}
      ground={GROUND}
      onAway={() => setRaw((prev) => arr(prev).filter((x) => x.id !== t.id))}
    >
      <div className={ROW}>
        <Box on={t.done} onClick={() => toggle(t.id)} label={t.title} />
        <span className={`min-w-0 flex-1 text-[17px] lowercase leading-snug ${t.done ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{t.title}</span>
      </div>
    </SwipeAway>
  )

  return (
    <div>
      <div className={PANE}>{live.map(row)}</div>
      <AddLine onAdd={(title) => setRaw((prev) => [...arr(prev), { id: uid(), title, topic: 'general', done: false }])} placeholder="Something owed" />
      <Done n={done.length} open={showing} onToggle={() => setShowing((v) => !v)}>
        {done.map(row)}
      </Done>
    </div>
  )
}

// ── Reminders.
//
// Filed by pillar and filtered by it. The only mark a row carries is the one
// the app raised itself — PILLAR · AUTO in the accent. A reminder she wrote
// needs no mark, because the unmarked case is the common one.
function Reminders() {
  const [raw, setRaw] = useLocalStorage('mos:reminders', [])
  const items = arr(raw)
  const [filter, setFilter] = useState('all')
  const [showing, setShowing] = useState(false)

  // General and then all twelve, always — the index does not shrink to fit
  // what happens to be written down today.
  const shown = filter === 'all' ? items : items.filter((r) => (r.topic || 'general') === filter)
  const live = shown.filter((r) => !r.done)
  const done = shown.filter((r) => r.done)
  const row = (r) => (
    <SwipeAway
      key={r.id}
      ground={GROUND}
      onAway={() => setRaw((prev) => arr(prev).filter((x) => x.id !== r.id))}
    >
      <div className={ROW}>
        <Box on={r.done} onClick={() => setRaw((prev) => arr(prev).map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))} label={r.text} />
        <span className={`min-w-0 flex-1 text-[17px] lowercase leading-snug ${r.done ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{r.text}</span>
        {r.auto && (
          <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-cobalt">{topicLabel(r.topic)} · Auto</span>
        )}
      </div>
    </SwipeAway>
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {[{ id: 'all', label: 'All' }, ...TOPICS].map((t) => {
          const on = filter === t.id
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${on ? 'border-cobalt bg-cobalt text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-900'}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div className={PANE}>{live.map(row)}</div>
      <AddLine
        onAdd={(text) => setRaw((prev) => [...arr(prev), { id: uid(), text, topic: filter === 'all' ? 'general' : filter, auto: false }])}
        placeholder="A reminder"
      />
      <Done n={done.length} open={showing} onToggle={() => setShowing((v) => !v)}>
        {done.map(row)}
      </Done>
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
        <span className={`min-w-0 flex-1 text-[17px] lowercase leading-snug ${it.bought ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{it.text}</span>
      </div>
    </SwipeAway>
  )

  return (
    <div>
      <div className={PANE}>{live.map(row)}</div>
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
const TABS = [
  { id: 'tasks', label: 'Task list', Panel: Tasks },
  { id: 'reminders', label: 'Reminders', Panel: Reminders },
  { id: 'shopping', label: 'Shopping list', Panel: Shopping },
]

export default function DayLists() {
  const [tab, setTab] = useLocalStorage('mos:daylists:tab', 'tasks')
  const [tasks] = useLocalStorage('mos:tasks', [])
  const [reminders] = useLocalStorage('mos:reminders', [])
  const [shopping] = useLocalStorage('mos:shopping', [])

  // Each count is what is still owed, which is the same thing the list now
  // shows: a kept line is off both.
  const counts = {
    tasks: arr(tasks).filter((t) => !t.done).length,
    reminders: arr(reminders).filter((r) => !r.done).length,
    shopping: arr(shopping).filter((it) => !it.bought).length,
  }

  const active = TABS.find((t) => t.id === tab) || TABS[0]
  const Panel = active.Panel

  return (
    <section className="mt-10">
      <div className="grid grid-cols-3 border-b border-stone-300">
        {TABS.map((t) => {
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
      </div>
      {/* Each list sits on its own panel — a step down from the page ground,
          the way the three specimens are drawn. The strip stays on the page
          above it; the box holds the list itself. */}
      <div className="mt-8 px-6 py-8 md:px-10 md:py-10" style={{ backgroundColor: '#EEEAE1' }}>
        <Panel />
      </div>
    </section>
  )
}
