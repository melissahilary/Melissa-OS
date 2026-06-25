import React, { useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PHASES, phaseFor, cycleDayFor, startOfDay } from '../lib/cycle'
import { dateKey, parseKey, addDays, MONTHS } from '../lib/date'
import SectionTitle from './shared/SectionTitle'
import Protocols from './Protocols'

const MS_DAY = 86400000
const fmt = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

export default function Workout({ cycleConfig = {}, setCycleConfig = () => {}, subPage = 'protocols' }) {
  return (
    <div>
      {subPage === 'protocols' && <Protocols />}
      {subPage === 'cycle' && <CyclePage cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} />}
    </div>
  )
}

// ── Cycle tracking ──────────────────────────────────────────────────
const SYMPTOMS = [
  'Bloating', 'Cramps', 'Headache', 'Fatigue', 'High Energy', 'Brain Fog', 'Mood Swings',
  'Clear Skin', 'Breakouts', 'Strong Libido', 'Low Libido', 'Tender Breasts', 'Back Pain',
  'Insomnia', 'Deep Sleep', 'Anxiety', 'Calm', 'Irritable', 'Emotional', 'Confident',
]
const FLOW = ['Light', 'Medium', 'Heavy', 'Spotting']

// Phase segments across one cycle, in day order, with their starting cycle-day.
const PHASE_SEG = [
  { id: 'menstrual', label: 'Menstrual', start: 1 },
  { id: 'follicular', label: 'Follicular', start: 6 },
  { id: 'ovulation', label: 'Ovulatory', start: 14 },
  { id: 'luteal', label: 'Luteal', start: 17 },
]

