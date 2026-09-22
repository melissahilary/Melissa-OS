import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { ACTIVITY_CATEGORIES } from '../lib/activities'

// ── The three lists that are not the day.
//
// Everything above these is scheduled: it happens at an hour, or it repeats.
// These three are the opposite — things that are simply owed, with no clock on
// them at all. They share one strip and one at a time is open, because they
// are alternatives rather than companions: she is either working the tasks,
// the reminders or the list, never three at once.
//
// Ten rows, then it scrolls. A pane taller than the screen is not a list, it
// is the whole thing with a heading on it.

const uid = () => Math.random().toString(36).slice(2, 10)

// The topics a reminder can be filed under: General, and then the pillars —
// the same twelve the index carries, so a reminder is filed where the rest of
// its subject already lives.
export const TOPICS = [
  { id: 'general', label: 'General' },
  ...ACTIVITY_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  { id: 'house', label: 'House' },
]
const topicLabel = (id) => (TOPICS.find((t) => t.id === id) || { label: 'General' }).label

const COUNT_WORD = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const said = (n) => (n <= 10 ? COUNT_WORD[n] : String(n))

// Ten rows and then a scroll. The height is the rows, not a guess at them.
const PANE = 'mos-scroll max-h-[560px] overflow-y-auto'

// The head of a list: its number and name at the left, what is in it at the
// right. The same line every one of the three wears.
function Head({ no, name, right }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-6">
      <span className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{no} · {name}</span>
      <span className="text-right text-[10px] uppercase tracking-[0.16em] text-stone-500">{right}</span>
    </div>
  )
}

// The way in, at the foot of every list: a rule, and one cobalt mark centred
// under it. Never a filled button — the lists are ledgers, not forms.
function AddLine({ onAdd, placeholder }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const commit = () => {
    const t = draft.trim()
    if (!t) { setOpen(false); return }
    onAdd(t)
    setDraft('')
  }
  return (
    <div className="border-t border-stone-200 pt-3">
      {open ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(''); setOpen(false) } }}
          onBlur={commit}
          placeholder={placeholder}
          className="w-full bg-transparent pb-1 text-[15px] outline-none placeholder:text-stone-400"
        />
      ) : (
        <button onClick={() => setOpen(true)} aria-label={placeholder} className="mx-auto block px-4 py-1 text-lg leading-none text-cobalt transition-opacity hover:opacity-60">+</button>
      )}
    </div>
  )
}

