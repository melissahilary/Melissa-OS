import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'

// ── Vitals — a wearable-connected stat band beneath the horoscope. Editorial
// restraint: no cards, no color, no shadows. Nothing is prefilled: a metric shows
// data only once it is connected AND that data exists. Live device sync (Apple
// Health / Dexcom / …) isn't wired yet, so a connected metric reads "no data yet"
// until it syncs; anything you enter by hand (water, and manual sleep/steps/BP) is
// fully live and persists for the day.

// Monochrome device marks — evocative, never the trademarked logo, one muted gray.
function Mark({ mark, size = 15 }) {
  const c = '#8A857E'
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (mark) {
    case 'heart': return <svg {...p}><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 1.5C19 15.5 12 20 12 20z" /></svg>
    case 'plus': return <svg {...p}><path d="M12 6v12M6 12h12" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="7" /></svg>
  }
}
const DEVICES = {
  apple: { name: 'Apple Health', mark: 'heart' },
  manual: { name: 'Entered by hand', mark: 'plus' },
}

// Everything connects through Apple Health, the hub. `works` lists the devices
// that feed that metric into Health; `manual` allows hand entry (never glucose).
const CONNECT = {
  sleep: { works: ['Oura', 'Whoop', 'Apple Watch', 'Garmin', 'Fitbit', 'Eight Sleep'], manual: true },
  water: { works: [], manual: true },
  steps: { works: ['Apple Watch', 'Oura', 'Whoop', 'Garmin', 'Fitbit'], manual: true },
  glucose: { works: ['Stelo', 'Dexcom', 'Freestyle Libre', 'Lingo'], manual: false },
  bp: { works: ['Omron', 'Withings', 'QardioArm'], manual: true },
}

const DEFAULT = {
  sleep: { device: null, goalMin: null, manual: null }, // manual: { date, min }
  water: { device: null, goalOz: null },
  steps: { device: null, goalSteps: null, manual: null }, // manual: { date, steps }
  glucose: { device: null },
  bp: { device: null, manual: null }, // manual: { date, sys, dia }
  waterLog: { date: '', oz: 0 },
}

const LABEL = { sleep: 'Sleep', water: 'Water', steps: 'Steps', glucose: 'Glucose', bp: 'Blood Pressure' }
const fmtSleep = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
const pct = (v, goal) => (goal > 0 ? Math.min(100, Math.round((v / goal) * 100)) : 0)
const todayOnly = (obj, todayKey) => (obj && obj.date === todayKey ? obj : null)

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
  const sleepMin = (todayOnly(v.sleep.manual, todayKey) || {}).min ?? null
  const stepsVal = (todayOnly(v.steps.manual, todayKey) || {}).steps ?? null
  const bpVal = todayOnly(v.bp.manual, todayKey)

  const [connecting, setConnecting] = useState(null)
  const [popover, setPopover] = useState(null)

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
        <Cell metric="sleep" device={v.sleep.device} onOpen={() => setPopover('sleep')} onConnect={() => setConnecting('sleep')}>
          {sleepMin != null ? (
            <>
              <Value num={fmtSleep(sleepMin)} />
              {v.sleep.goalMin ? <Fill value={pct(sleepMin, v.sleep.goalMin)} /> : null}
            </>
          ) : <Empty device={v.sleep.device} onEnter={() => setPopover('sleep')} />}
        </Cell>

        {/* WATER — the one she logs */}
        <Cell metric="water" device={v.water.device} onOpen={() => setPopover('water')} onConnect={() => setConnecting('water')}>
          <Value num={waterOz} unit="oz" />
          {v.water.goalOz ? <Fill value={pct(waterOz, v.water.goalOz)} /> : null}
          <button onClick={(e) => { e.stopPropagation(); logWater(8) }} className="mt-1.5 text-left text-sm italic text-stone-500 hover:text-stone-900">+ log a glass</button>
        </Cell>

        {/* STEPS */}
        <Cell metric="steps" device={v.steps.device} onOpen={() => setPopover('steps')} onConnect={() => setConnecting('steps')}>
          {stepsVal != null ? (
            <>
              <Value num={stepsVal.toLocaleString()} />
              {v.steps.goalSteps ? <Fill value={pct(stepsVal, v.steps.goalSteps)} /> : null}
            </>
          ) : <Empty device={v.steps.device} onEnter={() => setPopover('steps')} />}
        </Cell>

        {/* GLUCOSE — CGM only, no manual, no data until it syncs */}
        <Cell metric="glucose" device={v.glucose.device} full onOpen={() => setPopover('glucose')} onConnect={() => setConnecting('glucose')}>
          <Empty device={v.glucose.device} />
        </Cell>

        {/* BLOOD PRESSURE — spot reading, no fill line */}
        <Cell metric="bp" device={v.bp.device} onOpen={() => setPopover('bp')} onConnect={() => setConnecting('bp')}>
          {bpVal ? <Value num={`${bpVal.sys}/${bpVal.dia}`} /> : <Empty device={v.bp.device} onEnter={() => setPopover('bp')} />}
        </Cell>
      </div>

      {connecting && <ConnectModal metric={connecting} onPick={(d) => connect(connecting, d)} onClose={() => setConnecting(null)} />}
      {popover && (
        <VitalPopover
          metric={popover}
          v={v}
          waterOz={waterOz}
          sleepMin={sleepMin}
          stepsVal={stepsVal}
          bpVal={bpVal}
          onLogWater={logWater}
          onSaveManual={(data) => patch(popover, { manual: { date: todayKey, ...data } })}
          onSetGoal={(g) => patch(popover, g)}
          onClose={() => setPopover(null)}
        />
      )}
    </section>
  )
}

