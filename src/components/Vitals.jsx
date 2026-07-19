import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'

// ── Vitals — a wearable-connected stat band beneath the horoscope. Editorial
// restraint: no cards, no color, no shadows. A newspaper index of five metrics
// separated by hairlines. Device readings here are representative placeholders
// until a live integration (Apple Health / Dexcom / etc.) is wired; Water is the
// one metric logged by hand and is fully live.

// Monochrome device marks — evocative, never the trademarked logo, one muted gray.
function Mark({ mark, size = 15 }) {
  const c = '#8A857E'
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (mark) {
    case 'ring': return <svg {...p}><circle cx="12" cy="12" r="7" /></svg>
    case 'band': return <svg {...p}><rect x="5" y="5" width="14" height="14" rx="5" /></svg>
    case 'heart': return <svg {...p}><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 1.5C19 15.5 12 20 12 20z" /></svg>
    case 'delta': return <svg {...p}><path d="M12 5l7 14H5z" /></svg>
    case 'dots': return <svg {...p} fill={c} stroke="none"><circle cx="7" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="17" cy="12" r="1.7" /></svg>
    case 'moon': return <svg {...p}><path d="M20 14.5A7 7 0 1 1 11 5.2a5.5 5.5 0 0 0 9 9.3z" /></svg>
    case 'drop': return <svg {...p}><path d="M12 4s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10z" /></svg>
    case 'hex': return <svg {...p}><path d="M12 4l7 4v8l-7 4-7-4V8z" /></svg>
    case 'pulse': return <svg {...p}><path d="M4 12h4l2-5 3 10 2-5h5" /></svg>
    case 'plus': return <svg {...p}><path d="M12 6v12M6 12h12" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="7" /></svg>
  }
}

const DEVICES = {
  oura: { name: 'Oura', mark: 'ring' },
  whoop: { name: 'Whoop', mark: 'band' },
  apple: { name: 'Apple Health', mark: 'heart' },
  garmin: { name: 'Garmin', mark: 'delta' },
  fitbit: { name: 'Fitbit', mark: 'dots' },
  eight: { name: 'Eight Sleep', mark: 'moon' },
  dexcom: { name: 'Dexcom', mark: 'drop' },
  levels: { name: 'Levels', mark: 'hex' },
  lingo: { name: 'Lingo', mark: 'drop' },
  stelo: { name: 'Stelo', mark: 'drop' },
  omron: { name: 'Omron', mark: 'pulse' },
  withings: { name: 'Withings', mark: 'pulse' },
  manual: { name: 'Logged by hand', mark: 'plus' },
}
// Which devices can feed each metric.
const CANDIDATES = {
  sleep: ['oura', 'whoop', 'apple', 'garmin', 'eight', 'fitbit'],
  water: ['manual', 'apple'],
  steps: ['apple', 'garmin', 'whoop', 'oura', 'fitbit'],
  glucose: ['dexcom', 'levels', 'lingo', 'stelo'],
  bp: ['omron', 'withings', 'apple'],
}

// Representative "today" readings (placeholders until live sync). Water is live.
const SAMPLE = {
  sleep: { min: 432, rem: 124, deep: 78, light: 214, awake: 16 }, // 7h12m
  steps: 6240,
  glucose: {
    inRange: 82, current: 94, trend: 'rising', avg: 98, variability: 18, spike: 52, spikeMeal: 'lunch',
    curve: [90, 92, 88, 94, 108, 132, 146, 128, 106, 98, 95, 92, 100, 118, 140, 124, 104, 96, 93, 90, 94, 97, 95, 92],
  },
  bp: { sys: 118, dia: 76, time: '8:14 am', flag: 'normal' },
}

const DEFAULT = {
  sleep: { device: 'oura', goalMin: 480 },
  water: { device: 'manual', goalOz: 80 },
  steps: { device: 'apple', goalSteps: 10000 },
  glucose: { device: 'dexcom' },
  bp: { device: null },
  waterLog: { date: '', oz: 0 },
}

const fmtSleep = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
const pct = (v, goal) => (goal > 0 ? Math.min(100, Math.round((v / goal) * 100)) : 0)
const TREND = { rising: '↗', steady: '→', falling: '↘' }