function CyclePage({ cycleConfig, setCycleConfig }) {
  const today = new Date()
  const todayKey = dateKey(today)
  const start = cycleConfig.lastPeriodStart || ''
  const len = Number(cycleConfig.cycleLength) > 0 ? Number(cycleConfig.cycleLength) : 28
  const phase = phaseFor(today, start, len)
  const cycleDay = cycleDayFor(today, start, len)

  const [logs, setLogs] = useLocalStorage('mos:cycle:logs', {})
  const [reading, setReading] = useState(null) // a past date key being read
  const todayLog = logs[todayKey] || { symptoms: [], flow: '', bbt: '', notes: '' }
  const setToday = (patch) => setLogs((p) => ({ ...p, [todayKey]: { symptoms: [], flow: '', bbt: '', notes: '', ...(p[todayKey] || {}), ...patch } }))
  const toggleSymptom = (s) => {
    const cur = todayLog.symptoms || []
    setToday({ symptoms: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
  }

  // Segment widths (in days) for the timeline + today's marker position.
  const seg = PHASE_SEG.map((s, i) => {
    const next = PHASE_SEG[i + 1]
    const days = (next ? next.start : len + 1) - s.start
    return { ...s, days: Math.max(0, days) }
  })
  const markerPct = cycleDay ? Math.min(100, ((cycleDay - 0.5) / len) * 100) : null

  // Predictions.
  const predictions = useMemo(() => {
    if (!start) return null
    const s0 = startOfDay(parseKey(start))
    const daysSince = Math.floor((startOfDay(today) - s0) / MS_DAY)
    const cyclesDone = Math.max(0, Math.floor(daysSince / len))
    const curStart = addDays(s0, cyclesDone * len)
    const nextStart = addDays(s0, (cyclesDone + 1) * len)
    const cd = cycleDay || 1
    const ovById = (base) => ({ from: addDays(base, 13), to: addDays(base, 15) })
    const nextOv = cd < 14 ? ovById(curStart) : ovById(nextStart)
    // Next phase boundary after today.
    const boundaries = [6, 14, 17, len + 1]
    const nextBoundDay = boundaries.find((b) => b > cd)
    let nextPhaseDate, nextPhaseName
    if (nextBoundDay && nextBoundDay <= len) {
      nextPhaseDate = addDays(curStart, nextBoundDay - 1)
      const segMatch = PHASE_SEG.find((p) => p.start === nextBoundDay)
      nextPhaseName = segMatch ? segMatch.label : ''
    } else {
      nextPhaseDate = nextStart
      nextPhaseName = 'Menstrual'
    }
    return { nextPeriod: nextStart, nextOv, nextPhaseDate, nextPhaseName }
  }, [start, len, cycleDay, today])

  const pastKeys = Object.keys(logs)
    .filter((k) => k !== todayKey && logs[k] && ((logs[k].symptoms && logs[k].symptoms.length) || logs[k].flow || logs[k].bbt || (logs[k].notes && logs[k].notes.trim())))
    .sort((a, b) => (a < b ? 1 : -1))

  return (
    <div className="mb-10">
      <SectionTitle kicker="02 · The body" title="Cycle." />

      {/* Current phase + day */}
      <section className="mb-8">
        {phase ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 px-4 py-2 text-sm" style={{ backgroundColor: phase.color, color: phase.ink }}>
              <span className="font-medium">{phase.name}</span>
              <span className="opacity-70">Day {cycleDay}</span>
            </span>
            <span className="text-sm text-stone-500">{phase.range}</span>
          </div>
        ) : (
          <p className="text-sm text-stone-400">Set your last period below to see your current phase.</p>
        )}
      </section>

      {/* Phase timeline */}
      {phase && (
        <section className="mb-10">
          <div className="relative">
            <div className="flex h-7 w-full overflow-hidden rounded-sm">
              {seg.map((s) => (
                <div key={s.id} className="flex items-center justify-center" style={{ width: `${(s.days / len) * 100}%`, backgroundColor: PHASES[s.id].color }} title={s.label} />
              ))}
            </div>
            {markerPct != null && (
              <div className="absolute -top-1 h-9 w-0.5 bg-stone-900" style={{ left: `${markerPct}%` }} />
            )}
          </div>
          <div className="mt-2 flex w-full">
            {seg.map((s) => (
              <div key={s.id} className="text-center" style={{ width: `${(s.days / len) * 100}%` }}>
                <span className="kicker text-stone-400">{s.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cycle config */}
      <section className="mb-10 flex flex-wrap items-end gap-6 border-t border-stone-200 pt-6">
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Last period started</label>
          <input type="date" value={start} onChange={(e) => setCycleConfig({ ...cycleConfig, lastPeriodStart: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Cycle length</label>
          <input type="number" min="20" max="45" value={cycleConfig.cycleLength || 28} onChange={(e) => setCycleConfig({ ...cycleConfig, cycleLength: Number(e.target.value) })} className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
      </section>

      {/* Today's log */}
      <section className="mb-10 border-t border-stone-200 pt-6">
        <h3 className="font-serif italic text-2xl text-stone-900 mb-1">Today's log</h3>
        <p className="kicker text-stone-400 mb-5">{fmt(today)}</p>

        <p className="kicker text-stone-400 mb-2">Symptoms</p>
        <div className="mb-6 flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => {
            const on = (todayLog.symptoms || []).includes(s)
            return (
              <button key={s} onClick={() => toggleSymptom(s)} className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{s}</button>
            )
          })}
        </div>

        {phase && phase.id === 'menstrual' && (
          <div className="mb-6">
            <p className="kicker text-stone-400 mb-2">Flow intensity</p>
            <div className="flex flex-wrap gap-1.5">
              {FLOW.map((f) => {
                const on = todayLog.flow === f
                return <button key={f} onClick={() => setToday({ flow: on ? '' : f })} className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{f}</button>
              })}
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-end gap-6">
          <div>
            <label className="kicker text-stone-400 mb-1.5 block">Basal body temp (°F)</label>
            <input type="number" step="0.1" value={todayLog.bbt || ''} onChange={(e) => setToday({ bbt: e.target.value })} placeholder="97.8" className="w-24 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
          </div>
        </div>

        <div>
          <label className="kicker text-stone-400 mb-2 block">Notes</label>
          <textarea value={todayLog.notes || ''} onChange={(e) => setToday({ notes: e.target.value })} placeholder="How you feel today" className="w-full min-h-[90px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
        </div>
      </section>

      {/* Predictions */}
      {predictions && (
        <section className="mb-10 border-t border-stone-200 pt-6">
          <h3 className="font-serif italic text-2xl text-stone-900 mb-4">Predictions</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Prediction label="Next period" value={fmt(predictions.nextPeriod)} />
            <Prediction label="Next ovulation window" value={`${MONTHS[predictions.nextOv.from.getMonth()]} ${predictions.nextOv.from.getDate()} – ${predictions.nextOv.to.getDate()}`} />
            <Prediction label="Next phase start" value={`${predictions.nextPhaseName} · ${fmt(predictions.nextPhaseDate)}`} />
          </div>
        </section>
      )}

      {/* Past entries */}
      <section className="border-t border-stone-200 pt-6">
        <h3 className="font-serif italic text-2xl text-stone-900 mb-4">Past entries</h3>
        {pastKeys.length === 0 ? (
          <p className="text-sm italic text-stone-400">No past logs yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {pastKeys.map((k) => {
              const l = logs[k]
              return (
                <button key={k} onClick={() => setReading(k)} className="flex w-full items-center justify-between py-2.5 text-left hover:text-stone-900">
                  <span className="text-sm text-stone-700">{fmt(parseKey(k))}</span>
                  <span className="text-xs text-stone-400">{(l.symptoms || []).length} symptom{(l.symptoms || []).length === 1 ? '' : 's'}{l.flow ? ` · ${l.flow}` : ''}</span>
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
        {log.flow && <p className="mb-4 text-sm text-stone-700"><span className="kicker text-stone-400 mr-2">Flow</span>{log.flow}</p>}
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
