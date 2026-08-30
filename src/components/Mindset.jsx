import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Star, Check, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import InlineText from './shared/InlineText'
import CategorySchedule from './shared/CategorySchedule'
import { dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW } from '../lib/date'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Mindset({ subPage, cycleConfig }) {
  if (subPage === 'schedule' || subPage === 'monthly' || subPage === 'weekly') return <CategorySchedule category="mindset" noun="Practice" cycleConfig={cycleConfig} />
  if (subPage === 'journal') return <Journal />
  if (subPage === 'mood') return <MoodTracker />
  if (subPage === 'gratitude') return <Gratitude />
  return <Influences />
}

// ── Mood tracker — log the day's feeling from a curated, grown-up palette, then
// watch the month fill in as a quiet map of colour. Tap any day to paint it.
const MOODS = [
  { id: 'radiant', label: 'Radiant', tint: '#C4A76A' },
  { id: 'content', label: 'Content', tint: '#889072' },
  { id: 'tender', label: 'Tender', tint: '#C08B72' },
  { id: 'tired', label: 'Tired', tint: '#9A8F84' },
  { id: 'anxious', label: 'Anxious', tint: '#A0654C' },
  { id: 'low', label: 'Low', tint: '#7E7A86' },
]
const moodMeta = (id) => MOODS.find((m) => m.id === id)