// The 1px fill line — ink to the goal percentage, hairline for the rest.
function Fill({ value }) {
  return (
    <div className="mt-2 h-px w-full bg-stone-200">
      <div className="h-px bg-stone-800 transition-[width] duration-500" style={{ width: `${value}%` }} />
    </div>
  )
}

export default function Vitals() {
  const [raw, setRaw] = useLocalStorage('mos:vitals', DEFAULT)
  const v = { ...DEFAULT, ...(raw || {}) }
  const todayKey = dateKey(new Date())
  const waterOz = v.waterLog && v.waterLog.date === todayKey ? v.waterLog.oz : 0

  const [connecting, setConnecting] = useState(null) // metric id
  const [goalEditing, setGoalEditing] = useState(null) // metric id
  const [popover, setPopover] = useState(null) // metric id

  const patch = (metric, p) => setRaw((s) => ({ ...DEFAULT, ...(s || {}), [metric]: { ...(s && s[metric]), ...p } }))
  const connect = (metric, device) => { patch(metric, { device }); setConnecting(null) }
  const logWater = (oz) => setRaw((s) => {
    const base = { ...DEFAULT, ...(s || {}) }
    const cur = base.waterLog && base.waterLog.date === todayKey ? base.waterLog.oz : 0
    return { ...base, waterLog: { date: todayKey, oz: Math.max(0, cur + oz) } }
  })

  return (
    <section className="mb-12">
      <h2 className="font-serif text-3xl text-stone-900">Vitals</h2>
      <div className="mt-2 border-b border-stone-200" />

      <div className="grid grid-flow-dense grid-cols-2 md:grid-cols-5">
        {/* SLEEP */}
        <Cell metric="sleep" v={v} onConnect={() => setConnecting('sleep')} onOpen={() => setPopover('sleep')}>
          {v.sleep.device ? (
            <>
              <Value num={fmtSleep(SAMPLE.sleep.min)} />
              {v.sleep.goalMin
                ? <Fill value={pct(SAMPLE.sleep.min, v.sleep.goalMin)} />
                : <SetGoal onClick={() => setGoalEditing('sleep')} />}
              <Sub>{fmtSleep(SAMPLE.sleep.rem)} REM · {fmtSleep(SAMPLE.sleep.deep)} deep</Sub>
              {goalEditing === 'sleep' && <Stepper label="hrs" value={Math.round((v.sleep.goalMin || 480) / 60)} min={4} max={12} step={1} onDone={(n) => { patch('sleep', { goalMin: n * 60 }); setGoalEditing(null) }} />}
            </>
          ) : <Connect onClick={() => setConnecting('sleep')} />}
        </Cell>

        {/* WATER — the one she logs */}
        <Cell metric="water" v={v} onConnect={() => setConnecting('water')} onOpen={() => setPopover('water')}>
          <Value num={waterOz} unit="oz" />
          {v.water.goalOz
            ? <Fill value={pct(waterOz, v.water.goalOz)} />
            : <SetGoal onClick={() => setGoalEditing('water')} />}
          <button onClick={(e) => { e.stopPropagation(); logWater(8) }} className="mt-1.5 text-left text-sm italic text-stone-500 hover:text-stone-900">+ log a glass</button>
          {goalEditing === 'water' && <Stepper label="oz" value={v.water.goalOz || 80} min={20} max={160} step={8} onDone={(n) => { patch('water', { goalOz: n }); setGoalEditing(null) }} />}
        </Cell>

        {/* STEPS */}
        <Cell metric="steps" v={v} onConnect={() => setConnecting('steps')} onOpen={() => setPopover('steps')}>
          {v.steps.device ? (
            <>
              <Value num={SAMPLE.steps.toLocaleString()} />
              {v.steps.goalSteps
                ? <Fill value={pct(SAMPLE.steps, v.steps.goalSteps)} />
                : <SetGoal onClick={() => setGoalEditing('steps')} />}
              <Sub>active now</Sub>
              {goalEditing === 'steps' && <Stepper label="k" value={Math.round((v.steps.goalSteps || 10000) / 1000)} min={2} max={30} step={1} onDone={(n) => { patch('steps', { goalSteps: n * 1000 }); setGoalEditing(null) }} />}
            </>
          ) : <Connect onClick={() => setConnecting('steps')} />}
        </Cell>

        {/* GLUCOSE — wearable only, Time in Range is the goal-like headline */}
        <Cell metric="glucose" v={v} full onConnect={() => setConnecting('glucose')} onOpen={() => setPopover('glucose')}>
          {v.glucose.device ? (
            <>
              <Value num={`${SAMPLE.glucose.inRange}%`} unit="in range" />
              <Fill value={SAMPLE.glucose.inRange} />
              <Sub>{SAMPLE.glucose.current} mg/dL {TREND[SAMPLE.glucose.trend]} now</Sub>
            </>
          ) : <Connect onClick={() => setConnecting('glucose')} />}
        </Cell>

        {/* BLOOD PRESSURE — spot reading, no fill line */}
        <Cell metric="bp" v={v} onConnect={() => setConnecting('bp')} onOpen={() => setPopover('bp')}>
          {v.bp.device ? (
            <>
              <Value num={`${SAMPLE.bp.sys}/${SAMPLE.bp.dia}`} />
              <Sub>{SAMPLE.bp.flag} · {SAMPLE.bp.time}</Sub>
            </>
          ) : <Connect onClick={() => setConnecting('bp')} />}
        </Cell>
      </div>

      {connecting && (
        <ConnectModal
          metric={connecting}
          current={v[connecting] && v[connecting].device}
          onPick={(d) => connect(connecting, d)}
          onClose={() => setConnecting(null)}
        />
      )}
      {popover && <VitalPopover metric={popover} v={v} waterOz={waterOz} onLog={logWater} onClose={() => setPopover(null)} />}
    </section>
  )
}

