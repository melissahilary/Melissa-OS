import React, { useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, longDate, parseKey } from '../lib/date'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import {
  Page, Band, Row, Name, Meta, Mark, Plus, Empty, Starters, Sheet, Big, Field, Notes, Chips,
  useRequiredName, uid, arr, shrink,
} from './shared/Ledger'

export default function Fitness({ subPage, cycleConfig }) {
  if (subPage === 'log') return <WorkoutLog />
  if (subPage === 'measurements') return <Measurements />
  if (subPage === 'photos') return <PhotoLog />
  if (subPage === 'classes') return <Classes />
  return <WorkoutCalendar cycleConfig={cycleConfig} />
}

const said = (k) => (k ? longDate(k) : '')
const today = () => dateKey(new Date())
const daysTo = (k) => Math.round((parseKey(k) - parseKey(today())) / 86400000)
const num = (v) => String(v || '').replace(/[^\d.]/g, '')

// ── 1 · The calendar ───────────────────────────────────────────────
const STATUS = [
  { id: 'planned', label: 'Planned' },
  { id: 'done', label: 'Done' },
  { id: 'skipped', label: 'Skipped' },
]
const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal']
const WORKOUT_STARTERS = ['lower body strength', 'upper body strength', 'full body', 'pilates', 'reformer',
  'barre', 'yoga', 'spin', 'run', 'intervals', 'long walk', 'swim', 'mobility', 'rest day']

function WorkoutCalendar({ cycleConfig }) {
  const [raw, setRaw] = useLocalStorage('mos:fit:calendar', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const k = today()
  const ahead = all.filter((x) => !x.on || x.on >= k).sort((a, b) => (a.on || '9').localeCompare(b.on || '9'))
  const past = all.filter((x) => x.on && x.on < k).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (x) => { if (x.linked) remove(x.linked); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }

  // Where she is in the cycle, read from Hormones rather than asked for again.
  const phaseOn = (key) => {
    const start = cycleConfig && (cycleConfig.lastPeriod || cycleConfig.start)
    if (!start || !key) return ''
    const len = Number((cycleConfig && cycleConfig.cycleLength) || 28)
    const n = ((Math.round((parseKey(key) - parseKey(start)) / 86400000) % len) + len) % len + 1
    if (n <= 5) return PHASES[0]
    if (n <= Math.round(len / 2) - 2) return PHASES[1]
    if (n <= Math.round(len / 2) + 1) return PHASES[2]
    return PHASES[3]
  }

  const sync = (x) => {
    if (x.linked) remove(x.linked)
    if (!x.on || x.status === 'skipped') return ''
    return add(blankActivity('event', {
      title: x.name, category: 'fitness', frequency: 'once', seriesStart: x.on,
      details: { time: x.at || '', endTime: '', partOfDay: 'morning', description: x.where || '', attendees: '', durationMinutes: '' },
    })).id
  }
  const mark = (x, status) => {
    const base = { ...x, status }
    const linked = sync(base)
    setRaw((p) => arr(p).map((y) => (y.id === x.id ? { ...base, linked } : y)))
  }

  const line = (x, first) => (
    <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x)}
      aside={(
        <div className="mt-[7px] flex shrink-0 flex-col items-end gap-1.5">
          <button onClick={() => mark(x, x.status === 'done' ? 'planned' : 'done')} aria-pressed={x.status === 'done'}
            className="text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-60"
            style={{ color: x.status === 'done' ? '#6F8A63' : '#C0966F' }}>Done</button>
          <button onClick={() => mark(x, x.status === 'skipped' ? 'planned' : 'skipped')} aria-pressed={x.status === 'skipped'}
            className="text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-60"
            style={{ color: x.status === 'skipped' ? '#C87A7A' : '#A8A29E' }}>Skipped</button>
        </div>
      )}>
      <Name struck={x.status === 'done'}>{x.name}</Name>
      <Meta>{[said(x.on), x.at, x.where, phaseOn(x.on)].filter(Boolean).join(' · ')}</Meta>
    </Row>
  )

  return (
    <Page kicker="Fitness" title="The calendar"
      intro="What is planned, what was done, what was skipped — with the cycle phase beside it, read from Hormones. Planned and dated puts it on the day.">
      <Band count={ahead.length || null}>Ahead</Band>
      {ahead.length ? ahead.map((x, i) => line(x, !i)) : <Empty>Nothing planned.</Empty>}
      {past.length > 0 && (<><Band count={past.length}>Behind</Band>{past.slice(0, 20).map((x, i) => line(x, !i))}</>)}

      <Plus onClick={() => setAdding(true)} label="Plan a workout" />
      <Starters label="Plan one for today" options={WORKOUT_STARTERS} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, on: today(), at: '', where: '', status: 'planned', notes: '', linked: '' }])} />

      {(adding || open) && (
        <PlanSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open); setOpen(null) } : null}
          onSave={(d) => {
            const base = open ? { ...open, ...d } : { ...d, id: uid(), linked: '' }
            const linked = sync(base)
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...base, linked } : x)))
            else setRaw((p) => [...arr(p), { ...base, linked }])
            setAdding(false); setOpen(null)
          }} />
      )}
    </Page>
  )
}

function PlanSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [at, setAt] = useState(item ? item.at || '' : '')
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [status, setStatus] = useState(item ? item.status || 'planned' : 'planned')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, on, at, where, status, notes }) }
  return (
    <Sheet kicker="The calendar" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Lower body strength" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="At" type="time" value={at} onChange={setAt} width="w-[40%]" />
      </div>
      <Field label="Where" value={where} onChange={setWhere} placeholder="the gym · home · the studio" width="mt-8" onEnter={save} />
      <Chips label="Where it stands" options={STATUS} value={status} onChange={setStatus} />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 2 · The log ────────────────────────────────────────────────────
//
// What she actually lifted, which is a different question from what she
// planned to. Each exercise carries its sets, reps and weight so the next
// week has something to beat.
function WorkoutLog() {
  const [raw, setRaw] = useLocalStorage('mos:fit:log', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))

  return (
    <Page kicker="Fitness" title="The log"
      intro="What she actually lifted, which is a different question from what she planned to. Next week has something to beat.">
      {all.length ? all.map((x, i) => (
        <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
          <Name>{x.name}</Name>
          <Meta>{[said(x.on), x.minutes ? `${x.minutes} min` : '', x.effort ? `effort ${x.effort}/10` : '', arr(x.sets).length ? `${arr(x.sets).length} exercises` : ''].filter(Boolean).join(' · ')}</Meta>
          {arr(x.sets).length > 0 && (
            <span className="mt-3 block max-w-xl text-[15px] leading-relaxed text-stone-500">
              {arr(x.sets).map((s) => `${s.what} ${s.sets}×${s.reps}${s.load ? ` @ ${s.load}` : ''}`).join(' · ')}
            </span>
          )}
        </Row>
      )) : <Empty>Nothing logged yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Log a workout" />
      <Starters label="Log one from today" options={WORKOUT_STARTERS} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, on: today(), minutes: '', effort: '', sets: [], notes: '' }])} />

      {(adding || open) && (
        <LogSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid() }])
            setAdding(false); setOpen(null)
          }} />
      )}
    </Page>
  )
}

const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ id: String(n), label: String(n) }))

function LogSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [minutes, setMinutes] = useState(item ? String(item.minutes || '') : '')
  const [effort, setEffort] = useState(item ? String(item.effort || '') : '')
  const [sets, setSets] = useState(item ? arr(item.sets) : [])
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, on, minutes: num(minutes), effort, sets, notes }) }
  const edit = (i, patch) => setSets((p) => p.map((s, k) => (k === i ? { ...s, ...patch } : s)))

  return (
    <Sheet kicker="The log" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Lower body strength" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="How long" value={minutes} onChange={setMinutes} placeholder="45" width="w-[34%]" />
      </div>
      <Chips label="How hard it felt, out of ten" options={EFFORTS} value={effort} onChange={setEffort} />

      <div className="mt-8">
        <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">What she did</span>
        {sets.map((s, i) => (
          <div key={i} className="mt-4 flex items-end gap-3 border-b border-cream/20 pb-2">
            <input value={s.what} onChange={(e) => edit(i, { what: e.target.value })} placeholder="hip thrust"
              className="min-w-0 flex-1 bg-transparent text-[16px] lowercase text-cream outline-none placeholder:text-cream/30" />
            <input value={s.sets} onChange={(e) => edit(i, { sets: e.target.value })} placeholder="4"
              className="w-[34px] bg-transparent text-center font-serif text-[19px] text-cream outline-none placeholder:text-cream/30" />
            <span className="text-[13px] text-cream/40">×</span>
            <input value={s.reps} onChange={(e) => edit(i, { reps: e.target.value })} placeholder="8"
              className="w-[34px] bg-transparent text-center font-serif text-[19px] text-cream outline-none placeholder:text-cream/30" />
            <input value={s.load} onChange={(e) => edit(i, { load: e.target.value })} placeholder="60kg"
              className="w-[62px] bg-transparent text-right text-[15px] text-cream outline-none placeholder:text-cream/30" />
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setSets((p) => p.filter((_, k) => k !== i))}
              className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-cream/40 hover:text-cream">Out</button>
          </div>
        ))}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSets((p) => [...p, { what: '', sets: '', reps: '', load: '' }])}
          className="mt-5 text-[10px] uppercase tracking-[0.18em] text-cream/60 underline underline-offset-4 transition-opacity hover:opacity-80">
          Add an exercise
        </button>
      </div>
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 3 · Measurements ───────────────────────────────────────────────
const MEASURES = [
  { id: 'weight', label: 'Weight', unit: 'lb' },
  { id: 'bodyfat', label: 'Body fat', unit: '%' },
  { id: 'muscle', label: 'Muscle mass', unit: 'lb' },
  { id: 'waist', label: 'Waist', unit: 'in' },
  { id: 'hips', label: 'Hips', unit: 'in' },
  { id: 'bust', label: 'Bust', unit: 'in' },
  { id: 'thigh', label: 'Thigh', unit: 'in' },
  { id: 'arm', label: 'Arm', unit: 'in' },
]
const SCANS = [
  { id: 'manual', label: 'Tape' }, { id: 'inbody', label: 'InBody' },
  { id: 'dexa', label: 'DEXA' }, { id: 'scale', label: 'Smart scale' },
]

function Measurements() {
  const [raw, setRaw] = useLocalStorage('mos:fit:measures', [])
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(null)
  const all = arr(raw).sort((a, b) => (a.on || '').localeCompare(b.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const seen = MEASURES.filter((m) => all.some((x) => x.values && x.values[m.id] !== '' && x.values[m.id] != null))

  return (
    <Page kicker="Fitness" title="Measurements"
      intro="Every number on one date, so a change is a line rather than a memory. Tape, scale, InBody, DEXA — all the same page.">
      {seen.length ? seen.map((m) => {
        const pts = all.filter((x) => x.values && x.values[m.id] !== '' && x.values[m.id] != null)
          .map((x) => ({ on: x.on, v: Number(x.values[m.id]) })).filter((x) => Number.isFinite(x.v))
        if (!pts.length) return null
        const last = pts[pts.length - 1]
        const first = pts[0]
        const diff = pts.length > 1 ? (last.v - first.v) : null
        return (
          <React.Fragment key={m.id}>
            <Band count={pts.length}>{m.label}</Band>
            <div className="flex items-baseline justify-between gap-6">
              <span className="font-serif text-[38px] leading-none text-stone-900">{last.v}<span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-stone-400">{m.unit}</span></span>
              {diff != null && diff !== 0 && (
                <span className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{`${diff > 0 ? '+' : ''}${Math.round(diff * 10) / 10} since ${said(first.on)}`}</span>
              )}
            </div>
            <Spark points={pts} />
          </React.Fragment>
        )
      }) : <Empty>Nothing measured yet.</Empty>}

      <Band count={all.length || null}>Every entry</Band>
      {all.slice().reverse().map((x, i) => (
        <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
          <Name>{said(x.on)}</Name>
          <Meta>{[(SCANS.find((s) => s.id === x.scan) || {}).label,
            ...MEASURES.filter((m) => x.values && x.values[m.id]).map((m) => `${m.label.toLowerCase()} ${x.values[m.id]}${m.unit}`)].filter(Boolean).join(' · ')}</Meta>
        </Row>
      ))}

      <Plus onClick={() => setAdding(true)} label="Take measurements" />

      {(adding || open) && (
        <MeasureSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid() }])
            setAdding(false); setOpen(null)
          }} />
      )}
    </Page>
  )
}

function Spark({ points }) {
  if (points.length < 2) return null
  const W = 680, H = 90
  const vs = points.map((p) => p.v)
  const lo = Math.min(...vs), hi = Math.max(...vs)
  const span = hi - lo || 1
  const x = (i) => (W / (points.length - 1)) * i
  const y = (v) => 8 + (H - 16) * (1 - (v - lo) / span)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 block w-full" style={{ height: 90 }} aria-hidden>
      <path d={d} fill="none" stroke="#16130F" strokeWidth="1.5" />
      {points.map((p, i) => <rect key={i} x={x(i) - 2.5} y={y(p.v) - 2.5} width="5" height="5" fill="#16130F" />)}
    </svg>
  )
}