function MoodTracker() {
  const [store, setStore] = useLocalStorage('mos:mood', {})
  const map = store && typeof store === 'object' ? store : {}
  const today = new Date()
  const todayKey = dateKey(today)
  const [selKey, setSelKey] = useState(todayKey)
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const selMood = map[selKey]

  const setMood = (key, moodId) =>
    setStore((prev) => {
      const p = prev && typeof prev === 'object' ? prev : {}
      const next = { ...p }
      if (next[key] === moodId) delete next[key]
      else next[key] = moodId
      return next
    })

  const cells = monthGrid(anchor)
  const monthIdx = anchor.getMonth()
  const shift = (n) => setAnchor((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-center font-serif text-2xl text-stone-800">{selKey === todayKey ? 'How are you, today?' : 'How were you?'}</p>
      <p className="kicker mt-1 mb-6 text-center text-stone-400">{longDate(parseKey(selKey))}</p>

      <div className="flex flex-wrap justify-center gap-2.5">
        {MOODS.map((m) => {
          const on = selMood === m.id
          return (
            <button
              key={m.id}
              onClick={() => setMood(selKey, m.id)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${on ? 'border-stone-900 text-stone-900 shadow-sm' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: m.tint }} />
              {m.label}
            </button>
          )
        })}
      </div>

      {/* The month as a map of colour */}
      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => shift(-1)} className="text-stone-300 transition-colors hover:text-stone-900"><ChevronLeft size={20} /></button>
          <p className="font-serif text-xl text-stone-800">{MONTHS[monthIdx]} {anchor.getFullYear()}</p>
          <button onClick={() => shift(1)} className="text-stone-300 transition-colors hover:text-stone-900"><ChevronRight size={20} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {DOW.map((d) => <div key={d} className="pb-1 text-center text-[10px] tracking-wider text-stone-300">{d[0]}</div>)}
          {cells.map((c, i) => {
            const inMonth = c.getMonth() === monthIdx
            const key = dateKey(c)
            const tint = map[key] ? moodMeta(map[key])?.tint : null
            const isSel = key === selKey
            return (
              <button
                key={i}
                onClick={() => inMonth && setSelKey(key)}
                disabled={!inMonth}
                className={`relative flex aspect-square items-center justify-center rounded-lg text-xs transition-all ${inMonth ? '' : 'pointer-events-none opacity-0'} ${isSel ? 'ring-1 ring-stone-500 ring-offset-1' : ''}`}
                style={{ backgroundColor: tint || '#F1F0ED' }}
              >
                <span className={tint ? 'text-cream/90' : 'text-stone-400'}>{c.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {MOODS.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.tint }} />{m.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Gratitude — three graces a day. A blank line lies dormant; write one and
// press enter and it inks in with a check, and the climb below marks the level
// reached. When all three are kept the day seals into a keepsake card and joins
// the wall of every day before it, which lives alongside the practice.
const GRACES = 3

// A small pressed seal — the same monogram language the house uses elsewhere.
function DaySeal({ size = 26 }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, border: '1px solid #C9C2B2', boxShadow: 'inset 0 0 0 2px #FAF8F3, inset 0 0 0 3px #DDD7C8' }}
    >
      <span className="font-serif italic" style={{ fontSize: size * 0.46, lineHeight: 1, color: '#57524A' }}>g</span>
    </span>
  )
}

function Gratitude() {
  const [store, setStore] = useLocalStorage('mos:gratitude', {})
  const map = store && typeof store === 'object' ? store : {}
  const today = new Date()
  const todayKey = dateKey(today)
  const lines = Array.isArray(map[todayKey]) ? map[todayKey] : ['', '', '']
  // Which line is being written right now. A line with words in it and no cursor
  // is a kept one — that's what earns the ink and the check.
  const [editing, setEditing] = useState(-1)

  const setLine = (idx, val) =>
    setStore((prev) => {
      const p = prev && typeof prev === 'object' ? prev : {}
      const cur = Array.isArray(p[todayKey]) ? [...p[todayKey]] : ['', '', '']
      cur[idx] = val
      return { ...p, [todayKey]: cur }
    })

  const kept = (i) => !!(lines[i] || '').trim()
  const level = [0, 1, 2].filter(kept).length
  // The day only seals once the third grace is committed — never mid-sentence,
  // or the card would close over the words still being written.
  const complete = level === GRACES && editing === -1
  // Enter keeps the line and moves the cursor to the next one still waiting.
  // The next box is already mounted, so it has to be focused by hand.
  const inputRefs = useRef([])
  const commit = (i, el) => {
    const next = [0, 1, 2].find((j) => j > i && !(lines[j] || '').trim())
    const target = next == null ? null : inputRefs.current[next]
    if (target) { target.focus(); return }
    if (el) el.blur()
    setEditing(next == null ? -1 : next)
  }

  const pastKeys = Object.keys(map)
    .filter((k) => k !== todayKey && (map[k] || []).some((l) => (l || '').trim()))
    .sort((a, b) => (a < b ? 1 : -1))

  const LEVEL_WORD = ['None yet', 'One of three', 'Two of three', 'All three, kept']

  return (
    <div className="mx-auto max-w-xl xl:max-w-none xl:grid xl:grid-cols-12 xl:gap-14">
      {/* ── The practice ── */}
      <div className="xl:col-span-5">
        <p className="text-center font-serif text-2xl text-stone-800 xl:text-left">What are you grateful for?</p>

        {complete ? (
          /* Sealed — the day gathered into its keepsake */
          <div className="mt-8 rounded-2xl border border-stone-300 bg-white/70 p-7 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <DaySeal />
              <span className="flex-1">
                <span className="block font-serif text-lg leading-tight text-stone-900">Today is gathered.</span>
                <span className="kicker text-stone-400">{longDate(today)}</span>
              </span>
            </div>
            <div className="space-y-2.5">
              {lines.filter((l) => (l || '').trim()).map((l, i) => (
                <p key={i} className="border-l border-stone-200 pl-4 font-serif text-lg leading-relaxed text-stone-800">{l}</p>
              ))}
            </div>
            <button onClick={() => setEditing(0)} className="mt-6 text-xs text-stone-400 underline-offset-2 hover:text-stone-700 hover:underline">Change something</button>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => {
              const isKept = kept(i)
              const isEditing = editing === i
              if (isKept && !isEditing) {
                return (
                  <button
                    key={i}
                    onClick={() => setEditing(i)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-stone-300 bg-white/70 px-5 py-3.5 text-left shadow-sm transition-colors hover:border-stone-400"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900">
                      <Check size={13} strokeWidth={2.5} className="text-cream" />
                    </span>
                    <span className="flex-1 font-serif text-lg leading-snug text-stone-800">{lines[i]}</span>
                  </button>
                )
              }
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 rounded-2xl border px-5 py-3.5 transition-colors ${isEditing ? 'border-stone-400 bg-white/60' : 'border-dashed border-stone-200 bg-transparent'}`}
                >
                  <span className={`font-serif text-2xl leading-none ${isEditing ? 'text-stone-400' : 'text-stone-300'}`}>{i + 1}</span>
                  <input
                    ref={(el) => { inputRefs.current[i] = el }}
                    autoFocus={isEditing}
                    value={lines[i] || ''}
                    onChange={(e) => setLine(i, e.target.value)}
                    onFocus={() => setEditing(i)}
                    onBlur={() => setEditing((cur) => (cur === i ? -1 : cur))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(i, e.currentTarget) } }}
                    placeholder="I'm grateful for…"
                    className={`flex-1 bg-transparent font-serif text-lg outline-none placeholder-stone-300 ${isEditing ? 'text-stone-800' : 'text-stone-400'}`}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* The climb — each grace kept raises the mark */}
        <div className="mt-7 flex items-end gap-4">
          <div className="flex items-end gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2.5 rounded-full transition-all duration-500"
                style={{ height: 10 + i * 8, background: i < level ? '#1C1C1A' : 'rgba(120,113,108,0.18)' }}
              />
            ))}
          </div>
          <span className="kicker pb-0.5 text-stone-400">{LEVEL_WORD[level]}</span>
        </div>
      </div>

      {/* ── The wall — every day kept, stored beside the practice ── */}
      <div className="mt-16 xl:col-span-7 xl:mt-0">
        {pastKeys.length > 0 ? (
          <>
            <div className="mb-6 flex items-baseline gap-3">
              <span className="kicker text-stone-400">The Gratitude Wall</span>
              <span className="h-px flex-1 bg-stone-200" />
              <span className="text-xs tabular-nums text-stone-300">{pastKeys.length}</span>
            </div>
            <div className="columns-1 gap-4 sm:columns-2">
              {pastKeys.map((k) => {
                const kls = (map[k] || []).filter((l) => (l || '').trim())
                return (
                  <div key={k} className="mb-4 break-inside-avoid rounded-2xl border border-stone-200 bg-white/50 p-5">
                    <div className="mb-3 flex items-center gap-2.5">
                      <DaySeal size={20} />
                      <span className="kicker text-stone-400">{longDate(parseKey(k))}</span>
                    </div>
                    <div className="space-y-2">
                      {kls.map((l, idx) => (
                        <p key={idx} className="border-l border-stone-200 pl-3.5 font-serif text-[17px] leading-relaxed text-stone-700">{l}</p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-200 px-6 py-14 text-center">
            <p className="font-serif italic text-lg text-stone-400">Every day you keep all three is stored here.</p>
          </div>
        )}
      </div>
    </div>
  )
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
const weekdayShort = (d) => DOW[d.getDay()]
const excerptOf = (list) => {
  const e = list.find((x) => (x.body || '').trim()) || list[0] || {}
  return (e.body || '').trim() || (e.title || '').trim()
}

function Journal() {
  const today = new Date()
  const [entries, setEntries] = useLocalStorage('mos:mindset:journal', {})
  const store = entries && typeof entries === 'object' ? entries : {}
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const [showCal, setShowCal] = useState(false)
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

  const hasEntry = (k) => normDay(store[k], k).some(entryHasContent)
  // Past days that hold any content, most recent first (excluding the open day).
  const past = Object.keys(store)
    .filter((k) => k !== selectedKey && hasEntry(k))
    .sort((a, b) => b.localeCompare(a))

  return (
    <div className="mb-16">
      {/* Date rail — glide day by day, or open the calendar to leap through time */}
      <div className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <button onClick={() => shift(-1)} title="Previous day" className="text-stone-300 transition-colors hover:text-stone-900"><ChevronLeft size={20} /></button>
        <div className="flex flex-col items-center">
          <button onClick={() => setShowCal(true)} title="Jump to a date" className="group flex items-center gap-2 text-stone-900">
            <span className="font-serif text-2xl">{longDate(selected)}</span>
            <CalendarDays size={15} className="text-stone-300 transition-colors group-hover:text-stone-600" />
          </button>
          {!isToday && <button onClick={() => setSelectedKey(dateKey(today))} className="mt-0.5 text-xs italic text-stone-400 underline underline-offset-2 hover:text-stone-700">Back to today</button>}
        </div>
        <button onClick={() => shift(1)} title="Next day" className="text-stone-300 transition-colors hover:text-stone-900"><ChevronRight size={20} /></button>
      </div>

      {/* The page — an unadorned writing surface, a comfortable measure wide */}
      <div className="mx-auto max-w-2xl">
        {display.map((e, i) => (
          <article key={e.id} className="group relative">
            {i > 0 && <div className="mx-auto my-8 select-none text-center text-lg leading-none text-stone-200" style={{ fontFamily: "'Cormorant Garamond', serif" }}>❦</div>}
            {/* A dark writing box — light text on ink, so it's unmistakably the
                space to write in. */}
            <div className="relative rounded-2xl px-6 py-6 shadow-sm md:px-8 md:py-7" style={{ backgroundColor: '#1C1C1A' }}>
              {dayList.length > 1 && (
                <button onClick={() => removeEntry(e.id)} className="absolute right-3 top-3 z-10 text-cream/40 opacity-0 transition-opacity hover:text-cream group-hover:opacity-100" title="Delete entry"><X size={16} /></button>
              )}
              <input
                value={e.title}
                onChange={(ev) => updateEntry(e.id, { title: ev.target.value })}
                placeholder="Title"
                className="w-full bg-transparent pr-8 font-serif text-3xl text-cream placeholder-stone-500 outline-none md:text-4xl"
              />
              <textarea
                value={e.body}
                onChange={(ev) => updateEntry(e.id, { body: ev.target.value })}
                placeholder="Begin where you are…"
                className="mt-3 block w-full min-h-[44vh] resize-y bg-transparent font-serif text-lg leading-loose text-cream/90 placeholder-stone-500 outline-none md:text-xl"
              />
            </div>
          </article>
        ))}

        <button onClick={addEntry} className="mt-6 flex items-center gap-1.5 text-sm italic text-stone-400 transition-colors hover:text-stone-900">
          <Plus size={14} /> New entry
        </button>
      </div>

      {/* The archive — flip back through past days */}
      {past.length > 0 && (
        <div className="mx-auto mt-16 max-w-2xl border-t border-stone-200 pt-8">
          <p className="kicker mb-5 text-center text-stone-400">The Archive</p>
          <div className="space-y-1">
            {past.map((k) => {
              const d = parseKey(k)
              const list = normDay(store[k], k).filter(entryHasContent)
              const title = (list[0]?.title || '').trim()
              return (
                <button key={k} onClick={() => setSelectedKey(k)} className="group flex w-full items-baseline gap-5 border-b border-stone-100 py-4 text-left transition-colors last:border-0 hover:bg-stone-50/60">
                  <div className="w-16 shrink-0 text-right">
                    <span className="font-serif text-2xl text-stone-800">{d.getDate()}</span>
                    <p className="kicker text-stone-400">{weekdayShort(d)} · {MONTHS[d.getMonth()].slice(0, 3)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    {title && <p className="truncate font-serif text-lg text-stone-800">{title}</p>}
                    <p className={`line-clamp-2 text-sm leading-relaxed text-stone-500 ${title ? 'mt-0.5' : ''}`}>{excerptOf(list)}</p>
                    {list.length > 1 && <p className="mt-1 kicker text-stone-300">{list.length} entries</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showCal && <JournalCalendar selectedKey={selectedKey} today={today} hasEntry={hasEntry} onPick={(k) => { setSelectedKey(k); setShowCal(false) }} onClose={() => setShowCal(false)} />}
    </div>
  )
}

// A month calendar to leap to any date. Days that hold writing carry a small
// ink dot, so the archive is visible at a glance; tap a day to open it.
function JournalCalendar({ selectedKey, today, hasEntry, onPick, onClose }) {
  const [month, setMonth] = useState(new Date(parseKey(selectedKey).getFullYear(), parseKey(selectedKey).getMonth(), 1))
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])
  const cells = monthGrid(month)
  const step = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm border border-stone-300 bg-cream shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <button onClick={() => step(-1)} className="text-stone-400 hover:text-stone-900"><ChevronLeft size={18} /></button>
          <span className="font-serif text-lg text-stone-900">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
          <button onClick={() => step(1)} className="text-stone-400 hover:text-stone-900"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 px-4 py-4">
          {DOW.map((d) => <div key={d} className="pb-1 text-center kicker text-stone-300">{d[0]}</div>)}
          {cells.map((cell) => {
            const key = dateKey(cell)
            const inMonth = cell.getMonth() === month.getMonth()
            const isSel = key === selectedKey
            const isTod = isSameDay(cell, today)
            const written = inMonth && hasEntry(key)
            return (
              <button
                key={key}
                onClick={() => onPick(key)}
                className={`relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-sm transition-colors ${isSel ? 'bg-stone-900 text-cream' : inMonth ? 'text-stone-700 hover:bg-stone-100' : 'text-stone-300'} ${isTod && !isSel ? 'ring-1 ring-stone-300' : ''}`}
              >
                {cell.getDate()}
                {written && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSel ? 'bg-cream' : 'bg-stone-500'}`} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Influences — two facing columns: what to let in, and what to keep out. Each
// influence can be starred as a non-negotiable (anchors float to the top). The
// page title is supplied by the app shell.
const normInfluence = (x) => ({ id: x.id || uid(), text: x.text || '', star: !!x.star })
const sortInfluences = (arr) => arr.slice().sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0))

function Influences() {
  const [yesRaw, setYes] = useLocalStorage('mos:mindset:influences:yes', [])
  const [noRaw, setNo] = useLocalStorage('mos:mindset:influences:no', [])
  const yes = (Array.isArray(yesRaw) ? yesRaw : []).map(normInfluence)
  const no = (Array.isArray(noRaw) ? noRaw : []).map(normInfluence)
  const setters = { yes: setYes, no: setNo }
  const clean = (p) => (Array.isArray(p) ? p : []).map(normInfluence)

  const add = (side, text = '') => setters[side]((p) => [...clean(p), { id: uid(), text, star: false }])
  const patch = (side, id, patchObj) => setters[side]((p) => clean(p).map((x) => (x.id === id ? { ...x, ...patchObj } : x)))
  const remove = (side, id) => setters[side]((p) => clean(p).filter((x) => x.id !== id))

  useRegisterAdd(() => add('yes'), [])

  return (
    <div className="mb-16">
      <div className="grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-stone-200">
        <div className="md:pr-10">
          <InfluenceColumn tone="in" title="Let In" items={sortInfluences(yes)}
            onAdd={(t) => add('yes', t)} onPatch={(id, p) => patch('yes', id, p)} onRemove={(id) => remove('yes', id)} />
        </div>
        <div className="md:pl-10">
          <InfluenceColumn tone="out" title="Keep Out" items={sortInfluences(no)}
            onAdd={(t) => add('no', t)} onPatch={(id, p) => patch('no', id, p)} onRemove={(id) => remove('no', id)} />
        </div>
      </div>
    </div>
  )
}

function InfluenceColumn({ tone, title, items, onAdd, onPatch, onRemove }) {
  const [draft, setDraft] = useState('')
  const commit = () => { if (!draft.trim()) return; onAdd(draft.trim()); setDraft('') }
  const out = tone === 'out'

  return (
    <section>
      <h3 className="mb-4 font-serif text-xl text-stone-900">{title}</h3>

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

            <button onClick={() => onRemove(it.id)} title="Remove" className="hover-reveal shrink-0 text-stone-300 hover:text-stone-700"><X size={14} /></button>
          </div>
        ))}
        {!items.length && <p className="py-3 text-sm italic text-stone-300">Nothing yet.</p>}
      </div>
    </section>
  )
}
