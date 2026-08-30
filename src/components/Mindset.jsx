import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Star, Check, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import InlineText from './shared/InlineText'
import CategorySchedule from './shared/CategorySchedule'
import { dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW } from '../lib/date'
import { phaseForConfig, PHASES } from '../lib/cycle'
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
// clinically useful. Six domains a hormone or functional practitioner actually
// assesses, each offered at three levels — regulated, even, dysregulated — so
// the same question is asked of mood, anxiety, irritability, energy, focus and
// drive every day. Pick your top three; their weight decides the day's bucket,
// and the bucket is what colours the calendar. Read against the cycle phase,
// a month of taps shows whether the hard days cluster somewhere.
const DOMAINS = {
  mood: 'Mood', anxiety: 'Anxiety', irritability: 'Irritability',
  energy: 'Energy', focus: 'Focus', drive: 'Drive',
}
const DOMAIN_ORDER = ['mood', 'anxiety', 'irritability', 'energy', 'focus', 'drive']

// Three bands, three colours — the day takes the colour of the band it lands in,
// so a month reads as a pattern rather than a bag of eighteen hues.
const BANDS = [
  { id: 'up', label: 'Regulated', tint: '#7C8B6B', dir: 1 },
  { id: 'even', label: 'Even', tint: '#A3A093', dir: 0 },
  { id: 'down', label: 'Dysregulated', tint: '#A0654C', dir: -1 },
]
const bandMeta = (id) => BANDS.find((b) => b.id === id) || BANDS[1]

// Six domains × three levels. Every row is the same question asked at a
// different intensity, which is what makes a month of it readable.
const MOODS = [
  // Regulated
  { id: 'bright', label: 'Bright', band: 'up', domain: 'mood' },
  { id: 'calm', label: 'Calm', band: 'up', domain: 'anxiety' },
  { id: 'patient', label: 'Patient', band: 'up', domain: 'irritability' },
  { id: 'energised', label: 'Energised', band: 'up', domain: 'energy' },
  { id: 'clear', label: 'Clear', band: 'up', domain: 'focus' },
  { id: 'motivated', label: 'Motivated', band: 'up', domain: 'drive' },
  // Even
  { id: 'steady', label: 'Steady', band: 'even', domain: 'mood' },
  { id: 'settled', label: 'Settled', band: 'even', domain: 'anxiety' },
  { id: 'unbothered', label: 'Unbothered', band: 'even', domain: 'irritability' },
  { id: 'rested', label: 'Rested', band: 'even', domain: 'energy' },
  { id: 'present', label: 'Present', band: 'even', domain: 'focus' },
  { id: 'managing', label: 'Managing', band: 'even', domain: 'drive' },
  // Dysregulated
  { id: 'low', label: 'Low', band: 'down', domain: 'mood' },
  { id: 'anxious', label: 'Anxious', band: 'down', domain: 'anxiety' },
  { id: 'irritable', label: 'Irritable', band: 'down', domain: 'irritability' },
  { id: 'depleted', label: 'Depleted', band: 'down', domain: 'energy' },
  { id: 'foggy', label: 'Foggy', band: 'down', domain: 'focus' },
  { id: 'flat', label: 'Flat', band: 'down', domain: 'drive' },
]
// Days logged before this vocabulary existed still read correctly.
const LEGACY = {
  radiant: 'bright', content: 'steady', connected: 'bright', even: 'steady',
  tender: 'low', tearful: 'low', tired: 'depleted', onedge: 'anxious',
  overwhelmed: 'anxious', wired: 'anxious',
}
const moodMeta = (id) => MOODS.find((m) => m.id === id) || MOODS.find((m) => m.id === LEGACY[id])
const MAX_PICKS = 3