// One cell of the band: brand mark up top, then the metric's body, hairlines
// between columns (left on desktop, row underlines on mobile).
function Cell({ metric, v, full, onOpen, children }) {
  const device = v[metric] && v[metric].device
  const dim = !device
  return (
    <button
      onClick={onOpen}
      className={`group relative flex flex-col items-start border-b border-stone-200 px-4 py-4 text-left transition-colors md:border-b-0 md:border-l md:first:border-l-0 ${full ? 'col-span-2 md:col-span-1' : ''} ${dim ? 'opacity-60 hover:opacity-100' : ''}`}
    >
      <div className="mb-2 h-4">{device ? <Mark mark={DEVICES[device].mark} /> : null}</div>
      <span className="kicker text-stone-400">{LABEL[metric]}</span>
      <div className="mt-1 w-full">{children}</div>
    </button>
  )
}
const LABEL = { sleep: 'Sleep', water: 'Water', steps: 'Steps', glucose: 'Glucose', bp: 'Blood Pressure' }

function Value({ num, unit }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-serif text-2xl leading-none text-stone-900">{num}</span>
      {unit && <span className="text-xs text-stone-400">{unit}</span>}
    </div>
  )
}
const Sub = ({ children }) => <p className="mt-2 text-xs text-stone-400">{children}</p>
const SetGoal = ({ onClick }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick() }} className="mt-2 block text-xs italic text-stone-400 underline underline-offset-2 hover:text-stone-700">set a goal</button>
)
const Connect = ({ onClick }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick() }} className="mt-1 rounded-full border border-stone-300 px-3 py-1 text-xs uppercase tracking-[0.14em] text-stone-500 hover:border-stone-900 hover:text-stone-900">connect</button>
)

// Inline goal stepper — muted, minus/value/plus/done.
function Stepper({ label, value, min, max, step, onDone }) {
  const [n, setN] = useState(value)
  const clamp = (x) => Math.max(min, Math.min(max, x))
  return (
    <div onClick={(e) => e.stopPropagation()} className="mt-2 flex items-center gap-2 text-sm text-stone-700">
      <button onClick={() => setN((x) => clamp(x - step))} className="h-6 w-6 border border-stone-300 text-stone-600 hover:border-stone-900">–</button>
      <span className="w-14 text-center tabular-nums">{n} {label}</span>
      <button onClick={() => setN((x) => clamp(x + step))} className="h-6 w-6 border border-stone-300 text-stone-600 hover:border-stone-900">+</button>
      <button onClick={() => onDone(n)} className="ml-1 bg-stone-900 px-3 py-1 text-xs text-cream hover:bg-stone-700">Set</button>
    </div>
  )
}

