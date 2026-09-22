import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { PILLARS } from '../lib/pillars'

// ── The three lists that are not the day.
//
// Everything above these is scheduled: it happens at an hour, or it repeats.
// These three are the opposite — things that are simply owed, with no clock on
// them at all. They share one strip across the full measure and one is open at
// a time, because they are alternatives rather than companions.
//
// The strip carries the name and the count; the list below carries nothing but
// the list. No card head, no number, no right-hand column — the strip has
// already said what this is and how much of it there is.

const uid = () => Math.random().toString(36).slice(2, 10)

// The topics a reminder can be filed under: General, and then the twelve the
// index carries, so a reminder is filed where the rest of its subject lives.
export const TOPICS = [{ id: 'general', label: 'General' }, ...PILLARS]
const topicLabel = (id) => (TOPICS.find((t) => t.id === id) || { label: 'General' }).label

const arr = (v) => (Array.isArray(v) ? v : [])

// Ten rows and then a scroll. The height is the rows, not a guess at them.
const PANE = 'mos-scroll max-h-[560px] overflow-y-auto'
const ROW = 'flex items-center gap-4 border-b border-stone-200 py-3.5'

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
    const t = draft.trim()
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
          className="min-w-0 flex-1 bg-transparent text-[17px] leading-snug outline-none placeholder:text-stone-400"
        />
      </div>
    )
  }
  return (
    <button onClick={() => setOpen(true)} aria-label={placeholder} className="mx-auto mt-3 block px-4 py-1 text-lg leading-none text-cobalt transition-opacity hover:opacity-60">+</button>
  )
}

// ── Task list.
//
// Things owed, with no due date on any of them. The box is a square hairline
// that fills when it is kept — never a tick icon, and never a colour.
function Tasks() {
  const [raw, setRaw] = useLocalStorage('mos:tasks', [])
  const items = arr(raw)

  const toggle = (id) => setRaw((prev) => arr(prev).map((t) => (t.id === id ? { ...t, done: !t.done } : t)))

  return (
    <div>
      <div className={PANE}>
        {items.map((t) => (
          <div key={t.id} className={ROW}>
            <Box on={t.done} onClick={() => toggle(t.id)} label={t.title} />
            <span className={`min-w-0 flex-1 text-[17px] leading-snug ${t.done ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{t.title}</span>
          </div>
        ))}
      </div>
      <AddLine onAdd={(title) => setRaw((prev) => [...arr(prev), { id: uid(), title, topic: 'general', done: false }])} placeholder="Something owed" />
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

  // General and then all twelve, always — the index does not shrink to fit
  // what happens to be written down today.
  const shown = filter === 'all' ? items : items.filter((r) => (r.topic || 'general') === filter)

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
      <div className={PANE}>
        {shown.map((r) => (
          <div key={r.id} className={`group ${ROW}`}>
            <Box on={r.done} onClick={() => setRaw((prev) => arr(prev).map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))} label={r.text} />
            <span className={`min-w-0 flex-1 text-[17px] leading-snug ${r.done ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{r.text}</span>
            {r.auto && (
              <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-cobalt">{topicLabel(r.topic)} · Auto</span>
            )}
            <button onClick={() => setRaw((prev) => arr(prev).filter((x) => x.id !== r.id))} aria-label={`Remove ${r.text}`} className="shrink-0 text-stone-300 transition-colors hover:text-stone-900 sm:opacity-0 sm:group-hover:opacity-100">×</button>
          </div>
        ))}
      </div>
      <AddLine
        onAdd={(text) => setRaw((prev) => [...arr(prev), { id: uid(), text, topic: filter === 'all' ? 'general' : filter, auto: false }])}
        placeholder="A reminder"
      />
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
  const items = arr(raw)
  const todayKey = dateKey(new Date())
  const live = items.filter((it) => !it.bought || it.boughtDate === todayKey)
  const ordered = [...live.filter((it) => !it.bought), ...live.filter((it) => it.bought)]

  const toggle = (id) => setRaw((prev) => arr(prev).map((it) => (
    it.id === id ? { ...it, bought: !it.bought, boughtDate: !it.bought ? todayKey : '' } : it)))

  return (
    <div>
      <div className={PANE}>
        {ordered.map((it) => (
          <div key={it.id} className={ROW}>
            <Box on={it.bought} onClick={() => toggle(it.id)} label={it.text} />
            <span className={`min-w-0 flex-1 text-[17px] leading-snug ${it.bought ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{it.text}</span>
          </div>
        ))}
      </div>
      <AddLine
        onAdd={(text) => setRaw((prev) => [{ id: uid(), text, bought: false, addedDate: todayKey, boughtDate: '' }, ...arr(prev)])}
        placeholder="Anything at all"
      />
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
  const todayKey = dateKey(new Date())

  const counts = {
    tasks: arr(tasks).filter((t) => !t.done).length,
    reminders: arr(reminders).filter((r) => !r.done).length,
    shopping: arr(shopping).filter((it) => !it.bought || it.boughtDate === todayKey).length,
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
