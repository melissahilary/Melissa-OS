import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Star, Check, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import InlineText from './shared/InlineText'
import CategorySchedule from './shared/CategorySchedule'
import { dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW } from '../lib/date'
import { phaseForConfig } from '../lib/cycle'
import { usePhaseColors } from '../hooks/usePhaseColors'
import { useLifeStage } from '../lib/lifeStage'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Mindset({ subPage, cycleConfig }) {
  if (subPage === 'schedule' || subPage === 'monthly' || subPage === 'weekly') return <CategorySchedule category="mindset" noun="Practice" cycleConfig={cycleConfig} />
  if (subPage === 'journal') return <Journal />
  if (subPage === 'mood') return <MoodTracker cycleConfig={cycleConfig} />
  if (subPage === 'gratitude') return <Gratitude />
  return <Influences />
}

// ── Mood tracker — the day's felt state, recorded precisely enough to be
// clinically useful. Every feeling carries a domain (mood, anxiety, energy,
// focus, drive, stress, irritability) and a direction, so a month of taps adds
// up to something a functional or hormone practitioner can actually read — and
// the calendar carries the cycle phase beneath each day, so the pattern between
// where she is in her cycle and how she feels becomes visible on its own.
const DOMAINS = {
  mood: 'Mood', anxiety: 'Anxiety', irritability: 'Irritability',
  stress: 'Stress load', energy: 'Energy', focus: 'Focus', drive: 'Drive',
}

// dir: +1 regulated · 0 even · -1 dysregulated. The legacy single-mood ids
// (radiant/content/tender/tired/anxious/low) are kept so old logs still read.
const MOODS = [
  // Regulated
  { id: 'radiant', label: 'Radiant', tint: '#C4A76A', band: 'up', domain: 'mood', dir: 1 },
  { id: 'energised', label: 'Energised', tint: '#9C8F4F', band: 'up', domain: 'energy', dir: 1 },
  { id: 'clear', label: 'Clear', tint: '#6E8CA0', band: 'up', domain: 'focus', dir: 1 },
  { id: 'motivated', label: 'Motivated', tint: '#7C8B6B', band: 'up', domain: 'drive', dir: 1 },
  { id: 'connected', label: 'Connected', tint: '#B07A9A', band: 'up', domain: 'mood', dir: 1 },
  { id: 'calm', label: 'Calm', tint: '#8FA394', band: 'up', domain: 'anxiety', dir: 1 },
  // Even
  { id: 'content', label: 'Content', tint: '#889072', band: 'even', domain: 'mood', dir: 1 },
  { id: 'rested', label: 'Rested', tint: '#9BAF9F', band: 'even', domain: 'energy', dir: 1 },
  { id: 'even', label: 'Even', tint: '#A3A093', band: 'even', domain: 'mood', dir: 0 },
  // Dysregulated
  { id: 'tender', label: 'Tender', tint: '#C08B72', band: 'down', domain: 'mood', dir: -1 },
  { id: 'low', label: 'Low', tint: '#7E7A86', band: 'down', domain: 'mood', dir: -1 },
  { id: 'tearful', label: 'Tearful', tint: '#8E7BA0', band: 'down', domain: 'mood', dir: -1 },
  { id: 'anxious', label: 'Anxious', tint: '#A0654C', band: 'down', domain: 'anxiety', dir: -1 },
  { id: 'onedge', label: 'On edge', tint: '#B0704F', band: 'down', domain: 'anxiety', dir: -1 },
  { id: 'irritable', label: 'Irritable', tint: '#A85B4B', band: 'down', domain: 'irritability', dir: -1 },
  { id: 'overwhelmed', label: 'Overwhelmed', tint: '#8A6A5C', band: 'down', domain: 'stress', dir: -1 },
  { id: 'foggy', label: 'Foggy', tint: '#9A9AA0', band: 'down', domain: 'focus', dir: -1 },
  { id: 'tired', label: 'Tired', tint: '#9A8F84', band: 'down', domain: 'energy', dir: -1 },
  { id: 'flat', label: 'Flat', tint: '#8B8578', band: 'down', domain: 'drive', dir: -1 },
]
const moodMeta = (id) => MOODS.find((m) => m.id === id)
const BANDS = [
  { id: 'up', label: 'Regulated' },
  { id: 'even', label: 'Even' },
  { id: 'down', label: 'Dysregulated' },
]

// A day was once a single mood id; it is now a list, the first of which colours
// the day. Read both shapes.
const dayFeelings = (v) => {
  if (Array.isArray(v)) return v.filter((id) => moodMeta(id))
  if (typeof v === 'string' && moodMeta(v)) return [v]
  return []
}