// ── 02 · Task list.
//
// Things owed, with no due date on any of them. The box is a square hairline
// that fills when it is kept — never a tick icon, and never a colour.
function Tasks() {
  const [raw, setRaw] = useLocalStorage('mos:tasks', [])
  const items = Array.isArray(raw) ? raw : []
  const open = items.filter((t) => !t.done).length

  const add = (title) => setRaw((prev) => [...(Array.isArray(prev) ? prev : []), { id: uid(), title, topic: 'general', done: false }])
  const toggle = (id) => setRaw((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const retopic = (id, topic) => setRaw((prev) => (Array.isArray(prev) ? prev : []).map((t) => (t.id === id ? { ...t, topic } : t)))

  return (
    <div>
      <Head no="02" name="Task list" right={`${said(open)} open · no due dates`} />
      <div className={PANE}>
        {items.length === 0 ? (
          <p className="py-2 text-sm italic text-stone-400">Nothing owed.</p>
        ) : items.map((t) => (
          <div key={t.id} className="flex items-center gap-4 border-b border-stone-200 py-3.5">
            <button
              onClick={() => toggle(t.id)}
              aria-pressed={!!t.done}
              aria-label={t.title}
              className={`h-[15px] w-[15px] shrink-0 border transition-colors ${t.done ? 'border-stone-700 bg-stone-700' : 'border-stone-400 hover:border-stone-900'}`}
            />
            <span className={`min-w-0 flex-1 text-[17px] leading-snug ${t.done ? 'text-stone-500 line-through' : 'text-stone-900'}`}>{t.title}</span>
            <select
              value={t.topic || 'general'}
              onChange={(e) => retopic(t.id, e.target.value)}
              aria-label={`Pillar for ${t.title}`}
              className="shrink-0 cursor-pointer appearance-none bg-transparent text-right text-[10px] uppercase tracking-[0.14em] text-stone-500 outline-none transition-colors hover:text-stone-900"
            >
              {TOPICS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <AddLine onAdd={add} placeholder="Something owed" />
    </div>
  )
}

// ── 03 · Reminders.
//
// Filed by pillar, and filtered by it. A reminder the app raised itself is
// marked AUTO in the accent; one she wrote is not marked at all, because the
// unmarked case is the common one and does not need a word.
function Reminders() {
  const [raw, setRaw] = useLocalStorage('mos:reminders', [])
  const items = Array.isArray(raw) ? raw : []
  const [filter, setFilter] = useState('all')

  // Only the topics that are actually in use, plus General — a filter row of
  // fourteen chips over a list of nine is a menu, not a filter.
  const used = TOPICS.filter((t) => t.id === 'general' || items.some((r) => r.topic === t.id))
  const shown = filter === 'all' ? items : items.filter((r) => (r.topic || 'general') === filter)

  const add = (text) => setRaw((prev) => [...(Array.isArray(prev) ? prev : []), { id: uid(), text, topic: filter === 'all' ? 'general' : filter, auto: false }])
  const drop = (id) => setRaw((prev) => (Array.isArray(prev) ? prev : []).filter((r) => r.id !== id))

  return (
    <div>
      <Head no="03" name="Reminders" right={`${said(items.length)} · ${filter === 'all' ? 'all pillars' : topicLabel(filter)}`} />
      <div className="mb-5 flex flex-wrap gap-2">
        {[{ id: 'all', label: 'All' }, ...used].map((t) => {
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
        {shown.length === 0 ? (
          <p className="py-2 text-sm italic text-stone-400">Nothing here.</p>
        ) : shown.map((r) => (
          <div key={r.id} className="group flex items-center gap-4 border-b border-stone-200 py-3.5">
            <span className="min-w-0 flex-1 text-[17px] leading-snug text-stone-900">{r.text}</span>
            <span className={`shrink-0 text-[10px] uppercase tracking-[0.14em] ${r.auto ? 'text-cobalt' : 'text-stone-500'}`}>
              {topicLabel(r.topic)}{r.auto ? ' · Auto' : ''}
            </span>
            <button onClick={() => drop(r.id)} aria-label={`Remove ${r.text}`} className="shrink-0 text-stone-300 transition-colors hover:text-stone-900 sm:opacity-0 sm:group-hover:opacity-100">×</button>
          </div>
        ))}
      </div>
      <AddLine onAdd={add} placeholder="A reminder" />
    </div>
  )
}

// ── 04 · Shopping list.
//
// One running list, anything at all, the quantity right, struck through when
// got. It keeps the store the old list at the foot of the page used, so
// nothing already written down is lost — it has only gained a quantity.
function Shopping() {
  const [raw, setRaw] = useLocalStorage('mos:shopping', [])
  const items = Array.isArray(raw) ? raw : []
  const todayKey = dateKey(new Date())
  const live = items.filter((it) => !it.bought || it.boughtDate === todayKey)
  const ordered = [...live.filter((it) => !it.bought), ...live.filter((it) => it.bought)]

  const add = (text) => setRaw((prev) => [{ id: uid(), text, qty: '', bought: false, addedDate: todayKey, boughtDate: '' }, ...(Array.isArray(prev) ? prev : [])])
  const toggle = (id) => setRaw((prev) => (Array.isArray(prev) ? prev : []).map((it) => (
    it.id === id ? { ...it, bought: !it.bought, boughtDate: !it.bought ? todayKey : '' } : it)))
  const setQty = (id, qty) => setRaw((prev) => (Array.isArray(prev) ? prev : []).map((it) => (it.id === id ? { ...it, qty } : it)))

  return (
    <div>
      <Head no="04" name="Shopping list" right={`${said(ordered.length)} · running`} />
      <div className={PANE}>
        {ordered.length === 0 ? (
          <p className="py-2 text-sm italic text-stone-400">Nothing on the list.</p>
        ) : ordered.map((it) => (
          <div key={it.id} className="flex items-center gap-4 border-b border-stone-200 py-3.5">
            <button
              onClick={() => toggle(it.id)}
              aria-pressed={!!it.bought}
              className={`min-w-0 flex-1 text-left text-[17px] leading-snug transition-colors ${it.bought ? 'text-stone-500 line-through' : 'text-stone-900'}`}
            >
              {it.text}
            </button>
            {/* The quantity is right, and it is typed straight onto the line —
                a separate field for "2 bunches" would be a form. */}
            <input
              value={it.qty || ''}
              onChange={(e) => setQty(it.id, e.target.value)}
              placeholder="—"
              aria-label={`How much ${it.text}`}
              className={`w-28 shrink-0 bg-transparent text-right text-[10px] uppercase tracking-[0.14em] outline-none placeholder:text-stone-300 ${it.bought ? 'text-stone-400 line-through' : 'text-stone-500'}`}
            />
          </div>
        ))}
      </div>
      <AddLine onAdd={add} placeholder="Anything at all" />
    </div>
  )
}

const TABS = [
  { id: 'tasks', label: 'Task list', Panel: Tasks },
  { id: 'reminders', label: 'Reminders', Panel: Reminders },
  { id: 'shopping', label: 'Shopping list', Panel: Shopping },
]

export default function DayLists() {
  const [tab, setTab] = useLocalStorage('mos:daylists:tab', 'tasks')
  const active = TABS.find((t) => t.id === tab) || TABS[0]
  const Panel = active.Panel
  return (
    <section className="mt-9">
      {/* One at a time, and the one that is open takes the whole page. They are
          alternatives, not companions. */}
      <div className="mb-7 flex flex-wrap gap-2 border-b border-stone-200 pb-4">
        {TABS.map((t) => {
          const on = t.id === active.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={on ? 'true' : undefined}
              className={`border px-4 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors ${on ? 'border-cobalt bg-cobalt text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-900'}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <Panel />
    </section>
  )
}
