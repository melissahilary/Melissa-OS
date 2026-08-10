import React, { useState } from 'react'
import { X, Plus, Star, ArrowRight, ArrowLeft } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import InlineText from './shared/InlineText'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'
import { dateKey, parseKey, longDate, isSameDay } from '../lib/date'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Mindset({ subPage, cycleConfig }) {
  if (subPage === 'monthly') return <CategoryCalendar category="mindset" cycleConfig={cycleConfig} noun="Practice" />
  if (subPage === 'weekly') return <CategoryWeekly category="mindset" noun="Practice" />
  if (subPage === 'journal') return <Journal />
  return <Influences />
}

// A day's writing is a list of titled entries. Older days saved a single string,
// which we read as one untitled entry (and rewrite as a list on first edit).
const normDay = (raw, key) => {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) return [{ id: `${key}#legacy`, title: '', body: raw }]
  return []
}
const entryHasContent = (e) => (e.title || '').trim() || (e.body || '').trim()

// ── Journal — multiple titled entries per day. Navigate day by day; today opens
// by default. Every title and body autosaves under its date.
function Journal() {
  const today = new Date()
  const [entries, setEntries] = useLocalStorage('mos:mindset:journal', {})
  const store = entries && typeof entries === 'object' ? entries : {}
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const selected = parseKey(selectedKey)
  const isToday = isSameDay(selected, today)

  const dayList = normDay(store[selectedKey], selectedKey)
  // Always show at least one editable entry; its stable id lets it persist on the
  // first keystroke without the field remounting (and losing focus).
  const display = dayList.length ? dayList : [{ id: `${selectedKey}#1`, title: '', body: '' }]

  const shift = (days) => { const d = parseKey(selectedKey); d.setDate(d.getDate() + days); setSelectedKey(dateKey(d)) }
  const setDay = (updater) => setEntries((prev) => {
    const p = prev && typeof prev === 'object' ? prev : {}
    const cur = normDay(p[selectedKey], selectedKey)
    return { ...p, [selectedKey]: typeof updater === 'function' ? updater(cur) : updater }
  })
  const updateEntry = (id, patch) => setDay((cur) => (cur.some((e) => e.id === id)
    ? cur.map((e) => (e.id === id ? { ...e, ...patch } : e))
    : [...cur, { id, title: '', body: '', ...patch }]))
  const addEntry = () => setDay((cur) => [...cur, { id: uid(), title: '', body: '' }])
  const removeEntry = (id) => setDay((cur) => cur.filter((e) => e.id !== id))

  useRegisterAdd(() => addEntry(), [selectedKey])

  // Past days that hold any content, most recent first (excluding the open day).
  const past = Object.keys(store)
    .filter((k) => k !== selectedKey && normDay(store[k], k).some(entryHasContent))
    .sort((a, b) => b.localeCompare(a))

  return (
    <div className="mb-12">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="px-2 text-sm text-stone-500 hover:text-stone-900">Prev</button>
        <div className="text-center">
          <h3 className="font-serif italic text-2xl text-stone-900">{longDate(selected)}</h3>
          {!isToday && <button onClick={() => setSelectedKey(dateKey(today))} className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-700">Back to today</button>}
        </div>
        <button onClick={() => shift(1)} className="px-2 text-sm text-stone-500 hover:text-stone-900">Next</button>
      </div>

      <div className="space-y-5">
        {display.map((e) => (
          <div key={e.id} className="group relative border border-stone-200 bg-white/40 focus-within:border-stone-400">
            {dayList.length > 1 && (
              <button onClick={() => removeEntry(e.id)} className="absolute right-2 top-2.5 z-10 text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100" title="Delete entry"><X size={15} /></button>
            )}
            <input
              value={e.title}
              onChange={(ev) => updateEntry(e.id, { title: ev.target.value })}
              placeholder="Title"
              className="w-full bg-transparent px-5 pt-4 pb-1 pr-9 font-serif text-2xl text-stone-900 placeholder-stone-300 outline-none"
            />
            <textarea
              value={e.body}
              onChange={(ev) => updateEntry(e.id, { body: ev.target.value })}
              placeholder="Dear diary…"
              className="block w-full min-h-[26vh] resize-y bg-transparent px-5 pb-4 font-serif text-lg leading-relaxed text-stone-800 placeholder-stone-300 outline-none"
            />
          </div>
        ))}
      </div>

      <button onClick={addEntry} className="mt-4 flex items-center gap-1.5 text-sm italic text-stone-500 hover:text-stone-900">
        <Plus size={14} /> New entry
      </button>

      {past.length > 0 && (
        <div className="mt-10">
          <p className="kicker text-stone-400 mb-3">Past entries</p>
          <div className="divide-y divide-stone-100">
            {past.map((k) => {
              const list = normDay(store[k], k).filter(entryHasContent)
              const first = list[0]
              return (
                <button key={k} onClick={() => setSelectedKey(k)} className="block w-full py-3 text-left">
                  <p className="kicker text-stone-400">{longDate(parseKey(k))}{list.length > 1 ? ` · ${list.length} entries` : ''}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-stone-600">{(first.title || '').trim() || (first.body || '').trim()}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Influences — a curated spread of what you let shape you. Two facing columns,
// "Let In" and "Keep Out": each influence can carry a type (Person, Podcast,
// Book…), be starred as a non-negotiable, and be moved to the other side as
// your energy shifts. An intention line frames the whole page.
const INFLUENCE_TYPES = ['Person', 'Podcast', 'Book', 'App', 'Practice', 'Space', 'Media']

// Older items were { id, text, done }; keep the text, drop the checkbox meaning.
const normInfluence = (x) => ({ id: x.id || uid(), text: x.text || '', type: x.type || '', star: !!x.star })
const sortInfluences = (arr) => arr.slice().sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0))

function Influences() {
  const [intention, setIntention] = useLocalStorage('mos:mindset:influences:intention', '')
  const [yesRaw, setYes] = useLocalStorage('mos:mindset:influences:yes', [])
  const [noRaw, setNo] = useLocalStorage('mos:mindset:influences:no', [])
  const yes = (Array.isArray(yesRaw) ? yesRaw : []).map(normInfluence)
  const no = (Array.isArray(noRaw) ? noRaw : []).map(normInfluence)
  const setters = { yes: setYes, no: setNo }
  const clean = (p) => (Array.isArray(p) ? p : []).map(normInfluence)

  const add = (side, text = '') => setters[side]((p) => [...clean(p), { id: uid(), text, type: '', star: false }])
  const patch = (side, id, patchObj) => setters[side]((p) => clean(p).map((x) => (x.id === id ? { ...x, ...patchObj } : x)))
  const remove = (side, id) => setters[side]((p) => clean(p).filter((x) => x.id !== id))
  const move = (side, id) => {
    const to = side === 'yes' ? 'no' : 'yes'
    const item = (side === 'yes' ? yes : no).find((x) => x.id === id)
    if (!item) return
    remove(side, id)
    setters[to]((p) => [...clean(p), { ...item }])
  }

  useRegisterAdd(() => add('yes'), [])

  return (
    <div className="mb-16">
      <header className="mb-10 text-center">
        <h2 className="font-serif text-4xl text-stone-900">Influences</h2>
        <p className="mt-1.5 font-serif italic text-lg text-stone-500">What you let shape you.</p>
        <div className="mx-auto mt-3 select-none text-2xl leading-none text-stone-300" style={{ fontFamily: "'Cormorant Garamond', serif" }}>❦</div>
        <input
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder="Set an intention for what you're calling in…"
          className="mx-auto mt-4 block w-full max-w-md bg-transparent text-center font-serif italic text-stone-600 placeholder-stone-300 outline-none"
        />
      </header>

      <div className="grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-stone-200">
        <div className="md:pr-10">
          <InfluenceColumn tone="in" title="Let In" hint="what to invite" items={sortInfluences(yes)}
            onAdd={(t) => add('yes', t)} onPatch={(id, p) => patch('yes', id, p)} onRemove={(id) => remove('yes', id)} onMove={(id) => move('yes', id)} />
        </div>
        <div className="md:pl-10">
          <InfluenceColumn tone="out" title="Keep Out" hint="what to release" items={sortInfluences(no)}
            onAdd={(t) => add('no', t)} onPatch={(id, p) => patch('no', id, p)} onRemove={(id) => remove('no', id)} onMove={(id) => move('no', id)} />
        </div>
      </div>
    </div>
  )
}

function InfluenceColumn({ tone, title, hint, items, onAdd, onPatch, onRemove, onMove }) {
  const [draft, setDraft] = useState('')
  const commit = () => { if (!draft.trim()) return; onAdd(draft.trim()); setDraft('') }
  const cycleType = (it) => {
    const i = INFLUENCE_TYPES.indexOf(it.type)
    const next = i < 0 ? INFLUENCE_TYPES[0] : (i + 1 >= INFLUENCE_TYPES.length ? '' : INFLUENCE_TYPES[i + 1])
    onPatch(it.id, { type: next })
  }
  const MoveIcon = tone === 'in' ? ArrowRight : ArrowLeft
  const out = tone === 'out'

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-xl text-stone-900">{title}</h3>
        <span className="kicker text-stone-400">{items.length ? `${items.length} · ${hint}` : hint}</span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <Plus size={14} className="shrink-0 text-stone-300" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder={out ? 'Something to keep out' : 'Something to let in'}
          className="flex-1 bg-transparent border-b border-stone-200 pb-1.5 text-sm outline-none placeholder-stone-300 focus:border-stone-900"
        />
      </div>

      <div>
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-2.5 border-b border-stone-100 py-2.5">
            <button
              onClick={() => onPatch(it.id, { star: !it.star })}
              title={it.star ? 'Un-anchor' : 'Anchor as non-negotiable'}
              className={`shrink-0 transition-colors ${it.star ? 'text-stone-700' : 'text-stone-300 hover:text-stone-500'}`}
            >
              <Star size={15} strokeWidth={1.75} fill={it.star ? 'currentColor' : 'none'} />
            </button>

            <InlineText
              value={it.text}
              onChange={(t) => onPatch(it.id, { text: t })}
              className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${out ? 'text-stone-500 line-through decoration-stone-300' : 'text-stone-800'}`}
            />

            <button
              onClick={() => cycleType(it)}
              title="Cycle type"
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${it.type ? 'border-stone-300 text-stone-500' : 'border-transparent text-stone-300 hover:text-stone-500'}`}
            >
              {it.type || 'type'}
            </button>

            <div className="hover-reveal flex shrink-0 items-center gap-2">
              <button onClick={() => onMove(it.id)} title={out ? 'Move to Let In' : 'Move to Keep Out'} className="text-stone-300 hover:text-stone-700"><MoveIcon size={14} /></button>
              <button onClick={() => onRemove(it.id)} title="Remove" className="text-stone-300 hover:text-stone-700"><X size={14} /></button>
            </div>
          </div>
        ))}
        {!items.length && <p className="py-3 text-sm italic text-stone-300">Nothing yet.</p>}
      </div>
    </section>
  )
}