// A day was once a single mood id; it is now up to three. Read both shapes.
const dayFeelings = (v) => {
  const raw = Array.isArray(v) ? v : (typeof v === 'string' ? [v] : [])
  const out = []
  raw.forEach((id) => { const m = moodMeta(id); if (m && !out.includes(m.id)) out.push(m.id) })
  return out
}
// The weight of what she felt decides the day's bucket.
const bucketOf = (ids) => {
  if (!ids.length) return null
  const score = ids.reduce((n, id) => n + bandMeta((moodMeta(id) || {}).band).dir, 0)
  return score > 0 ? 'up' : score < 0 ? 'down' : 'even'
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
  const selBucket = bucketOf(selected)
  const full = selected.length >= MAX_PICKS

  const toggleFeeling = (id) =>
    setStore((prev) => {
      const p = prev && typeof prev === 'object' ? prev : {}
      const cur = dayFeelings(p[selKey])
      if (!cur.includes(id) && cur.length >= MAX_PICKS) return p // top three only
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      const out = { ...p }
      if (next.length) out[selKey] = next
      else delete out[selKey]
      return out
    })

  const cells = monthGrid(anchor)
  const monthIdx = anchor.getMonth()
  const shift = (n) => setAnchor((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))

  // ── the read — this month, by bucket and against the cycle ──
  const monthDays = cells
    .filter((c) => c.getMonth() === monthIdx)
    .map((c) => ({ d: c, k: dateKey(c), f: dayFeelings(map[dateKey(c)]) }))
    .filter((x) => x.f.length)
  const logged = monthDays.length
  const bandCount = { up: 0, even: 0, down: 0 }
  const domainCount = {}
  monthDays.forEach(({ f }) => {
    bandCount[bucketOf(f)]++
    f.forEach((id) => {
      const m = moodMeta(id)
      if (m && m.band === 'down') domainCount[m.domain] = (domainCount[m.domain] || 0) + 1
    })
  })
  const flagged = Object.entries(domainCount).sort((a, b) => b[1] - a[1]).slice(0, 4)

  // How each phase of the cycle actually goes — the comparison worth having.
  const byPhase = (() => {
    if (!flags.phases) return []
    const acc = {}
    monthDays.forEach(({ d, f }) => {
      const ph = phaseForConfig(phaseCfg, d)
      if (!ph) return
      if (!acc[ph.id]) acc[ph.id] = { id: ph.id, total: 0, up: 0, even: 0, down: 0 }
      acc[ph.id].total++
      acc[ph.id][bucketOf(f)]++
    })
    return Object.keys(PHASES).filter((id) => acc[id]).map((id) => acc[id])
  })()
  const todayPhase = flags.phases ? phaseForConfig(phaseCfg, parseKey(selKey)) : null
  const todayPhaseRow = todayPhase ? byPhase.find((r) => r.id === todayPhase.id) : null

  return (
    <>
      <p className="mb-2 text-center font-serif text-2xl text-stone-800">
        {selKey === todayKey ? 'How do you feel today?' : `How did you feel on ${longDate(parseKey(selKey))}?`}
      </p>
      <p className="mb-10 text-center text-xs text-stone-400">
        Your top three{todayPhase ? ` — you're in your ${(PHASES[todayPhase.id] || {}).name.toLowerCase()} phase` : ''}.
      </p>

      <div className="mx-auto max-w-xl xl:max-w-none xl:grid xl:grid-cols-12 xl:gap-14">
        {/* ── The squares ── */}
        <div className="xl:col-span-6">
          <div className="space-y-6">
            {BANDS.map((b) => (
              <div key={b.id}>
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: b.tint }} />
                  <span className="kicker text-stone-400">{b.label}</span>
                  <span className="h-px flex-1 bg-stone-100" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MOODS.filter((m) => m.band === b.id).map((m) => {
                    const on = selected.includes(m.id)
                    const locked = full && !on
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleFeeling(m.id)}
                        disabled={locked}
                        title={DOMAINS[m.domain]}
                        className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border transition-all ${on ? 'border-stone-900 shadow-sm' : locked ? 'border-stone-100 opacity-40' : 'border-stone-200 hover:border-stone-400'}`}
                        style={{ background: on ? `${b.tint}26` : undefined }}
                      >
                        <span className={`px-1 text-center text-[12.5px] leading-tight ${on ? 'text-stone-900' : 'text-stone-500'}`}>{m.label}</span>
                        <span className="text-[9px] tracking-[0.12em] text-stone-400">{DOMAINS[m.domain].toUpperCase()}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Where the three you picked land */}
          {selBucket && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/50 px-5 py-4">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: bandMeta(selBucket).tint }} />
              <span className="flex-1 text-sm text-stone-600">
                {selected.length === MAX_PICKS ? 'This day reads' : `${selected.length} of ${MAX_PICKS} — so far this day reads`}{' '}
                <span className="font-serif text-lg text-stone-900">{bandMeta(selBucket).label}</span>
              </span>
              <button onClick={() => setStore((p) => { const o = { ...(p && typeof p === 'object' ? p : {}) }; delete o[selKey]; return o })} className="text-xs text-stone-400 hover:text-stone-700">clear</button>
            </div>
          )}
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
              const bucket = bucketOf(dayFeelings(map[key]))
              const tint = bucket ? bandMeta(bucket).tint : null
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
                  {ph && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px]" style={{ backgroundColor: colors[ph.id] }} />}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {BANDS.map((b) => (
              <span key={b.id} className="flex items-center gap-1.5 text-[10.5px] text-stone-400">
                <span className="h-2 w-2 rounded-full" style={{ background: b.tint }} />{b.label}
              </span>
            ))}
            {flags.phases && <span className="text-[10.5px] text-stone-400">· the line beneath each day is your cycle phase</span>}
          </div>

          {logged > 0 && (
            <div className="mt-8 rounded-2xl border border-stone-200 bg-white/40 p-6">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="kicker text-stone-400">The read</span>
                <span className="text-xs tabular-nums text-stone-300">{logged} day{logged === 1 ? '' : 's'} logged</span>
              </div>

              <div className="flex h-2 overflow-hidden rounded-full bg-stone-100">
                {BANDS.map((b) => (bandCount[b.id] ? <span key={b.id} style={{ width: `${(bandCount[b.id] / logged) * 100}%`, background: b.tint }} /> : null))}
              </div>
              <div className="mt-2 flex justify-between text-[10.5px] text-stone-400">
                {BANDS.map((b) => <span key={b.id}>{bandCount[b.id]} {b.label.toLowerCase()}</span>)}
              </div>

              {byPhase.length > 0 && (
                <div className="mt-5 border-t border-stone-100 pt-4">
                  <p className="kicker mb-3 text-stone-400">Against your cycle</p>
                  <div className="space-y-2.5">
                    {byPhase.map((r) => {
                      const P = PHASES[r.id] || {}
                      const here = todayPhase && todayPhase.id === r.id
                      return (
                        <div key={r.id} className={`flex items-center gap-3 rounded-lg ${here ? 'bg-stone-500/5 px-2 py-1.5' : 'px-2'}`}>
                          <span className="flex w-24 shrink-0 items-center gap-2 text-sm text-stone-600">
                            <span className="h-2 w-2 rounded-full" style={{ background: colors[r.id] }} />{P.name || r.id}
                          </span>
                          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                            {BANDS.map((b) => (r[b.id] ? <span key={b.id} style={{ width: `${(r[b.id] / r.total) * 100}%`, background: b.tint }} /> : null))}
                          </div>
                          <span className="w-8 text-right text-[11px] tabular-nums text-stone-400">{r.total}d</span>
                        </div>
                      )
                    })}
                  </div>
                  {todayPhaseRow && todayPhaseRow.total > 0 && (
                    <p className="mt-3 text-[11px] italic leading-relaxed text-stone-500">
                      In your {(PHASES[todayPhaseRow.id] || {}).name.toLowerCase()} phase this month, {todayPhaseRow.down} of {todayPhaseRow.total} logged day{todayPhaseRow.total === 1 ? '' : 's'} read dysregulated.
                    </p>
                  )}
                </div>
              )}

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
            </div>
          )}
        </div>
      </div>
    </>
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
        {/* ── The three lines — one ruled page, not three boxes ── */}
        <div className="xl:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white/50 shadow-sm">
            {[0, 1, 2].map((i) => {
              const isKept = kept(i)
              const isEditing = editing === i
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 px-6 py-5 transition-colors ${i > 0 ? 'border-t border-stone-100' : ''} ${isEditing ? 'bg-white' : ''}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isKept && !isEditing
                      ? <Check size={15} strokeWidth={2.5} className="text-stone-900" />
                      : <span className={`font-serif text-xl leading-none ${isEditing ? 'text-stone-400' : 'text-stone-200'}`}>{i + 1}</span>}
                  </span>
                  {isKept && !isEditing ? (
                    <button onClick={() => setEditing(i)} className="flex-1 text-left font-serif text-lg leading-snug text-stone-800">
                      {lines[i]}
                    </button>
                  ) : (
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
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Archive — every day kept, stored beside the practice ── */}
        {archive.length > 0 && (
          <div className="mt-14 xl:col-span-7 xl:mt-0">
            <div className="mb-5 flex items-baseline gap-3">
              <span className="kicker text-stone-400">Archive</span>
              <span className="h-px flex-1 bg-stone-200" />
              <span className="text-xs tabular-nums text-stone-300">{archive.length}</span>
            </div>
            <div className={archive.length > 1 ? 'columns-1 gap-4 md:columns-2' : ''}>
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
          <button
            onClick={() => setShowCal(true)}
            title="Jump to a date"
            className="mt-3 flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream"
          >
            <CalendarDays size={13} /> Jump to a date
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
