import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Check, Sun, Moon, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import InlineText from './shared/InlineText'
import CategorySchedule from './shared/CategorySchedule'
import { dateKey, parseKey, longDate, isSameDay, monthGrid, addDays, MONTHS, DOW } from '../lib/date'
import { phaseForConfig, PHASES } from '../lib/cycle'
import { usePhaseColors } from '../hooks/usePhaseColors'
import { useLifeStage } from '../lib/lifeStage'
import { sunsetOn, clockOf } from '../lib/sun'

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

// ── Gratitude — a morning half and an evening half, the way the paper spread
// works: cream and a sun on the left, a warmer grey and a moon on the right.
// The evening card stays shut until evening, which is the one thing paper can't
// do — it turns a form into a ritual you come back to.
//
// The evening opens at her sunset, not at a number someone picked — computed
// from her own coordinates, with a fixed hour only as a fallback when we don't
// know where she is.
//
// And before it asks for gratitude it asks how she is. Gratitude prompts can
// sharpen self-criticism in active depression, and forced gratitude in grief
// reads as invalidating, so there are two sets: high capacity, and a low
// capacity set whose floor is deliberately on the ground. Paper cannot ask.
const FALLBACK_EVENING_HOUR = 17

const PROMPTS = {
  high: [
    { id: 'good-now', part: 'am', label: "What's good, right now", lines: 3 },
    { id: 'goes-well', part: 'am', label: 'Today goes well if…', lines: 3 },
    { id: 'someone-who', part: 'am', label: "Today I'm someone who…", lines: 1 },
    { id: 'moments', part: 'pm', label: 'Three moments worth keeping', lines: 3 },
    { id: 'taught', part: 'pm', label: 'One thing today taught me', lines: 1 },
  ],
  low: [
    { id: 'okay', part: 'am', label: 'One thing that was okay', lines: 1 },
    { id: 'smallest', part: 'am', label: 'The smallest useful thing I could do today', lines: 1 },
    { id: 'allowed', part: 'am', label: "Today I'm allowed to…", lines: 1 },
    { id: 'got-me-through', part: 'pm', label: 'One thing that got me through', lines: 1 },
    { id: 'need-tomorrow', part: 'pm', label: 'What I need tomorrow', lines: 1 },
  ],
}
const ALL_PROMPTS = [...PROMPTS.high, ...PROMPTS.low]
const promptMeta = (id) => ALL_PROMPTS.find((x) => x.id === id)

// A day was once three lines in an array. Those were answers to the morning
// gratitude prompt, so that is where they still live.
const normGDay = (v) => {
  if (Array.isArray(v)) return { mode: 'high', entries: { 'good-now': v.filter((l) => (l || '').trim()) } }
  if (v && typeof v === 'object') {
    return {
      mode: v.mode === 'low' ? 'low' : 'high',
      entries: v.entries && typeof v.entries === 'object' ? v.entries : {},
    }
  }
  return { mode: 'high', entries: {} }
}
const dayHasWriting = (v) => Object.values(normGDay(v).entries).some((arr) => (Array.isArray(arr) ? arr : []).some((l) => (l || '').trim()))