function MeasureSheet({ item, onSave, onDrop, onClose }) {
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [scan, setScan] = useState(item ? item.scan || 'manual' : 'manual')
  const [values, setValues] = useState(item ? { ...(item.values || {}) } : {})
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const set = (id, v) => setValues((p) => ({ ...p, [id]: num(v) }))
  const save = () => onSave({ on, scan, values, notes })
  return (
    <Sheet kicker="Measurements" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Field label="When" type="date" value={on} onChange={setOn} width="mt-6" />
      <Chips label="How" options={SCANS} value={scan} onChange={setScan} />
      <div className="mt-8">
        <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">The numbers</span>
        {MEASURES.map((m) => (
          <div key={m.id} className="mt-4 flex items-end gap-4 border-b border-cream/20 pb-2">
            <span className="min-w-0 flex-1 text-[15px] text-cream">{m.label}</span>
            <input value={values[m.id] || ''} onChange={(e) => set(m.id, e.target.value)} placeholder="—" inputMode="decimal"
              className="w-[74px] bg-transparent text-right font-serif text-[20px] text-cream outline-none placeholder:text-cream/30" />
            <span className="w-[26px] shrink-0 text-[10px] uppercase tracking-[0.1em] text-cream/50">{m.unit}</span>
          </div>
        ))}
      </div>
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 4 · The photographs ────────────────────────────────────────────
const ANGLES = [
  { id: 'front', label: 'Front' }, { id: 'side', label: 'Side' }, { id: 'back', label: 'Back' },
]

function PhotoLog() {
  const [raw, setRaw] = useLocalStorage('mos:fit:photos', [])
  const [angle, setAngle] = useState('front')
  const [busy, setBusy] = useState(false)
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const file = useRef(null)
  const all = arr(raw)
  const same = all.filter((x) => x.angle === angle).sort((x, y) => (x.on || '').localeCompare(y.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const take = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try { const src = await shrink(f); setRaw((p) => [...arr(p), { id: uid(), on: today(), angle, src }]) }
    finally { setBusy(false) }
  }
  const left = same[Math.min(a, same.length - 1)]
  const right = same[Math.min(Math.max(b, same.length - 1), same.length - 1)]

  return (
    <Page kicker="Fitness" title="The photographs"
      intro="Matched by angle. The scale is the least useful number in this section and a front shot in March is the most useful one.">
      <div className="flex gap-2">
        {ANGLES.map((x) => {
          const on = angle === x.id
          const n = all.filter((y) => y.angle === x.id).length
          return (
            <button key={x.id} onClick={() => { setAngle(x.id); setA(0); setB(0) }} aria-pressed={on}
              className="border px-4 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors"
              style={{ borderColor: on ? '#16130F' : '#D6D3D1', background: on ? '#16130F' : 'transparent', color: on ? '#F7F4ED' : '#57534E' }}>
              {x.label}{n ? ` · ${n}` : ''}
            </button>
          )
        })}
      </div>

      {same.length >= 2 && left && right && (
        <>
          <Band>{`${said(left.on)} beside ${said(right.on)}`}</Band>
          <div className="grid grid-cols-2 gap-4">
            {[left, right].map((x, i) => (
              <figure key={i}>
                <img src={x.src} alt={said(x.on)} className="block w-full border border-stone-200 object-cover" style={{ aspectRatio: '3 / 4' }} />
                <figcaption className="mt-2 text-[9px] uppercase tracking-[0.14em] text-stone-500">{said(x.on)}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-6">
            <Choose label="Before" all={same} i={a} onPick={setA} />
            <Choose label="After" all={same} i={b} onPick={setB} />
          </div>
        </>
      )}

      <Band count={same.length || null}>Every picture</Band>
      {same.length ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {same.map((x) => (
            <figure key={x.id}>
              <img src={x.src} alt={said(x.on)} className="block w-full border border-stone-200 object-cover" style={{ aspectRatio: '3 / 4' }} />
              <figcaption className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-[9px] uppercase tracking-[0.14em] text-stone-500">{said(x.on)}</span>
                <button onClick={() => drop(x.id)} className="text-[9px] uppercase tracking-[0.14em] transition-opacity hover:opacity-70" style={{ color: '#C87A7A' }}>Delete</button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : <Empty>No pictures at this angle yet.</Empty>}

      <input ref={file} type="file" accept="image/*" onChange={take} className="hidden" />
      <div className="pt-8">
        <button onClick={() => file.current && file.current.click()} disabled={busy}
          className="mx-auto block border border-stone-300 px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-stone-900 transition-colors hover:border-stone-900 disabled:opacity-40">
          {busy ? 'Keeping it…' : `Add a ${(ANGLES.find((x) => x.id === angle) || {}).label.toLowerCase()} shot`}
        </button>
      </div>
    </Page>
  )
}

function Choose({ label, all, i, onPick }) {
  return (
    <label className="block">
      <span className="kicker block text-stone-500">{label}</span>
      <select value={i} onChange={(e) => onPick(Number(e.target.value))}
        className="mt-3 w-full border-b border-stone-300 bg-transparent pb-2 text-[15px] text-stone-900 outline-none">
        {all.map((x, k) => <option key={x.id} value={k}>{said(x.on)}</option>)}
      </select>
    </label>
  )
}

// ── 5 · Classes ────────────────────────────────────────────────────
//
// Credits expire and memberships renew quietly, which is how a studio makes
// its money. The page counts both and says so before the money goes.
const BOOKED = [
  { id: 'want', label: 'Want to book' },
  { id: 'booked', label: 'Booked' },
  { id: 'waitlist', label: 'Waitlisted' },
  { id: 'been', label: 'Been' },
]
const CLASS_STARTERS = ['reformer', 'mat pilates', 'barre', 'hot yoga', 'vinyasa', 'spin', 'boxing', 'strength class', 'run club']

function Classes() {
  const [raw, setRaw] = useLocalStorage('mos:fit:classes', [])
  const [packs, setPacks] = useLocalStorage('mos:fit:packs', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const [pack, setPack] = useState(false)
  const all = arr(raw)
  const k = today()
  const ahead = all.filter((x) => x.status !== 'been' && (!x.on || x.on >= k)).sort((a, b) => (a.on || '9').localeCompare(b.on || '9'))
  const been = all.filter((x) => x.status === 'been' || (x.on && x.on < k)).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (x) => { if (x.linked) remove(x.linked); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }
  const sync = (x) => {
    if (x.linked) remove(x.linked)
    if (!x.on || (x.status !== 'booked' && x.status !== 'been')) return ''
    return add(blankActivity('event', {
      title: x.name, category: 'fitness', frequency: 'once', seriesStart: x.on,
      details: { time: x.at || '', endTime: '', partOfDay: 'morning', description: x.where || '', attendees: x.who || '', durationMinutes: '' },
    })).id
  }

  const line = (x, first) => (
    <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x)}>
      <Name>{x.name}</Name>
      <Meta>{[said(x.on), x.at, x.who, x.where, x.cost, (BOOKED.find((s) => s.id === x.status) || {}).label].filter(Boolean).join(' · ')}</Meta>
    </Row>
  )

  const low = arr(packs).filter((p) => Number(p.left) <= 2)
  const soon = arr(packs).filter((p) => p.renews && daysTo(p.renews) <= 14 && daysTo(p.renews) >= 0)

  return (
    <Page kicker="Fitness" title="Classes"
      intro="Credits expire and memberships renew quietly — that is how a studio makes its money. This counts both and says so before it goes.">
      {(low.length > 0 || soon.length > 0) && (
        <div className="mb-12 border-t border-stone-900 pt-6">
          {low.map((p) => (
            <p key={`l${p.id}`} className="font-serif text-[22px] leading-snug text-stone-900">
              {`${p.left} ${Number(p.left) === 1 ? 'credit' : 'credits'} left at ${p.name}.`}
            </p>
          ))}
          {soon.map((p) => (
            <p key={`r${p.id}`} className="mt-2 font-serif text-[22px] leading-snug text-stone-900">
              {`${p.name} renews ${said(p.renews)}${p.cost ? ` at ${p.cost}` : ''}.`}
            </p>
          ))}
        </div>
      )}

      <Band count={arr(packs).length || null}>Studios and memberships</Band>
      {arr(packs).length ? arr(packs).map((p, i) => (
        <Row key={p.id} first={!i} onOpen={() => setPack(p)} onAway={() => setPacks((q) => arr(q).filter((y) => y.id !== p.id))}>
          <Name>{p.name}</Name>
          <Meta>{[p.left !== '' ? `${p.left} credits left` : '', p.renews ? `renews ${said(p.renews)}` : '', p.cost].filter(Boolean).join(' · ')}</Meta>
        </Row>
      )) : <Empty>No studios yet.</Empty>}
      <Plus onClick={() => setPack({})} label="Add a studio" />

      <Band count={ahead.length || null}>Ahead</Band>
      {ahead.length ? ahead.map((x, i) => line(x, !i)) : <Empty>Nothing booked.</Empty>}
      {been.length > 0 && (<><Band count={been.length}>Been</Band>{been.slice(0, 20).map((x, i) => line(x, !i))}</>)}

      <Plus onClick={() => setAdding(true)} label="Add a class" />
      <Starters options={CLASS_STARTERS} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, who: '', where: '', on: '', at: '', cost: '', credits: '', status: 'want', notes: '', linked: '' }])} />

      {(adding || open) && (
        <ClassSheet item={open} studios={arr(packs)} onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open); setOpen(null) } : null}
          onSave={(d) => {
            const base = open ? { ...open, ...d } : { ...d, id: uid(), linked: '' }
            const linked = sync(base)
            // A booked class spends a credit at its studio.
            if (d.credits && d.status === 'booked' && (!open || open.status !== 'booked')) {
              setPacks((q) => arr(q).map((p) => (p.name === d.where && p.left !== '' ? { ...p, left: String(Math.max(0, Number(p.left) - Number(d.credits))) } : p)))
            }
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...base, linked } : x)))
            else setRaw((p) => [...arr(p), { ...base, linked }])
            setAdding(false); setOpen(null)
          }} />
      )}

      {pack && (
        <PackSheet item={pack.id ? pack : null} onClose={() => setPack(false)}
          onDrop={pack.id ? () => { setPacks((q) => arr(q).filter((y) => y.id !== pack.id)); setPack(false) } : null}
          onSave={(d) => {
            if (pack.id) setPacks((q) => arr(q).map((x) => (x.id === pack.id ? { ...x, ...d } : x)))
            else setPacks((q) => [...arr(q), { ...d, id: uid() }])
            setPack(false)
          }} />
      )}
    </Page>
  )
}

