import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PHASES, phaseForConfig, phaseFor, cycleDayFor, startOfDay, averageCycleLength } from '../lib/cycle'
import { dateKey, parseKey, addDays, MONTHS, monthGrid, DOW, isSameDay } from '../lib/date'

const MS_DAY = 86400000
const fmt = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

// A period spans several contiguous days. Group marked days into runs and return
// each run's START — those are the real "period start" (Day 1) dates.
const dayGap = (a, b) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / MS_DAY)
const runStartsOf = (days) => {
  const sorted = [...new Set((days || []).filter(Boolean))].sort()
  const starts = []
  sorted.forEach((d, i) => { if (i === 0 || dayGap(sorted[i - 1], d) > 1) starts.push(d) })
  return starts
}
// Day 1 = the start of the most recent period run that has already begun
// (start ≤ today); if none has begun yet, the earliest run start.
const anchorStart = (runStarts, todayKey) => {
  if (!runStarts.length) return ''
  const begun = runStarts.filter((k) => k <= todayKey)
  const pool = begun.length ? begun : runStarts
  return pool[pool.length - 1]
}

export default function Workout({ cycleConfig = {}, setCycleConfig = () => {}, goToDay = () => {}, subPage = 'cycle' }) {
  return (
    <div>
      {subPage === 'settings'
        ? <CycleSettings cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} />
        : <CyclePage cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} goToDay={goToDay} />}
    </div>
  )
}

// ── Cycle tracking ──────────────────────────────────────────────────
const SYMPTOMS = [
  'Bloating', 'Cramps', 'Headache', 'Fatigue', 'High Energy', 'Brain Fog', 'Mood Swings',
  'Clear Skin', 'Breakouts', 'Strong Libido', 'Low Libido', 'Tender Breasts', 'Back Pain',
  'Insomnia', 'Deep Sleep', 'Anxiety', 'Calm', 'Irritable', 'Emotional', 'Confident',
]
const FLOW = ['Spotting', 'Light', 'Medium', 'Heavy']

// Phase segments across one cycle, in day order, with their starting cycle-day.
const PHASE_SEG = [
  { id: 'menstrual', label: 'Menstrual', start: 1 },
  { id: 'follicular', label: 'Follicular', start: 6 },
  { id: 'ovulation', label: 'Ovulatory', start: 14 },
  { id: 'luteal', label: 'Luteal', start: 17 },
]

const ENERGY = { menstrual: 1, follicular: 4, ovulation: 5, luteal: 3 }
const INTENTION = {
  follicular: 'Your mind is sharp and your energy is building. Schedule deep work and new starts.',
  ovulation: 'Peak output day. Be visible, pitch, connect, lead.',
  luteal: 'Wrap up, organize, reflect. Protect your energy in the second half.',
  menstrual: "Rest and reset. Honor the slowdown — it's productive in its own way.",
}