// Defined out here on purpose: a component declared inside Gratitude would be a
// new type on every render, so React would tear the inputs down and rebuild them
// between keystrokes and typing would lose focus after a single character.
function GratitudeCard({ part, mode, evening, opensAt, lineAt, setLine }) {
  const isPM = part === 'pm'
  const shut = isPM && !evening
  const list = PROMPTS[mode].filter((x) => x.part === part)
  return (
    <section
      className={`rounded-2xl border p-6 transition-colors md:p-7 ${isPM ? 'border-stone-300/70' : 'border-stone-200'}`}
      style={{ background: isPM ? '#EAE6DF' : '#FDFBF6' }}
    >
      <div className="mb-6 flex items-center gap-2.5">
        {isPM ? <Moon size={15} strokeWidth={1.6} className="text-stone-500" /> : <Sun size={15} strokeWidth={1.6} className="text-stone-500" />}
        <span className="kicker text-stone-500">{isPM ? 'Evening' : 'Morning'}</span>
        {shut && <span className="ml-auto text-[11px] italic text-stone-400">{opensAt ? `opens at sunset · ${opensAt}` : 'opens this evening'}</span>}
      </div>

      <div className={shut ? 'pointer-events-none select-none opacity-35' : ''}>
        {list.map((pr, i) => (
          <div key={pr.id} className={i > 0 ? 'mt-7' : ''}>
            <p className="mb-2.5 font-serif text-lg leading-snug text-stone-800">{pr.label}</p>
            <div className="space-y-2">
              {Array.from({ length: pr.lines }, (_, idx) => (
                <div key={idx} className="flex items-center gap-3 border-b border-stone-300/50 pb-1.5 transition-colors focus-within:border-stone-900">
                  {pr.lines > 1 && <span className="w-3 shrink-0 font-serif text-sm text-stone-300">{idx + 1}</span>}
                  <input
                    value={lineAt(pr.id, idx)}
                    onChange={(e) => setLine(pr.id, idx, e.target.value)}
                    disabled={shut}
                    className="flex-1 bg-transparent py-0.5 font-serif text-[17px] text-stone-800 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Full cup, empty cup — the whole question, without a clinical word in sight.
function Cup({ full = false, size = 21 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {full && <path d="M6.7 11h8.6l-.55 5.1a2.9 2.9 0 0 1-2.88 2.6h-1.76a2.9 2.9 0 0 1-2.88-2.6L6.7 11Z" fill="currentColor" opacity="0.9" />}
      <path d="M6 7.2h10l-1.05 9.1a3 3 0 0 1-2.98 2.7h-1.94a3 3 0 0 1-2.98-2.7L6 7.2Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M15.7 10h1.5a2.15 2.15 0 0 1 0 4.3h-1.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  )
}

function Gratitude() {
  const [store, setStore] = useLocalStorage('mos:gratitude', {})
  const map = store && typeof store === 'object' ? store : {}
  const today = new Date()
  const todayKey = dateKey(today)
  const day = normGDay(map[todayKey])
  // The cup is not remembered. Every visit opens at full — a hard day is a
  // choice she makes in the moment, never a label the planner keeps on her —
  // and the other cup is one tap away. What she writes under either is kept.
  const [mode, setMode] = useState('high')
  const [locRaw] = useLocalStorage('mos:settings:location', 'Alameda')
  const sunset = sunsetOn(today, locRaw)
  const evening = sunset ? today.getTime() >= sunset.getTime() : today.getHours() >= FALLBACK_EVENING_HOUR
  const opensAt = sunset ? clockOf(sunset) : ''

  // If she is still on the page when the sun goes down, the card opens itself.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (evening || !sunset) return undefined
    const ms = sunset.getTime() - Date.now()
    if (ms <= 0 || ms > 12 * 3600 * 1000) return undefined
    const id = setTimeout(() => setTick((n) => n + 1), ms + 1000)
    return () => clearTimeout(id)
  }, [evening, sunset ? sunset.getTime() : 0])

  const setLine = (promptId, idx, val) =>
    setStore((prev) => {
      const p = prev && typeof prev === 'object' ? prev : {}
      const cur = normGDay(p[todayKey])
      const arr = Array.isArray(cur.entries[promptId]) ? [...cur.entries[promptId]] : []
      arr[idx] = val
      return { ...p, [todayKey]: { ...cur, entries: { ...cur.entries, [promptId]: arr } } }
    })
  const lineAt = (promptId, idx) => {
    const arr = Array.isArray(day.entries[promptId]) ? day.entries[promptId] : []
    return arr[idx] || ''
  }

  // The record: every day that holds writing. A day she missed is simply not
  // here — no grid, no run of red, exactly like an undated page.
  const pastKeys = Object.keys(map)
    .filter((k) => k !== todayKey && dayHasWriting(map[k]))
    .sort((a, b) => (a < b ? 1 : -1))

  // The one thing paper cannot do: hand back writing already done.
  const lookBack = (() => {
    const tries = [
      { years: 1, months: 0, say: 'A year ago today' },
      { years: 0, months: 6, say: 'Six months ago today' },
      { years: 0, months: 3, say: 'Three months ago today' },
      { years: 0, months: 1, say: 'A month ago today' },
    ]
    for (const t of tries) {
      const d = new Date(today.getFullYear() - t.years, today.getMonth() - t.months, today.getDate())
      const k = dateKey(d)
      if (!dayHasWriting(map[k])) continue
      const entries = normGDay(map[k]).entries
      for (const pid of ['good-now', 'okay', 'moments', 'got-me-through']) {
        const first = (Array.isArray(entries[pid]) ? entries[pid] : []).find((l) => (l || '').trim())
        if (first) return { say: t.say, text: first.trim() }
      }
    }
    return null
  })()

  const capCup = (on) =>
    `flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-400 hover:border-stone-500 hover:text-stone-600'}`

  return (
    <>
      {/* It asks how she is before it asks her to be grateful — and answers in
          cups rather than clinical words. */}
      <p className="mb-5 text-center font-serif text-2xl text-stone-800">How much have you got today?</p>
      <div className="mb-9 flex items-center justify-center gap-3">
        <button onClick={() => setMode('high')} className={capCup(mode === 'high')} title="A full cup" aria-label="A full cup" aria-pressed={mode === 'high'}>
          <Cup full />
        </button>
        <button onClick={() => setMode('low')} className={capCup(mode === 'low')} title="An empty cup" aria-label="An empty cup" aria-pressed={mode === 'low'}>
          <Cup />
        </button>
      </div>

      <div className="mx-auto max-w-xl md:max-w-none md:grid md:grid-cols-2 md:gap-6 xl:gap-8">
        <GratitudeCard part="am" mode={mode} evening={evening} opensAt={opensAt} lineAt={lineAt} setLine={setLine} />
        <div className="mt-6 md:mt-0"><GratitudeCard part="pm" mode={mode} evening={evening} opensAt={opensAt} lineAt={lineAt} setLine={setLine} /></div>
      </div>

      {lookBack && (
        <p className="mx-auto mt-8 max-w-3xl text-center font-serif text-lg leading-relaxed text-stone-500">
          {lookBack.say} you were grateful for <span className="text-stone-800">{lookBack.text}</span>.
        </p>
      )}

      {pastKeys.length > 0 && (
        <div className="mx-auto mt-14 max-w-4xl">
          <div className="mb-5 flex items-baseline gap-3">
            <span className="kicker text-stone-400">The record</span>
            <span className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="columns-1 gap-4 md:columns-2">
            {pastKeys.map((k) => {
              const d = normGDay(map[k])
              const written = Object.entries(d.entries)
                .map(([pid, arr]) => ({ pr: promptMeta(pid), vals: (Array.isArray(arr) ? arr : []).filter((l) => (l || '').trim()) }))
                .filter((x) => x.pr && x.vals.length)
              if (!written.length) return null
              return (
                <div key={k} className="mb-4 break-inside-avoid rounded-2xl border border-stone-200 bg-white/50 p-5">
                  <p className="kicker mb-3 text-stone-400">{longDate(parseKey(k))}</p>
                  <div className="space-y-4">
                    {written.map(({ pr, vals }) => (
                      <div key={pr.id}>
                        <p className="mb-1 text-[11px] italic text-stone-400">{pr.label}</p>
                        {vals.map((l, i) => (
                          <p key={i} className="border-l border-stone-200 pl-3.5 font-serif text-[17px] leading-relaxed text-stone-700">{l}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
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