function ClassSheet({ item, studios, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [who, setWho] = useState(item ? item.who || '' : '')
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [on, setOn] = useState(item ? item.on || '' : '')
  const [at, setAt] = useState(item ? item.at || '' : '')
  const [cost, setCost] = useState(item ? item.cost || '' : '')
  const [credits, setCredits] = useState(item ? String(item.credits || '') : '')
  const [status, setStatus] = useState(item ? item.status || 'want' : 'want')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, who, where, on, at, cost, credits, status, notes }) }
  return (
    <Sheet kicker="A class" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Reformer" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="Studio" value={where} onChange={setWhere} placeholder={studios.length ? studios[0].name : 'the studio'} width="flex-1" onEnter={save} />
        <Field label="Instructor" value={who} onChange={setWho} placeholder="a name" width="flex-1" onEnter={save} />
      </div>
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="At" type="time" value={at} onChange={setAt} width="w-[40%]" />
      </div>
      <div className="mt-8 flex items-end gap-6">
        <Field label="Credits it uses" value={credits} onChange={setCredits} placeholder="1" width="w-[40%]" />
        <Field label="Or what it cost" value={cost} onChange={setCost} placeholder="$38" width="flex-1" onEnter={save} />
      </div>
      <Chips label="Where it stands" options={BOOKED} value={status} onChange={setStatus} />
      <p className="mt-3 text-[13px] italic text-cream/50">Booked, with a date, puts it on the day and spends the credit.</p>
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

function PackSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [left, setLeft] = useState(item ? String(item.left || '') : '')
  const [renews, setRenews] = useState(item ? item.renews || '' : '')
  const [cost, setCost] = useState(item ? item.cost || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, left: num(left), renews, cost, notes }) }
  return (
    <Sheet kicker="A studio" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="The reformer studio" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="Credits left" value={left} onChange={setLeft} placeholder="8" width="w-[40%]" />
        <Field label="What it costs" value={cost} onChange={setCost} placeholder="$220 a month" width="flex-1" onEnter={save} />
      </div>
      <Field label="Renews on" type="date" value={renews} onChange={setRenews} width="mt-8" />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}