// One cell of the band — a div (not a nested button) so its inner controls are valid.
function Cell({ metric, device, full, onOpen, onConnect, children }) {
  return (
    <div
      onClick={device ? onOpen : undefined}
      className={`group relative flex flex-col items-start border-b border-stone-200 px-4 py-4 text-left transition-colors md:border-b-0 md:border-l md:first:border-l-0 ${full ? 'col-span-2 md:col-span-1' : ''} ${device ? 'cursor-pointer' : 'opacity-70'}`}
    >
      <div className="mb-2 h-4">{device ? <Mark mark={DEVICES[device].mark} /> : null}</div>
      <span className="kicker text-stone-400">{LABEL[metric]}</span>
      <div className="mt-1 w-full">
        {device ? children : <Connect onClick={onConnect} />}
      </div>
    </div>
  )
}

function Value({ num, unit }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-serif text-2xl leading-none text-stone-900">{num}</span>
      {unit && <span className="text-xs text-stone-400">{unit}</span>}
    </div>
  )
}
// Connected, but nothing to show yet. Manual metrics offer hand entry; synced ones wait.
function Empty({ device, onEnter }) {
  if (device === 'manual' && onEnter) {
    return <button onClick={(e) => { e.stopPropagation(); onEnter() }} className="mt-1 text-sm italic text-stone-500 hover:text-stone-900">+ add today</button>
  }
  return <p className="mt-1 text-sm italic text-stone-300">no data yet</p>
}
const Connect = ({ onClick }) => (
  <button onClick={(e) => { e.stopPropagation(); onClick() }} className="mt-1 rounded-full border border-stone-300 px-3 py-1 text-xs uppercase tracking-[0.14em] text-stone-500 hover:border-stone-900 hover:text-stone-900">connect</button>
)