function MoodTracker({ cycleConfig = {} }) {
  const [store, setStore] = useLocalStorage('mos:mood', {})
  const map = store && typeof store === 'object' ? store : {}
  const today = new Date()
  const todayKey = dateKey(today)
  const [selKey, setSelKey] = useState(todayKey)
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const { colors } = usePhaseColors()
  const { flags } = useLifeStage()
  const phaseCfg = flags.phases ? cycleConfig : {}

  const selected = dayFeelings(map[selKey])

  // Tapping a feeling adds or removes it; the first one chosen colours the day.
  const toggleFeeling = (id) =>
    setStore((prev) => {
      const p = prev && typeof prev === 'object' ? prev : {}
      const cur = dayFeelings(p[selKey])
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      const out = { ...p }
      if (next.length) out[selKey] = next
      else delete out[selKey]
      return out
    })

  const cells = monthGrid(anchor)
  const monthIdx = anchor.getMonth()
  const shift = (n) => setAnchor((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))

  // ── the clinical read — this month, by domain and by cycle phase ──
  const monthDays = cells.filter((c) => c.getMonth() === monthIdx).map((c) => ({ d: c, k: dateKey(c), f: dayFeelings(map[dateKey(c)]) })).filter((x) => x.f.length)
  const logged = monthDays.length
  const bandCount = { up: 0, even: 0, down: 0 }
  const domainCount = {}
  monthDays.forEach(({ f }) => {
    // A day's band is the direction of the weight of what she felt that day.
    const score = f.reduce((n, id) => n + (moodMeta(id)?.dir || 0), 0)
    bandCount[score > 0 ? 'up' : score < 0 ? 'down' : 'even']++
    f.forEach((id) => {
      const m = moodMeta(id)
      if (m && m.dir < 0) domainCount[m.domain] = (domainCount[m.domain] || 0) + 1
    })
  })
  const flagged = Object.entries(domainCount).sort((a, b) => b[1] - a[1]).slice(0, 4)

  // Where the hard days fall in the cycle — the pattern a practitioner wants.
  const phaseRows = (() => {
    if (!flags.phases) return []
    const acc = {}
    monthDays.forEach(({ d, f }) => {
      const ph = phaseForConfig(phaseCfg, d)
      if (!ph) return
      const score = f.reduce((n, id) => n + (moodMeta(id)?.dir || 0), 0)
      if (!acc[ph.id]) acc[ph.id] = { id: ph.id, label: ph.label || ph.name, total: 0, down: 0 }
      acc[ph.id].total++
      if (score < 0) acc[ph.id].down++
    })
    return Object.values(acc).filter((r) => r.total)
  })()

  return (
    <div className="mx-auto max-w-xl xl:max-w-none xl:grid xl:grid-cols-12 xl:gap-14">
      {/* ── The question and the squares ── */}
      <div className="xl:col-span-6">
        <p className="text-center font-serif text-2xl text-stone-800 xl:text-left">
          {selKey === todayKey ? 'How do you feel today?' : `How did you feel on ${longDate(parseKey(selKey))}?`}
        </p>
        <p className="mt-1.5 text-center text-xs text-stone-400 xl:text-left">Choose as many as are true. The first colours the day.</p>

        <div className="mt-7 space-y-6">
          {BANDS.map((b) => (
            <div key={b.id}>
              <div className="mb-2.5 flex items-center gap-3">
                <span className="kicker text-stone-400">{b.label}</span>
                <span className="h-px flex-1 bg-stone-100" />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3">
                {MOODS.filter((m) => m.band === b.id).map((m) => {
                  const on = selected.includes(m.id)
                  const primary = selected[0] === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleFeeling(m.id)}
                      title={DOMAINS[m.domain]}
                      className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border transition-all ${on ? 'border-stone-900 shadow-sm' : 'border-stone-200 hover:border-stone-400'}`}
                      style={{ background: on ? `${m.tint}1f` : undefined }}
                    >
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: m.tint, boxShadow: on ? `0 0 0 3px ${m.tint}33` : undefined }} />
                      <span className={`px-1 text-center text-[11.5px] leading-tight ${on ? 'text-stone-900' : 'text-stone-500'}`}>{m.label}</span>
                      {primary && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-stone-900" title="Colours the day" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── The month, and what it says ── */}
      <div className="mt-14 xl:col-span-6 xl:mt-0">
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
            const f = dayFeelings(map[key])
            const tint = f.length ? moodMeta(f[0])?.tint : null
            const isSel = key === selKey
            const ph = inMonth ? phaseForConfig(phaseCfg, c) : null
            return (
              <button
                key={i}
                onClick={() => inMonth && setSelKey(key)}
                disabled={!inMonth}
                className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-xs transition-all ${inMonth ? '' : 'pointer-events-none opacity-0'} ${isSel ? 'ring-1 ring-stone-900 ring-offset-1' : ''}`}
                style={{ backgroundColor: tint || '#F1F0ED' }}
              >
                <span className={tint ? 'text-cream/90' : 'text-stone-400'}>{c.getDate()}</span>
                {/* more than one feeling that day */}
                {f.length > 1 && <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-cream/70" />}
                {/* the cycle phase, running beneath the day */}
                {ph && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px]" style={{ backgroundColor: colors[ph.id] }} />}
              </button>
            )
          })}
        </div>

        {flags.phases && (
          <p className="mt-3 text-center text-[10.5px] text-stone-400">The line beneath each day is your cycle phase.</p>
        )}

        {/* The read — what a month of taps amounts to */}
        {logged > 0 && (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white/40 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="kicker text-stone-400">The read</span>
              <span className="text-xs tabular-nums text-stone-300">{logged} day{logged === 1 ? '' : 's'} logged</span>
            </div>

            <div className="flex h-2 overflow-hidden rounded-full bg-stone-100">
              {['up', 'even', 'down'].map((b) => (
                bandCount[b] ? <span key={b} style={{ width: `${(bandCount[b] / logged) * 100}%`, background: b === 'up' ? '#7C8B6B' : b === 'even' ? '#A3A093' : '#A0654C' }} /> : null
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10.5px] text-stone-400">
              <span>{bandCount.up} regulated</span><span>{bandCount.even} even</span><span>{bandCount.down} dysregulated</span>
            </div>

            {flagged.length > 0 && (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="kicker mb-2.5 text-stone-400">What is asking for attention</p>
                <div className="space-y-1.5">
                  {flagged.map(([d, n]) => (
                    <div key={d} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-stone-600">{DOMAINS[d]}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full" style={{ width: `${(n / logged) * 100}%`, background: '#A0654C' }} />
                      </div>
                      <span className="w-12 text-right text-[11px] tabular-nums text-stone-400">{n}/{logged}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phaseRows.length > 0 && (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="kicker mb-2.5 text-stone-400">Against your cycle</p>
                <div className="space-y-1.5">
                  {phaseRows.map((r) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className="flex w-24 shrink-0 items-center gap-2 text-sm text-stone-600">
                        <span className="h-2 w-2 rounded-full" style={{ background: colors[r.id] }} />{r.label}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full" style={{ width: `${(r.down / r.total) * 100}%`, background: '#A0654C' }} />
                      </div>
                      <span className="w-12 text-right text-[11px] tabular-nums text-stone-400">{r.down}/{r.total}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10.5px] italic leading-relaxed text-stone-400">
                  Hard days as a share of days logged in each phase — the pattern worth bringing to your practitioner.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Gratitude — three graces a day. A blank line lies dormant; write one and
// press enter and it inks in with a check and the cursor moves on. Once all
// three are kept the day joins the archive beside the practice, where every
// day already kept is stored.
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
  // Today joins the archive only once the third grace is committed — never
  // mid-sentence, or it would file words still being written.
  const complete = [0, 1, 2].every(kept) && editing === -1

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
  const archive = complete ? [todayKey, ...pastKeys] : pastKeys

  return (
    <>
      <p className="mb-10 text-center font-serif text-2xl text-stone-800">What are you grateful for?</p>

      <div className="mx-auto max-w-xl xl:max-w-none xl:grid xl:grid-cols-12 xl:gap-14">
        {/* ── The three lines ── */}
        <div className="space-y-3 xl:col-span-5">
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

        {/* ── Archive — every day kept, stored beside the practice ── */}
        {archive.length > 0 && (
          <div className="mt-14 xl:col-span-7 xl:mt-0">
            <div className="mb-5 flex items-baseline gap-3">
              <span className="kicker text-stone-400">Archive</span>
              <span className="h-px flex-1 bg-stone-200" />
              <span className="text-xs tabular-nums text-stone-300">{archive.length}</span>
            </div>
            <div className="columns-1 gap-4 sm:columns-2">
              {archive.map((k) => (
                <div key={k} className="mb-4 break-inside-avoid rounded-2xl border border-stone-200 bg-white/50 p-5">
                  <p className="kicker mb-3 text-stone-400">{k === todayKey ? 'Today' : longDate(parseKey(k))}</p>
                  <div className="space-y-2">
                    {(map[k] || []).filter((l) => (l || '').trim()).map((l, idx) => (
                      <p key={idx} className="border-l border-stone-200 pl-3.5 font-serif text-[17px] leading-relaxed text-stone-700">{l}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
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
      {/* The question, and beneath it the rail — glide day by day, or open the
          calendar to leap through time. A day other than today names itself in
          the question, so the date is never a line of its own. */}
      <div className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <button onClick={() => shift(-1)} title="Previous day" className="text-stone-300 transition-colors hover:text-stone-900"><ChevronLeft size={20} /></button>
        <div className="flex flex-col items-center px-3 text-center">
          <p className="font-serif text-2xl text-stone-800">
            {isToday ? "What's on your mind today?" : `What was on your mind on ${longDate(selected)}?`}
          </p>
          <button onClick={() => setShowCal(true)} title="Jump to a date" className="mt-2 text-stone-300 transition-colors hover:text-stone-600">
            <CalendarDays size={15} />
          </button>
          {!isToday && <button onClick={() => setSelectedKey(dateKey(today))} className="mt-1 text-xs italic text-stone-400 underline underline-offset-2 hover:text-stone-700">Back to today</button>}
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
          <p className="kicker mb-5 text-center text-stone-400">Archive</p>
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
