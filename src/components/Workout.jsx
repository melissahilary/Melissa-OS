import React, { useMemo, useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PHASES, phaseForConfig, cycleDayFor, startOfDay, averageCycleLength } from '../lib/cycle'
import { dateKey, parseKey, addDays, MONTHS } from '../lib/date'
import { useActivities } from '../hooks/useActivities'
import { activityOccursOn } from '../lib/activities'

const MS_DAY = 86400000
const fmt = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

export default function Workout({ cycleConfig = {}, setCycleConfig = () => {}, goToDay = () => {} }) {
  return (
    <div>
      <CyclePage cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} goToDay={goToDay} />
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

  const { activities } = useActivities()
  const [logs, setLogs] = useLocalStorage('mos:cycle:logs', {})
  const [reading, setReading] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const todayLog = logs[todayKey] || { symptoms: [], flow: '', bbt: '', notes: '' }
  const setToday = (patch) => setLogs((p) => ({ ...p, [todayKey]: { symptoms: [], flow: '', bbt: '', notes: '', ...(p[todayKey] || {}), ...patch } }))
  const toggleSymptom = (s) => { const cur = todayLog.symptoms || []; setToday({ symptoms: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] }) }

  // Settings / history.
  const history = Array.isArray(cycleConfig.history) ? cycleConfig.history : []
  const setCfg = (patch) => setCycleConfig({ ...cycleConfig, ...patch })
  const setHistory = (arr) => setCfg({ history: arr.filter(Boolean).sort((a, b) => (a < b ? 1 : -1)) })
  const avgLen = averageCycleLength([...history, start])
  const manualPhase = cycleConfig.manualPhase || ''

  // Marking a true period start resets Day 1 to today: the old start drops into
  // history (so average cycle length re-learns) and predictions recompute.
  const isDayOne = start === todayKey
  const markPeriodStart = () => {
    const merged = (start && start !== todayKey ? [...history, start] : history)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => (a < b ? 1 : -1))
    setCfg({ lastPeriodStart: todayKey, history: merged, manualPhase: '' })
    setToday({ periodStart: true, flow: todayLog.flow && todayLog.flow !== 'Spotting' ? todayLog.flow : 'Light' })
  }

  // Hero timeline segments + today marker.
  const seg = PHASE_SEG.map((s, i) => { const next = PHASE_SEG[i + 1]; const days = (next ? next.start : len + 1) - s.start; return { ...s, days: Math.max(0, days) } })
  const markerPct = cycleDay ? Math.min(100, ((cycleDay - 0.5) / len) * 100) : null
  const energy = phase ? ENERGY[phase.id] || 0 : 0

  // Load balancing — current week (Mon-Sun) item counts.
  const monday = (() => { const d = new Date(today); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d })()
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const counts = weekDates.map((d) => activities.filter((a) => a.status !== 'archived' && activityOccursOn(a, dateKey(d))).length)
  const maxCount = Math.max(1, ...counts)
  const order = counts.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c)
  const heavy = new Set(order.slice(0, 2).filter((x) => x.c > 0).map((x) => x.i))
  const light = new Set(order.slice(-2).map((x) => x.i))

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
      {/* TOP HERO — Today's Status */}
      <section>
        {phase ? (
          <>
            <p className="font-serif italic text-4xl md:text-5xl text-stone-900">{phase.name} · Day {cycleDay}</p>
            <div className="relative mt-6">
              <div className="flex h-8 w-full overflow-hidden rounded-sm">
                {seg.map((s) => <div key={s.id} title={s.label} style={{ width: `${(s.days / len) * 100}%`, backgroundColor: PHASES[s.id].color }} />)}
              </div>
              {markerPct != null && (
                <div className="absolute -top-1.5 flex flex-col items-center" style={{ left: `calc(${markerPct}% - 5px)` }}>
                  <span className="block h-3 w-3 rounded-full border-2 border-cream bg-stone-900" />
                </div>
              )}
            </div>
            <div className="mt-2 flex w-full">
              {seg.map((s) => <div key={s.id} className="text-center" style={{ width: `${(s.days / len) * 100}%` }}><span className="text-[10px] uppercase tracking-[0.12em] text-stone-400">{s.label}</span></div>)}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <span className="kicker text-stone-400">Energy</span>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => <span key={n} className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: n <= energy ? phase.color : 'transparent', borderColor: phase.color }} />)}
              </div>
            </div>
            <p className="mt-4 font-serif italic text-lg text-stone-600">{INTENTION[phase.id]}</p>
          </>
        ) : (
          <p className="text-sm text-stone-400">Set your last period in Cycle Settings to see your status.</p>
        )}
      </section>

      {/* LOAD BALANCING — This Week at a Glance */}
      <section>
        <h3 className="font-serif italic text-2xl text-stone-900 mb-4">This Week at a Glance.</h3>
        <div className="flex items-end gap-2">
          {weekDates.map((d, i) => {
            const isTod = dateKey(d) === todayKey
            const h = 8 + (counts[i] / maxCount) * 56
            return (
              <button key={i} onClick={() => goToDay(dateKey(d))} className="group flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-16 items-end">
                  <div className="w-5 transition-colors" style={{ height: `${h}px`, backgroundColor: isTod ? '#1c1917' : '#d6d3d1' }} />
                </div>
                <span className={`text-[10px] uppercase tracking-[0.1em] ${isTod ? 'text-stone-900' : 'text-stone-400'}`}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                {heavy.has(i) ? <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#C4A882' }} /> : light.has(i) ? <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#7B8B5F' }} /> : <span className="h-1.5 w-1.5" />}
              </button>
            )
          })}
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

          <div className="mt-4">
            {isDayOne ? (
              <p className="text-sm text-stone-600">✓ Today is <span className="text-stone-900">Day 1</span> — predictions now count from here.</p>
            ) : (
              <button onClick={markPeriodStart} className="bg-stone-900 px-4 py-2 text-sm text-cream hover:bg-stone-700">Mark today as Day 1 (period start)</button>
            )}
            <p className="mt-2 text-xs italic text-stone-400">Spotting is logged but won't reset your cycle. Mark Day 1 only when true flow begins.</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="kicker text-stone-400 mb-1.5 block">Basal body temp (°F)</label>
          <input type="number" step="0.1" value={todayLog.bbt || ''} onChange={(e) => setToday({ bbt: e.target.value })} placeholder="97.8" className="w-24 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>

        <div>
          <label className="kicker text-stone-400 mb-2 block">Notes</label>
          <textarea value={todayLog.notes || ''} onChange={(e) => setToday({ notes: e.target.value })} placeholder="How you feel today" className="w-full min-h-[90px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
        </div>
      </section>

      {/* CYCLE SETTINGS — collapsible */}
      <section className="border-t border-stone-200 pt-6">
        <button onClick={() => setSettingsOpen((o) => !o)} className="flex w-full items-center justify-between">
          <span className="kicker text-stone-500">Cycle Settings</span>
          {settingsOpen ? <ChevronDown size={16} className="text-stone-400" /> : <ChevronRight size={16} className="text-stone-400" />}
        </button>
        {settingsOpen && (
          <div className="mt-5">
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

            <div className="mt-6">
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

            <div className="mt-6">
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
        )}
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
