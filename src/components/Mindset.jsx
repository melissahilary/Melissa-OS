import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Check, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
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
  if (subPage === 'schedule' || subPage === 'monthly' || subPage === 'weekly') return <CategorySchedule category="mindset" noun="Practice" question="What do you want to practise today?" cycleConfig={cycleConfig} />
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

  // Only the present and the past can be recorded.
  const isFuture = (k) => k > todayKey
  const toggleFeeling = (id) =>
    isFuture(selKey) ? null : setStore((prev) => {
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
  // The month grid stops at the month she is in — there is nothing ahead to log.
  const atCurrentMonth = anchor.getFullYear() === today.getFullYear() && monthIdx === today.getMonth()
  const shift = (n) => { if (n > 0 && atCurrentMonth) return; setAnchor((m) => new Date(m.getFullYear(), m.getMonth() + n, 1)) }

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

  // ── the day she just recorded, resolved ── One box does all the telling:
  // what the three she chose come to, where that sits in her cycle, and how it
  // compares with the rest of that phase.
  const pickLabels = selected.map((id) => (moodMeta(id) || {}).label).filter(Boolean)
  const domainsIn = (band) => selected
    .map((id) => moodMeta(id))
    .filter((m) => m && m.band === band)
    .map((m) => DOMAINS[m.domain].toLowerCase())
  const listOf = (arr) => (arr.length === 1 ? arr[0] : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`)
  const moodSentence = (() => {
    const up = domainsIn('up'), down = domainsIn('down'), even = domainsIn('even')
    const parts = []
    if (up.length) parts.push(`${listOf(up)} ${up.length > 1 ? 'are' : 'is'} holding`)
    if (even.length && !up.length) parts.push(`${listOf(even)} ${even.length > 1 ? 'are' : 'is'} steady`)
    if (down.length) parts.push(`${listOf(down)} ${down.length > 1 ? 'are' : 'is'} what's pulling the day down`)
    if (!parts.length) return ''
    return `${parts.join('; ')}.`.replace(/^./, (c) => c.toUpperCase())
  })()
  // Today against the rest of this phase.
  const phaseRow = todayPhase ? byPhase.find((r) => r.id === todayPhase.id) : null
  const cycleSentence = (() => {
    if (!todayPhase) return ''
    const name = (PHASES[todayPhase.id] || {}).name.toLowerCase()
    if (!phaseRow || phaseRow.total < 2) return `This is the first read of your ${name} phase this month.`
    const others = phaseRow.total - 1
    const dom = BANDS.reduce((best, b) => (phaseRow[b.id] > phaseRow[best.id] ? b : best), BANDS[1])
    if (!selBucket) return `Your ${name} days this month have run mostly ${dom.label.toLowerCase()} — ${phaseRow[dom.id]} of ${phaseRow.total}.`
    const same = dom.id === selBucket
    return same
      ? `That is how your ${name} phase has been running — ${phaseRow[dom.id]} of ${phaseRow.total} days there read the same.`
      : `Your ${name} days have mostly run ${dom.label.toLowerCase()} (${phaseRow[dom.id]} of ${phaseRow.total}) — today sits ${bandMeta(selBucket).dir > dom.dir ? 'steadier' : 'harder'} than that.`
  })()

  // ── the verdict, in words ── The panel's job is to say what the month came
  // to, not to hand her three numbers and let her work it out.
  const dominant = logged
    ? BANDS.reduce((best, b) => (bandCount[b.id] > bandCount[best.id] ? b : best), BANDS[1]).id
    : 'even'
  const readSentence = (() => {
    if (logged === 1) {
      const d = bandMeta(dominant)
      return d.id === 'up' ? 'One day logged, and it sat regulated.'
        : d.id === 'down' ? 'One day logged, and it ran dysregulated.'
          : 'One day logged, and it sat level — nothing pulling up or down.'
    }
    const n = bandCount[dominant]
    const share = Math.round((n / logged) * 100)
    return dominant === 'up'
      ? `${n} of your ${logged} logged days ran regulated — ${share}% of the month so far.`
      : dominant === 'down'
        ? `${n} of your ${logged} logged days ran dysregulated — ${share}% of the month so far.`
        : `${n} of your ${logged} logged days sat level — ${share}% of the month so far.`
  })()

  // Only say something when there is enough behind it to be worth saying.
  const insights = (() => {
    const out = []
    if (logged < 3) {
      out.push('A few more days and the pattern against your cycle appears here.')
      return out
    }
    const down = bandCount.down
    if (down >= 2 && flags.phases) {
      const worst = byPhase.filter((r) => r.down > 0).sort((a, b) => (b.down / b.total) - (a.down / a.total))[0]
      if (worst && worst.down >= 2 && worst.down / worst.total >= 0.5) {
        out.push(`Your hard days cluster in your ${(PHASES[worst.id] || {}).name.toLowerCase()} phase — ${worst.down} of the ${worst.total} you logged there.`)
      }
    }
    if (down >= 2) {
      const top = Object.entries(domainCount).sort((a, b) => b[1] - a[1])[0]
      if (top && top[1] >= 2) out.push(`When a day is hard, it is most often your ${DOMAINS[top[0]].toLowerCase()} — ${top[1]} of ${logged} days.`)
    }
    if (bandCount.up >= 2 && down === 0) out.push('Nothing has run dysregulated this month.')
    return out
  })()

  return (
    <>
      <p className="mb-9 text-center font-serif text-2xl text-stone-800">
        {selKey === todayKey ? 'How do you feel today?' : `How did you feel on ${longDate(parseKey(selKey))}?`}
      </p>

      <div className="mx-auto max-w-xl xl:max-w-none xl:grid xl:grid-cols-12 xl:gap-14">
        {/* ── The squares ── */}
        <div className="xl:col-span-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <span className="font-serif text-lg text-stone-800">Your top three</span>
            <div className="flex items-center gap-3">
              {todayPhase && (
                <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
                  <span className="h-2 w-2 rounded-full" style={{ background: colors[todayPhase.id] }} />
                  {(PHASES[todayPhase.id] || {}).name} phase
                </span>
              )}
              <span className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full transition-colors"
                    style={{ background: i < selected.length ? (selBucket ? bandMeta(selBucket).tint : '#1C1C1A') : 'rgba(120,113,108,0.22)' }}
                  />
                ))}
                <span className="ml-1 text-[11px] tabular-nums text-stone-400">{selected.length} of {MAX_PICKS}</span>
              </span>
            </div>
          </div>
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

        </div>

        {/* ── The month, and what it says ── */}
        <div className="mt-14 xl:col-span-6 xl:mt-0">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => shift(-1)} className="text-stone-300 transition-colors hover:text-stone-900"><ChevronLeft size={20} /></button>
            <p className="font-serif text-xl text-stone-800">{MONTHS[monthIdx]} {anchor.getFullYear()}</p>
            <button onClick={() => shift(1)} disabled={atCurrentMonth} className={`transition-colors ${atCurrentMonth ? 'text-stone-200' : 'text-stone-300 hover:text-stone-900'}`}><ChevronRight size={20} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {DOW.map((d) => <div key={d} className="pb-1 text-center text-[10px] tracking-wider text-stone-300">{d[0]}</div>)}
            {cells.map((c, i) => {
              const inMonth = c.getMonth() === monthIdx
              const key = dateKey(c)
              const bucket = bucketOf(dayFeelings(map[key]))
              const tint = bucket ? bandMeta(bucket).tint : null
              const isSel = key === selKey
              const ahead = isFuture(key)
              const ph = inMonth && !ahead ? phaseForConfig(phaseCfg, c) : null
              return (
                <button
                  key={i}
                  onClick={() => inMonth && !ahead && setSelKey(key)}
                  disabled={!inMonth || ahead}
                  title={inMonth && ahead ? 'Not yet' : undefined}
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-xs transition-all ${inMonth ? '' : 'pointer-events-none opacity-0'} ${ahead ? 'cursor-default opacity-40' : ''} ${isSel ? 'ring-1 ring-stone-900 ring-offset-1' : ''}`}
                  style={{ backgroundColor: ahead ? 'transparent' : (tint || '#F1F0ED') }}
                >
                  <span className={ahead ? 'text-stone-300' : tint ? 'text-cream/90' : 'text-stone-400'}>{c.getDate()}</span>
                  {ph && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px]" style={{ backgroundColor: colors[ph.id] }} />}
                </button>
              )
            })}
          </div>


          {/* ── The read — the one place the day is resolved ── */}
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white/40 p-6">
            {selBucket ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-3xl leading-none text-stone-900">{bandMeta(selBucket).label}</p>
                    <p className="mt-2 text-sm text-stone-500">{pickLabels.join(' · ')}</p>
                  </div>
                  {todayPhase && (
                    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap pt-1 text-[11px] text-stone-500">
                      <span className="h-2 w-2 rounded-full" style={{ background: colors[todayPhase.id] }} />
                      Day {todayPhase.cycleDay} · {(PHASES[todayPhase.id] || {}).name}
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {moodSentence && <p className="text-sm leading-relaxed text-stone-700">{moodSentence}</p>}
                  {cycleSentence && <p className="text-sm leading-relaxed text-stone-700">{cycleSentence}</p>}
                </div>
              </>
            ) : (
              <p className="font-serif italic text-lg text-stone-400">
                Choose your top three and this reads the day{todayPhase ? ' against your cycle' : ''}.
              </p>
            )}

            {/* The month behind it — every phase, how its days have run */}
            {byPhase.length > 1 && (
              <div className="mt-6 border-t border-stone-100 pt-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="kicker text-stone-400">Across your cycle</span>
                  <span className="text-[11px] tabular-nums text-stone-300">{logged} day{logged === 1 ? '' : 's'} logged</span>
                </div>
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
                          {BANDS.map((b) => (r[b.id] ? <span key={b.id} title={`${r[b.id]} ${b.label.toLowerCase()}`} style={{ width: `${(r[b.id] / r.total) * 100}%`, background: b.tint }} /> : null))}
                        </div>
                        <span className="w-8 text-right text-[11px] tabular-nums text-stone-400">{r.total}d</span>
                      </div>
                    )
                  })}
                </div>
                {insights.length > 0 && (
                  <p className="mt-3 text-[11px] italic leading-relaxed text-stone-500">{insights[0]}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Gratitude — three graces a day. A blank line lies dormant; write one and
// press enter and it inks in with a check and the cursor moves on. Beside the
// writing sits the record of the practice itself — the month as a map of how
// consistently three were kept — and the days before this one. Today is never
// reprinted there; it is already on the page.
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

  // The practice map — how many graces each day of this month holds. This is
  // what belongs beside the writing: evidence of the habit, not a second copy
  // of what she just wrote.
  const gAnchor = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthCells = monthGrid(gAnchor)
  const monthIdx = gAnchor.getMonth()
  const countFor = (k) => (Array.isArray(map[k]) ? map[k] : []).filter((l) => (l || '').trim()).length
  const daysLogged = monthCells.filter((c) => c.getMonth() === monthIdx && countFor(dateKey(c)) === 3).length

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

  return (
    <>
      <p className="mb-10 text-center font-serif text-2xl text-stone-800">What are you grateful for today?</p>

      <div className="mx-auto max-w-xl xl:max-w-none xl:grid xl:grid-cols-12 xl:gap-14">
        {/* ── The three lines — one ruled page, not three boxes ── */}
        <div className="xl:col-span-6">
          {/* The same working header the feelings grid carries: the task, and
              how far along she is. */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <span className="font-serif text-lg text-stone-800">Your top three</span>
            <span className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full transition-colors"
                  style={{ background: kept(i) ? '#1C1C1A' : 'rgba(120,113,108,0.22)' }}
                />
              ))}
              <span className="ml-1 text-[11px] tabular-nums text-stone-400">{[0, 1, 2].filter(kept).length} of 3</span>
            </span>
          </div>
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
        {/* ── The record — the shape of the practice, and the days before this
            one. Never a second copy of what she has just written. ── */}
        <div className="mt-14 xl:col-span-6 xl:mt-0">
          <div>
            <p className="mb-4 text-center font-serif text-xl text-stone-800">{MONTHS[monthIdx]} {gAnchor.getFullYear()}</p>
            <div className="grid grid-cols-7 gap-1.5">
              {DOW.map((d) => <div key={d} className="pb-1 text-center text-[10px] tracking-wider text-stone-300">{d[0]}</div>)}
              {monthCells.map((c, i) => {
                const inMonth = c.getMonth() === monthIdx
                const k = dateKey(c)
                const n = inMonth ? countFor(k) : 0
                const isToday = k === todayKey
                const ahead = k > todayKey
                return (
                  <div
                    key={i}
                    title={inMonth && !ahead ? `${longDate(c)} — ${n} of 3` : ''}
                    className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-xs ${inMonth ? '' : 'opacity-0'} ${ahead ? 'opacity-40' : ''} ${isToday ? 'ring-1 ring-stone-900 ring-offset-1' : ''}`}
                    style={{
                      background: ahead ? 'transparent' : n === 3 ? '#1C1C1A' : n > 0 ? 'rgba(28,28,26,0.16)' : '#F1F0ED',
                      color: n === 3 && !ahead ? '#FAFAF7' : ahead ? '#D6D3D1' : '#A8A29E',
                    }}
                  >{c.getDate()}</div>
                )
              })}
            </div>
            <p className="mt-4 text-center text-xs text-stone-400">
              <span className="font-serif text-lg text-stone-900">{daysLogged}</span> day{daysLogged === 1 ? '' : 's'} logged this month
            </p>
          </div>

          {pastKeys.length > 0 && (
            <div className="mt-8">
              <div className="mb-5 flex items-baseline gap-3">
                <span className="kicker text-stone-400">Before today</span>
                <span className="h-px flex-1 bg-stone-200" />
                <span className="text-xs tabular-nums text-stone-300">{pastKeys.length}</span>
              </div>
              <div className={pastKeys.length > 1 ? 'columns-1 gap-4 md:columns-2' : ''}>
                {pastKeys.map((k) => (
                  <div key={k} className="mb-4 break-inside-avoid rounded-2xl border border-stone-200 bg-white/50 p-5">
                    <p className="kicker mb-3 text-stone-400">{longDate(parseKey(k))}</p>
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
            aria-label="Jump to a date"
            className="mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream"
          >
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
          <p className="kicker mb-5 text-center text-stone-400">Notebook</p>
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
const normInfluence = (x) => ({ id: x.id || uid(), text: x.text || '' })

function Influences() {
  const [yesRaw, setYes] = useLocalStorage('mos:mindset:influences:yes', [])
  const [noRaw, setNo] = useLocalStorage('mos:mindset:influences:no', [])
  const yes = (Array.isArray(yesRaw) ? yesRaw : []).map(normInfluence)
  const no = (Array.isArray(noRaw) ? noRaw : []).map(normInfluence)
  const setters = { yes: setYes, no: setNo }
  const clean = (p) => (Array.isArray(p) ? p : []).map(normInfluence)

  const add = (side, text = '') => setters[side]((p) => [...clean(p), { id: uid(), text }])
  const patch = (side, id, patchObj) => setters[side]((p) => clean(p).map((x) => (x.id === id ? { ...x, ...patchObj } : x)))
  const remove = (side, id) => setters[side]((p) => clean(p).filter((x) => x.id !== id))

  useRegisterAdd(() => add('yes'), [])

  return (
    <div className="mb-16">
      <p className="mb-9 text-center font-serif text-2xl text-stone-800">What are you letting in?</p>
      <div className="grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-stone-200">
        <div className="md:pr-10">
          <InfluenceColumn tone="in" title="Let In" items={yes}
            onAdd={(t) => add('yes', t)} onPatch={(id, p) => patch('yes', id, p)} onRemove={(id) => remove('yes', id)} />
        </div>
        <div className="md:pl-10">
          <InfluenceColumn tone="out" title="Keep Out" items={no}
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
          className="flex-1 bg-transparent border-b border-stone-200 pb-1.5 text-sm outline-none placeholder-stone-300 focus:border-stone-900"
        />
      </div>

      {/* A long list scrolls in place rather than pushing the page down */}
      <div className="max-h-[22rem] overflow-y-auto pr-1">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-3 border-b border-stone-100 py-2.5">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
            <InlineText
              value={it.text}
              onChange={(t) => onPatch(it.id, { text: t })}
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-800 outline-none"
            />
            <button onClick={() => onRemove(it.id)} title="Remove" className="hover-reveal shrink-0 text-stone-300 hover:text-stone-700"><X size={14} /></button>
          </div>
        ))}
        {!items.length && <p className="py-3 text-sm italic text-stone-300">Nothing yet.</p>}
      </div>
    </section>
  )
}