// Connect dropdown — the metric's candidate wearables, each with its mark.
function ConnectModal({ metric, current, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <span className="kicker text-stone-400">Connect {LABEL[metric]}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="py-2">
          {CANDIDATES[metric].map((d) => (
            <button key={d} onClick={() => onPick(d)} className={`flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-stone-100 ${current === d ? 'text-stone-900' : 'text-stone-600'}`}>
              <Mark mark={DEVICES[d].mark} />
              <span className="flex-1">{DEVICES[d].name}</span>
              {current === d && <span className="kicker text-stone-400">connected</span>}
            </button>
          ))}
        </div>
        {metric === 'glucose' && <p className="border-t border-stone-100 px-5 py-3 text-xs italic text-stone-400">A continuous glucose sensor, read every few minutes. No manual entry.</p>}
      </div>
    </div>
  )
}

// A thin single-stroke line chart of the day's glucose curve.
function GlucoseChart({ curve }) {
  const w = 260, h = 60
  const min = Math.min(...curve), max = Math.max(...curve)
  const span = max - min || 1
  const pts = curve.map((val, i) => `${(i / (curve.length - 1)) * w},${h - ((val - min) / span) * (h - 8) - 4}`).join(' ')
  // Range band 70–140 shaded faintly.
  const yFor = (val) => h - ((val - min) / span) * (h - 8) - 4
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Glucose today">
      <rect x="0" y={yFor(140)} width={w} height={Math.max(0, yFor(70) - yFor(140))} fill="#8A9E8A" opacity="0.1" />
      <polyline points={pts} fill="none" stroke="#57534e" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// The per-cell popover — same centered card as the planner's other pop-ups.
function VitalPopover({ metric, v, waterOz, onLog, onClose }) {
  const device = v[metric] && v[metric].device
  const rows = []
  let title = LABEL[metric], big = '', chart = null, extra = null

  if (metric === 'sleep') {
    const s = SAMPLE.sleep
    big = fmtSleep(s.min)
    rows.push(['REM', fmtSleep(s.rem)], ['Deep', fmtSleep(s.deep)], ['Light', fmtSleep(s.light)], ['Awake', fmtSleep(s.awake)])
    if (v.sleep.goalMin) rows.push(['Goal', `${Math.round(v.sleep.goalMin / 60)}h · ${pct(s.min, v.sleep.goalMin)}%`])
  } else if (metric === 'steps') {
    big = `${SAMPLE.steps.toLocaleString()} steps`
    if (v.steps.goalSteps) rows.push(['Goal', `${(v.steps.goalSteps / 1000)}k · ${pct(SAMPLE.steps, v.steps.goalSteps)}%`])
    rows.push(['Status', 'active now'])
  } else if (metric === 'water') {
    big = `${waterOz} oz`
    if (v.water.goalOz) rows.push(['Goal', `${v.water.goalOz} oz · ${pct(waterOz, v.water.goalOz)}%`])
    rows.push(['Glasses', `${Math.round(waterOz / 8)}`])
    extra = (
      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => onLog(8)} className="flex-1 bg-stone-900 px-3 py-2 text-sm text-cream hover:bg-stone-700">+ Glass (8 oz)</button>
        <button onClick={() => onLog(-8)} className="border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:border-stone-900">–</button>
      </div>
    )
  } else if (metric === 'glucose') {
    const g = SAMPLE.glucose
    title = 'Glucose'
    big = `${g.inRange}% in range`
    chart = <GlucoseChart curve={g.curve} />
    rows.push(['Current', `${g.current} mg/dL ${TREND[g.trend]}`], ['Average', `${g.avg} mg/dL`], ['Variability', `±${g.variability} mg/dL`], ['Biggest spike', `+${g.spike} after ${g.spikeMeal}`])
  } else if (metric === 'bp') {
    big = `${SAMPLE.bp.sys}/${SAMPLE.bp.dia}`
    rows.push(['Status', SAMPLE.bp.flag], ['Taken', SAMPLE.bp.time])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="flex items-center gap-2 kicker text-stone-400">{device && <Mark mark={DEVICES[device].mark} />}{device ? DEVICES[device].name : title}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6 pt-3">
          <p className="kicker text-stone-400">{title}</p>
          <p className="mt-1 font-serif text-3xl text-stone-900">{big || '—'}</p>
          {chart && <div className="mt-4">{chart}</div>}
          {device ? (
            <div className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <span className="kicker text-stone-400">{label}</span>
                  <span className="text-sm text-stone-800">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm italic text-stone-400">Not connected yet.</p>
          )}
          {extra}
        </div>
      </div>
    </div>
  )
}