// Connect prompt — everything flows through Apple Health; a "Works with" line, an
// editorial aside, one Connect action, and (except glucose) manual entry.
function ConnectModal({ metric, onPick, onClose }) {
  const cfg = CONNECT[metric]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-4">
          <span className="flex items-center gap-2 kicker text-stone-400"><Mark mark="heart" /> Apple Health</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6 pt-3">
          <p className="font-serif text-2xl text-stone-900">{LABEL[metric]} <span className="text-stone-400">· via Apple Health</span></p>
          {cfg.works.length > 0 && (
            <p className="mt-3 text-sm text-stone-500">
              Works with:{' '}
              {cfg.works.map((d, i) => (
                <React.Fragment key={d}>
                  {i > 0 && <span className="text-stone-300"> · </span>}
                  <span className="font-medium text-stone-800">{d}</span>
                </React.Fragment>
              ))}
            </p>
          )}
          {cfg.works.length > 0 && (
            <p className="my-5 border-y py-3 text-xs italic" style={{ borderColor: 'rgba(0,0,0,0.07)', color: '#55504A' }}>
              First, make sure your device's app is set to write to Apple Health.
            </p>
          )}
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${cfg.works.length > 0 ? '' : 'mt-6'}`}>
            <button onClick={() => onPick('apple')} className="bg-stone-900 px-6 py-2.5 text-sm text-cream hover:bg-stone-700">Connect</button>
            {cfg.manual && (
              <button onClick={() => onPick('manual')} className="text-sm italic text-stone-500 hover:text-stone-900">· or enter manually</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const lineCls = 'w-20 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900'

// The per-cell popover — same centered card as the planner's other pop-ups. Holds
// the manual-entry forms and goal setters; shows synced-metric empty states plainly.
function VitalPopover({ metric, v, waterOz, sleepMin, stepsVal, bpVal, onLogWater, onSaveManual, onSetGoal, onClose }) {
  const device = v[metric] && v[metric].device
  const manual = device === 'manual'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="flex items-center gap-2 kicker text-stone-400">{device && <Mark mark={DEVICES[device].mark} />}{device ? DEVICES[device].name : LABEL[metric]}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6 pt-3">
          <p className="kicker text-stone-400">{LABEL[metric]}</p>

          {metric === 'water' && <WaterBody v={v} waterOz={waterOz} onLog={onLogWater} onSetGoal={onSetGoal} />}
          {metric === 'sleep' && <SleepBody v={v} sleepMin={sleepMin} manual={manual} onSave={onSaveManual} onSetGoal={onSetGoal} />}
          {metric === 'steps' && <StepsBody v={v} stepsVal={stepsVal} manual={manual} onSave={onSaveManual} onSetGoal={onSetGoal} />}
          {metric === 'bp' && <BpBody bpVal={bpVal} manual={manual} onSave={onSaveManual} />}
          {metric === 'glucose' && (
            <>
              <p className="mt-1 font-serif text-3xl text-stone-900">—</p>
              <p className="mt-3 text-sm italic text-stone-400">Waiting for your CGM to sync through Apple Health. Time in range, average and your daily curve will appear here.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Waiting() {
  return <p className="mt-3 text-sm italic text-stone-400">No data yet. It will appear here once it syncs through Apple Health.</p>
}
function GoalRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-t border-stone-100 py-2.5">
      <span className="kicker text-stone-400">{label}</span>
      <span className="text-sm text-stone-800">{value}</span>
    </div>
  )
}

function WaterBody({ v, waterOz, onLog, onSetGoal }) {
  const [goal, setGoal] = useState(v.water.goalOz || 80)
  return (
    <>
      <p className="mt-1 font-serif text-3xl text-stone-900">{waterOz} <span className="text-base text-stone-400">oz</span></p>
      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => onLog(8)} className="flex-1 bg-stone-900 px-3 py-2 text-sm text-cream hover:bg-stone-700">+ Glass (8 oz)</button>
        <button onClick={() => onLog(-8)} className="border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:border-stone-900">–</button>
      </div>
      <div className="mt-4">
        {v.water.goalOz && <GoalRow label="Goal" value={`${v.water.goalOz} oz · ${pct(waterOz, v.water.goalOz)}%`} />}
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-600">
          <span className="kicker text-stone-400">Daily goal</span>
          <input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} className={lineCls} />
          <span className="text-stone-400">oz</span>
          <button onClick={() => onSetGoal({ goalOz: Math.max(0, Number(goal) || 0) })} className="bg-stone-900 px-3 py-1 text-xs text-cream hover:bg-stone-700">Set</button>
        </div>
      </div>
    </>
  )
}

function SleepBody({ v, sleepMin, manual, onSave, onSetGoal }) {
  const [h, setH] = useState(sleepMin != null ? Math.floor(sleepMin / 60) : '')
  const [m, setM] = useState(sleepMin != null ? sleepMin % 60 : '')
  const [goal, setGoal] = useState(v.sleep.goalMin ? Math.round(v.sleep.goalMin / 60) : 8)
  return (
    <>
      <p className="mt-1 font-serif text-3xl text-stone-900">{sleepMin != null ? fmtSleep(sleepMin) : '—'}</p>
      {sleepMin == null && !manual && <Waiting />}
      {manual && (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-600">
          <input type="number" placeholder="h" value={h} onChange={(e) => setH(e.target.value)} className="w-14 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
          <span className="text-stone-400">h</span>
          <input type="number" placeholder="m" value={m} onChange={(e) => setM(e.target.value)} className="w-14 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
          <span className="text-stone-400">m</span>
          <button onClick={() => onSave({ min: (Number(h) || 0) * 60 + (Number(m) || 0) })} className="ml-1 bg-stone-900 px-3 py-1 text-xs text-cream hover:bg-stone-700">Save</button>
        </div>
      )}
      <div className="mt-4">
        {v.sleep.goalMin && sleepMin != null && <GoalRow label="Goal" value={`${Math.round(v.sleep.goalMin / 60)}h · ${pct(sleepMin, v.sleep.goalMin)}%`} />}
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-600">
          <span className="kicker text-stone-400">Goal</span>
          <input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} className={lineCls} />
          <span className="text-stone-400">hrs</span>
          <button onClick={() => onSetGoal({ goalMin: Math.max(0, Number(goal) || 0) * 60 })} className="bg-stone-900 px-3 py-1 text-xs text-cream hover:bg-stone-700">Set</button>
        </div>
      </div>
    </>
  )
}

function StepsBody({ v, stepsVal, manual, onSave, onSetGoal }) {
  const [n, setN] = useState(stepsVal != null ? stepsVal : '')
  const [goal, setGoal] = useState(v.steps.goalSteps ? Math.round(v.steps.goalSteps / 1000) : 10)
  return (
    <>
      <p className="mt-1 font-serif text-3xl text-stone-900">{stepsVal != null ? stepsVal.toLocaleString() : '—'}</p>
      {stepsVal == null && !manual && <Waiting />}
      {manual && (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-600">
          <input type="number" placeholder="steps" value={n} onChange={(e) => setN(e.target.value)} className="w-24 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
          <button onClick={() => onSave({ steps: Math.max(0, Number(n) || 0) })} className="ml-1 bg-stone-900 px-3 py-1 text-xs text-cream hover:bg-stone-700">Save</button>
        </div>
      )}
      <div className="mt-4">
        {v.steps.goalSteps && stepsVal != null && <GoalRow label="Goal" value={`${v.steps.goalSteps / 1000}k · ${pct(stepsVal, v.steps.goalSteps)}%`} />}
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-600">
          <span className="kicker text-stone-400">Goal</span>
          <input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} className={lineCls} />
          <span className="text-stone-400">k</span>
          <button onClick={() => onSetGoal({ goalSteps: Math.max(0, Number(goal) || 0) * 1000 })} className="bg-stone-900 px-3 py-1 text-xs text-cream hover:bg-stone-700">Set</button>
        </div>
      </div>
    </>
  )
}

function BpBody({ bpVal, manual, onSave }) {
  const [sys, setSys] = useState(bpVal ? bpVal.sys : '')
  const [dia, setDia] = useState(bpVal ? bpVal.dia : '')
  return (
    <>
      <p className="mt-1 font-serif text-3xl text-stone-900">{bpVal ? `${bpVal.sys}/${bpVal.dia}` : '—'}</p>
      {!bpVal && !manual && <Waiting />}
      {manual && (
        <div className="mt-4 flex items-center gap-2 text-sm text-stone-600">
          <input type="number" placeholder="sys" value={sys} onChange={(e) => setSys(e.target.value)} className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
          <span className="text-stone-400">/</span>
          <input type="number" placeholder="dia" value={dia} onChange={(e) => setDia(e.target.value)} className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
          <button onClick={() => { if (sys && dia) onSave({ sys: Number(sys), dia: Number(dia) }) }} className="ml-1 bg-stone-900 px-3 py-1 text-xs text-cream hover:bg-stone-700">Save</button>
        </div>
      )}
    </>
  )
}