function CyclePage({ cycleConfig, setCycleConfig, goToDay = () => {} }) {
  const today = new Date()
  const todayKey = dateKey(today)
  const start = cycleConfig.lastPeriodStart || ''
  const len = Number(cycleConfig.cycleLength) > 0 ? Number(cycleConfig.cycleLength) : 28
  const phase = phaseForConfig(cycleConfig, today)
  const cycleDay = cycleDayFor(today, start, len)

  const [logs, setLogs] = useLocalStorage('mos:cycle:logs', {})
  const [reading, setReading] = useState(null)
  const todayLog = logs[todayKey] || { symptoms: [], flow: '', bbt: '', notes: '' }
  const setToday = (patch) => setLogs((p) => ({ ...p, [todayKey]: { symptoms: [], flow: '', bbt: '', notes: '', ...(p[todayKey] || {}), ...patch } }))
  const toggleSymptom = (s) => { const cur = todayLog.symptoms || []; setToday({ symptoms: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] }) }

  const history = Array.isArray(cycleConfig.history) ? cycleConfig.history : []
  const setCfg = (patch) => setCycleConfig({ ...cycleConfig, ...patch })

  // Every marked period day (the full runs) — source of truth for the calendar.
  // Falls back to the legacy union of history + lastPeriodStart for old data.
  const periodDays = Array.isArray(cycleConfig.periodDays) && cycleConfig.periodDays.length
    ? [...new Set(cycleConfig.periodDays.filter(Boolean))].sort()
    : [...new Set([...history, start].filter(Boolean))].sort()

  // Editing the calendar re-derives Day 1 from the runs' start dates and stores
  // run starts as history (for average cycle length) — driving phase + predictions
  // everywhere on the site.
  const setPeriodDays = (arr) => {
    const days = [...new Set(arr.filter(Boolean))].sort()
    if (!days.length) { setCfg({ periodDays: [], lastPeriodStart: '', history: [], manualPhase: '' }); return }
    const starts = runStartsOf(days)
    const anchor = anchorStart(starts, todayKey)
    const rest = starts.filter((k) => k !== anchor).sort((a, b) => (a < b ? 1 : -1))
    setCfg({ periodDays: days, lastPeriodStart: anchor, history: rest, manualPhase: '' })
  }

  // Self-heal legacy/incorrect data on load: Day 1 must be a period-run START.
  useEffect(() => {
    if (!periodDays.length) return
    const starts = runStartsOf(periodDays)
    const anchor = anchorStart(starts, todayKey)
    const rest = starts.filter((k) => k !== anchor).sort((a, b) => (a < b ? 1 : -1))
    if (anchor !== start || !Array.isArray(cycleConfig.periodDays)) {
      setCfg({ periodDays, lastPeriodStart: anchor, history: rest })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Predictions.
  const predictions = (() => {
    if (!start) return null
    const s0 = startOfDay(parseKey(start))
    const daysSince = Math.floor((startOfDay(today) - s0) / MS_DAY)
    const cyclesDone = Math.max(0, Math.floor(daysSince / len))
    const curStart = addDays(s0, cyclesDone * len)
    const nextStart = addDays(s0, (cyclesDone + 1) * len)
    const cd = cycleDay || 1
    const ovById = (base) => ({ from: addDays(base, 13), to: addDays(base, 15) })
    const nextOv = cd < 14 ? ovById(curStart) : ovById(nextStart)
    const boundaries = [6, 14, 17, len + 1]
    const nextBoundDay = boundaries.find((b) => b > cd)
    let nextPhaseDate, nextPhaseName
    if (nextBoundDay && nextBoundDay <= len) { nextPhaseDate = addDays(curStart, nextBoundDay - 1); const m = PHASE_SEG.find((p) => p.start === nextBoundDay); nextPhaseName = m ? m.label : '' }
    else { nextPhaseDate = nextStart; nextPhaseName = 'Menstrual' }
    return { nextPeriod: nextStart, nextOv, nextPhaseDate, nextPhaseName }
  })()

  const pastKeys = Object.keys(logs)
    .filter((k) => k !== todayKey && logs[k] && ((logs[k].symptoms && logs[k].symptoms.length) || logs[k].flow || logs[k].bbt || (logs[k].notes && logs[k].notes.trim())))
    .sort((a, b) => (a < b ? 1 : -1))

  return (
    <div className="mb-10 space-y-12">
      {/* TOP HERO — phase name + editable period calendar right beneath it */}
      <section>
        {phase ? (
          <p className="font-serif italic text-4xl md:text-5xl text-stone-900">{phase.name} · Day {cycleDay}</p>
        ) : (
          <p className="font-serif italic text-2xl text-stone-500">Set your period dates to see your phase.</p>
        )}

        <div className="mt-5">
          <p className="kicker text-stone-400 mb-2">Period dates</p>
          <PeriodCalendar dates={periodDays} onChange={setPeriodDays} today={today} cycleConfig={cycleConfig} />
          <p className="mt-2 text-xs italic text-stone-400">Tap the days your period started. Your most recent start becomes Day 1 and updates the phase above — and the whole planner.</p>
        </div>
      </section>

      {/* TODAY'S LOG */}
      <section className="border-t border-stone-200 pt-8">
        <p className="kicker text-stone-400 mb-5">{fmt(today)}</p>

        <p className="kicker text-stone-400 mb-2">Symptoms</p>
        <div className="mb-6 flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => {
            const on = (todayLog.symptoms || []).includes(s)
            return <button key={s} onClick={() => toggleSymptom(s)} className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{s}</button>
          })}
        </div>

        <div className="mb-6">
          <p className="kicker text-stone-400 mb-2">Period &amp; spotting</p>
          <div className="flex flex-wrap gap-1.5">
            {FLOW.map((f) => {
              const on = todayLog.flow === f
              return <button key={f} onClick={() => setToday({ flow: on ? '' : f })} className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{f}</button>
            })}
          </div>

          {todayLog.flow && (
            <div className="mt-3">
              <label className="kicker text-stone-400 mb-1.5 block">{todayLog.flow === 'Spotting' ? 'Time spotting started' : 'Time it started'}</label>
              <input type="time" value={todayLog.flowTime || ''} onChange={(e) => setToday({ flowTime: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
            </div>
          )}
          <p className="mt-2 text-xs italic text-stone-400">Spotting is logged here but won't reset your cycle. Set true period days on the calendar up top.</p>
        </div>

        <div className="mb-6">
          <label className="kicker text-stone-400 mb-1.5 block">Basal body temp (°F)</label>
          <input type="number" step="0.1" value={todayLog.bbt || ''} onChange={(e) => setToday({ bbt: e.target.value })} placeholder="97.8" className="w-24 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>

        <div>
          <label className="kicker text-stone-400 mb-2 block">Log</label>
          <textarea value={todayLog.notes || ''} onChange={(e) => setToday({ notes: e.target.value })} placeholder="How you feel today" className="w-full min-h-[90px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
        </div>
      </section>

      {/* PREDICTIONS — What's Coming */}
      {predictions && (
        <section className="border-t border-stone-200 pt-6">
          <h3 className="font-serif italic text-2xl text-stone-900 mb-4">What's Coming.</h3>
          <div>
            {[
              ['Next period', fmt(predictions.nextPeriod)],
              ['Next ovulation', `${MONTHS[predictions.nextOv.from.getMonth()]} ${predictions.nextOv.from.getDate()} – ${predictions.nextOv.to.getDate()}`],
              ['Next phase', `${predictions.nextPhaseName} · ${fmt(predictions.nextPhaseDate)}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between border-b border-stone-100 py-2.5">
                <span className="kicker text-stone-400">{label}</span>
                <span className="text-sm text-stone-800">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PAST ENTRIES */}
      <section className="border-t border-stone-200 pt-6">
        <h3 className="font-serif italic text-2xl text-stone-900 mb-4">Past entries.</h3>
        {pastKeys.length === 0 ? (
          <p className="text-sm italic text-stone-400">No past logs yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {pastKeys.map((k) => {
              const l = logs[k]
              return (
                <button key={k} onClick={() => setReading(k)} className="flex w-full items-center justify-between py-2.5 text-left hover:text-stone-900">
                  <span className="text-sm text-stone-700">{fmt(parseKey(k))}</span>
                  <span className="text-xs text-stone-400">{(l.symptoms || []).length} symptom{(l.symptoms || []).length === 1 ? '' : 's'}{l.flow ? ` · ${l.flow}` : ''}{l.periodStart ? ' · Day 1' : ''}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {reading && logs[reading] && (
        <PastEntry dateKeyStr={reading} log={logs[reading]} onClose={() => setReading(null)} />
      )}
    </div>
  )
}

// ── Settings — its own subsection under Cycle ───────────────────────
function CycleSettings({ cycleConfig, setCycleConfig }) {
  const today = new Date()
  const todayKey = dateKey(today)
  const start = cycleConfig.lastPeriodStart || ''
  const history = Array.isArray(cycleConfig.history) ? cycleConfig.history : []
  const setCfg = (patch) => setCycleConfig({ ...cycleConfig, ...patch })
  const setHistory = (arr) => setCfg({ history: arr.filter(Boolean).sort((a, b) => (a < b ? 1 : -1)) })
  const avgLen = averageCycleLength([...history, start])
  const manualPhase = cycleConfig.manualPhase || ''

  return (
    <div className="mb-10">
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-8">Settings.</h2>

      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Last period started</label>
          <input type="date" value={start} onChange={(e) => setCfg({ lastPeriodStart: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Cycle length</label>
          <input type="number" min="20" max="45" value={cycleConfig.cycleLength || 28} onChange={(e) => setCfg({ cycleLength: Number(e.target.value) })} className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
      </div>

      <div className="mt-8">
        <label className="kicker text-stone-400 mb-2 block">Phase</label>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setCfg({ manualPhase: '' })} className={`px-2.5 py-1 text-xs border transition-colors ${!manualPhase ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>Use calculated phase</button>
          <button onClick={() => setCfg({ manualPhase: manualPhase || 'follicular' })} className={`px-2.5 py-1 text-xs border transition-colors ${manualPhase ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>Set phase manually</button>
          {manualPhase && (
            <select value={manualPhase} onChange={(e) => setCfg({ manualPhase: e.target.value })} className="ml-1 border-b border-stone-300 bg-transparent pb-1 text-sm outline-none">
              {Object.values(PHASES).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-center gap-3">
          <label className="kicker text-stone-400">Period history</label>
          {history.length >= 3 && avgLen && (
            <button onClick={() => setCfg({ cycleLength: avgLen })} className="text-[11px] uppercase tracking-[0.16em] text-stone-400 hover:text-stone-900">Avg {avgLen}d · use as length</button>
          )}
        </div>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm italic text-stone-400">No past period dates logged.</p>}
          {history.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="date" value={d} onChange={(e) => setHistory(history.map((x, j) => (j === i ? e.target.value : x)))} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
              <button onClick={() => setHistory(history.filter((_, j) => j !== i))} className="text-stone-300 hover:text-stone-700"><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => setHistory([...history, start || todayKey])} className="text-[11px] uppercase tracking-[0.16em] text-stone-400 hover:text-stone-900">Add past date</button>
        </div>
      </div>
    </div>
  )
}

// Soft per-phase day tints + a legend for the calendar.
const PHASE_TINT = { menstrual: '#F4DEDE', follicular: '#E4EDE1', ovulation: '#F2E7CF', luteal: '#E4E0EC' }
const PHASE_LEGEND = [
  { id: 'menstrual', label: 'Menstrual' },
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
]

// An inline month calendar for editing period days. Tapping a day toggles it as a
// period day (solid red). Every other day is tinted by its projected cycle phase,
// so paging month-to-month shows the whole menstrual/follicular/ovulatory/luteal
// pattern — as far back or forward as you like.
function PeriodCalendar({ dates, onChange, today, cycleConfig = {} }) {
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const set = new Set(dates)
  const cells = monthGrid(month)
  const toggle = (k) => {
    const next = new Set(set)
    if (next.has(k)) next.delete(k); else next.add(k)
    onChange([...next])
  }
  return (
    <div className="max-w-sm border border-stone-200 bg-white/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">‹</button>
        <span className="font-serif text-base text-stone-900">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d) => <div key={d} className="text-center text-[9px] uppercase tracking-[0.1em] text-stone-400">{d[0]}</div>)}
        {cells.map((cell) => {
          const k = dateKey(cell)
          const inMonth = cell.getMonth() === month.getMonth()
          const on = set.has(k)
          const isTod = isSameDay(cell, today)
          // Projected phase for this day (calculated, ignoring any manual override).
          const ph = phaseFor(cell, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
          const tint = inMonth && ph ? PHASE_TINT[ph.id] : undefined
          const style = on
            ? { backgroundColor: PHASES.menstrual.color, color: '#FAFAF7' }
            : tint ? { backgroundColor: tint } : undefined
          return (
            <button
              key={k}
              onClick={() => toggle(k)}
              style={style}
              className={`flex aspect-square items-center justify-center rounded-full text-xs transition-colors ${on ? '' : inMonth ? 'text-stone-700 hover:brightness-95' : 'text-stone-300 hover:bg-stone-100'} ${isTod && !on ? 'ring-1 ring-stone-900' : ''}`}
            >
              {cell.getDate()}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-stone-100 pt-3">
        {PHASE_LEGEND.map((p) => (
          <span key={p.id} className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-stone-500">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.id === 'menstrual' ? PHASES.menstrual.color : PHASE_TINT[p.id] }} />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Prediction({ label, value }) {
  return (
    <div className="border border-stone-200 bg-white/40 p-4">
      <p className="kicker text-stone-400 mb-1.5">{label}</p>
      <p className="font-serif text-lg text-stone-900">{value}</p>
    </div>
  )
}

function PastEntry({ dateKeyStr, log, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-cream border border-stone-300 p-6 shadow-2xl">
        <p className="font-serif italic text-2xl text-stone-900 mb-4">{fmt(parseKey(dateKeyStr))}</p>
        {(log.symptoms || []).length > 0 && (
          <div className="mb-4">
            <p className="kicker text-stone-400 mb-1.5">Symptoms</p>
            <p className="text-sm text-stone-700">{(log.symptoms || []).join(', ')}</p>
          </div>
        )}
        {log.flow && <p className="mb-4 text-sm text-stone-700"><span className="kicker text-stone-400 mr-2">Flow</span>{log.flow}{log.flowTime ? ` · ${log.flowTime}` : ''}{log.periodStart ? ' · Day 1' : ''}</p>}
        {log.bbt && <p className="mb-4 text-sm text-stone-700"><span className="kicker text-stone-400 mr-2">BBT</span>{log.bbt}°F</p>}
        {log.notes && log.notes.trim() && (
          <div className="mb-4">
            <p className="kicker text-stone-400 mb-1.5">Notes</p>
            <p className="text-sm leading-relaxed text-stone-700">{log.notes}</p>
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <button onClick={onClose} className="bg-stone-900 px-5 py-2 text-sm text-cream hover:bg-stone-700">Close</button>
        </div>
      </div>
    </div>
  )
}
