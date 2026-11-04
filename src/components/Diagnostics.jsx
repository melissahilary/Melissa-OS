import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, longDate, parseKey } from '../lib/date'
import { MARKERS, markerById, readingState, SYMPTOMS } from '../lib/markers'
import {
  Page, Band, Row, Name, Meta, Mark, Plus, Empty, Starters, Sheet, Big, Field, Notes, Chips,
  useRequiredName, uid, arr,
} from './shared/Ledger'

export default function Diagnostics({ subPage }) {
  if (subPage === 'results') return <Results />
  if (subPage === 'markers') return <Trends />
  if (subPage === 'symptoms') return <Bridge />
  if (subPage === 'wearables') return <Wearables />
  return <Due />
}

const said = (k) => (k ? longDate(k) : '')
const today = () => dateKey(new Date())
const plusMonths = (k, n) => { const d = parseKey(k); d.setMonth(d.getMonth() + Number(n || 0)); return dateKey(d) }
const daysTo = (k) => Math.round((parseKey(k) - parseKey(today())) / 86400000)

const INK = '#16130F'
const COBALT = '#1D2FC4'
const OXBLOOD = '#C87A7A'
const TAN = '#C0966F'

// ── 1 · What is due ────────────────────────────────────────────────
//
// A test is not a one-off. Ferritin in March means nothing without ferritin in
// September, and the thing that actually lapses is the second one. Each line
// carries how often it should be repeated and says, plainly, when it is owed.
const EVERY = [
  { id: '3', label: 'Every 3 months' },
  { id: '6', label: 'Every 6 months' },
  { id: '12', label: 'Once a year' },
  { id: '24', label: 'Every 2 years' },
]
const DUE_STARTERS = ['full blood count', 'iron panel', 'thyroid panel', 'vitamin d', 'b12 and folate',
  'hba1c and fasting insulin', 'lipid panel with apob', 'hs-crp', 'female hormone panel', 'amh',
  'cervical screening', 'mammogram', 'dexa scan', 'skin check', 'dental', 'eye test']

function Due() {
  const [raw, setRaw] = useLocalStorage('mos:test:due', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const did = (id) => setRaw((p) => arr(p).map((x) => (x.id === id ? { ...x, last: today() } : x)))

  const dueOn = (x) => (x.last && x.every ? plusMonths(x.last, x.every) : '')
  const sort = (a, b) => (dueOn(a) || '9').localeCompare(dueOn(b) || '9')
  const owed = all.filter((x) => dueOn(x) && daysTo(dueOn(x)) <= 30).sort(sort)
  const later = all.filter((x) => !owed.includes(x)).sort(sort)

  const line = (x, first) => {
    const on = dueOn(x)
    const left = on ? daysTo(on) : null
    const word = left == null ? 'never done' : left < 0 ? `overdue by ${-left} days` : left === 0 ? 'due today' : `due in ${left} days`
    return (
      <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}
        aside={<Mark on={false} onClick={() => did(x.id)} label={`Had ${x.name} today`}>Had it</Mark>}>
        <Name>{x.name}</Name>
        <Meta>{[x.last ? `last ${said(x.last)}` : '', word].filter(Boolean).join(' · ')}</Meta>
      </Row>
    )
  }

  return (
    <Page kicker="Testing" title="What is due"
      intro="A test means nothing on its own. What lapses is the repeat, so each line carries how often it should be done and says when it is owed.">
      {owed.length > 0 && (<><Band count={owed.length}>Owed now</Band>{owed.map((x, i) => line(x, !i))}</>)}
      <Band count={later.length || null}>Everything else</Band>
      {later.length ? later.map((x, i) => line(x, !i)) : <Empty>Nothing scheduled yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Add a test" />
      <Starters options={DUE_STARTERS} has={(o) => all.some((x) => x.name === o)}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, every: '12', last: '', notes: '' }])} />

      {(adding || open) && (
        <DueSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
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

function DueSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [every, setEvery] = useState(item ? String(item.every || '12') : '12')
  const [last, setLast] = useState(item ? item.last || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, every, last, notes }) }
  return (
    <Sheet kicker="What is due" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Thyroid panel" onEnter={save} />
      <Chips label="How often" options={EVERY} value={every} onChange={setEvery} />
      <Field label="Last done" type="date" value={last} onChange={setLast} width="mt-8" />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 2 · The vault ──────────────────────────────────────────────────
function Results() {
  const [raw, setRaw] = useLocalStorage('mos:test:panels', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))

  return (
    <Page kicker="Testing" title="The vault"
      intro="Every test in one place, with its numbers kept beside it — so the next one has something to be compared with.">
      {all.length ? all.map((x, i) => {
        const n = arr(x.readings).length
        const off = arr(x.readings).filter((r) => readingState(markerById(r.marker), r.value) !== 'optimal').length
        return (
          <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
            <Name>{x.name}</Name>
            <Meta>{[said(x.on), x.where, n ? `${n} markers` : 'no numbers yet', off ? `${off} outside optimal` : ''].filter(Boolean).join(' · ')}</Meta>
          </Row>
        )
      }) : <Empty>Nothing in the vault yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Add a test" />
      <Starters options={DUE_STARTERS} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, on: today(), where: '', notes: '', readings: [] }])} />

      {(adding || open) && (
        <PanelSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
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

function PanelSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const [readings, setReadings] = useState(item ? arr(item.readings) : [])
  const [pick, setPick] = useState('')
  const save = () => { const t = ready(); if (t) onSave({ name: t, on, where, notes, readings }) }
  const set = (i, v) => setReadings((p) => p.map((r, k) => (k === i ? { ...r, value: v } : r)))
  const take = (id) => { if (id && !readings.some((r) => r.marker === id)) setReadings((p) => [...p, { marker: id, value: '' }]); setPick('') }

  return (
    <Sheet kicker="The vault" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Thyroid panel" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="Where" value={where} onChange={setWhere} placeholder="the clinic" width="flex-1" onEnter={save} />
      </div>

      <div className="mt-8">
        <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">The numbers</span>
        {readings.map((r, i) => {
          const m = markerById(r.marker)
          const st = readingState(m, r.value)
          return (
            <div key={r.marker} className="mt-4 flex items-end gap-4 border-b border-cream/20 pb-2">
              <span className="min-w-0 flex-1 truncate text-[15px] text-cream">{m ? m.name : r.marker}</span>
              <input value={r.value} onChange={(e) => set(i, e.target.value)} placeholder="—" inputMode="decimal"
                className="w-[70px] border-b border-cream/30 bg-transparent pb-1 text-right font-serif text-[20px] text-cream outline-none placeholder:text-cream/30" />
              <span className="w-[62px] shrink-0 text-[10px] uppercase tracking-[0.1em] text-cream/50">{m ? m.unit : ''}</span>
              <span className="w-[58px] shrink-0 text-right text-[9px] uppercase tracking-[0.12em]"
                style={{ color: st === 'optimal' ? '#A8C6A1' : st === 'normal' ? TAN : st === 'out' ? OXBLOOD : 'transparent' }}>
                {st === 'optimal' ? 'Optimal' : st === 'normal' ? 'In range' : st === 'out' ? 'Outside' : ''}
              </span>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setReadings((p) => p.filter((_, k) => k !== i))}
                className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-cream/40 hover:text-cream">Remove</button>
            </div>
          )
        })}
        <select value={pick} onChange={(e) => take(e.target.value)}
          className="mt-5 w-full border-b border-cream/30 bg-transparent pb-2 text-[15px] text-cream outline-none"
          style={{ colorScheme: 'dark' }}>
          <option value="">Add a marker…</option>
          {MARKERS.filter((m) => !readings.some((r) => r.marker === m.id)).map((m) => (
            <option key={m.id} value={m.id}>{`${m.name} (${m.unit})`}</option>
          ))}
        </select>
      </div>

      <Notes value={notes} onChange={setNotes} label="What was said" />
    </Sheet>
  )
}

// ── 3 · The trends ─────────────────────────────────────────────────
//
// One number, every time it has been taken, with both ranges drawn behind it:
// the lab's, and the one commonly called optimal. The gap between the two is
// the whole argument of this page.
function Trends() {
  const [raw] = useLocalStorage('mos:test:panels', [])
  const panels = arr(raw)
  const taken = MARKERS.filter((m) => panels.some((p) => arr(p.readings).some((r) => r.marker === m.id && r.value !== '')))
  const [sel, setSel] = useState('')
  const id = sel || (taken[0] && taken[0].id) || ''
  const m = markerById(id)

  const points = panels
    .flatMap((p) => arr(p.readings).filter((r) => r.marker === id && r.value !== '').map((r) => ({ on: p.on, v: Number(r.value) })))
    .filter((p) => p.on && Number.isFinite(p.v))
    .sort((a, b) => a.on.localeCompare(b.on))

  return (
    <Page kicker="Testing" title="The trends"
      intro="One number over time, with both ranges behind it — what the lab calls normal, and what is commonly called optimal. The gap between them is the point.">
      {!taken.length ? (
        <Empty>Put some numbers in the vault and they will be drawn here.</Empty>
      ) : (
        <>
          <label className="block">
            <span className="kicker block text-stone-500">Which number</span>
            <select value={id} onChange={(e) => setSel(e.target.value)}
              className="mt-3 w-full border-b border-stone-300 bg-transparent pb-2 font-serif text-[22px] text-stone-900 outline-none">
              {taken.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>

          <Chart marker={m} points={points} />

          <Band count={points.length}>Every reading</Band>
          {points.slice().reverse().map((p, i) => {
            const st = readingState(m, p.v)
            return (
              <div key={`${p.on}-${i}`} className={`flex items-baseline justify-between gap-6 py-5 ${i ? 'border-t border-stone-200' : ''}`}>
                <span className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{said(p.on)}</span>
                <span className="font-serif text-[26px] leading-none text-stone-900">{p.v}<span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-stone-400">{m.unit}</span></span>
                <span className="w-[72px] text-right text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: st === 'optimal' ? '#6F8A63' : st === 'normal' ? TAN : OXBLOOD }}>
                  {st === 'optimal' ? 'Optimal' : st === 'normal' ? 'In range' : 'Outside'}
                </span>
              </div>
            )
          })}
        </>
      )}
    </Page>
  )
}

function Chart({ marker, points }) {
  if (!marker) return null
  const W = 680, H = 220, PAD = 10
  const vals = points.map((p) => p.v)
  const lo = Math.min(marker.lab[0], marker.best[0], ...vals)
  const hi = Math.max(marker.lab[1], marker.best[1], ...vals)
  const span = hi - lo || 1
  const y = (v) => PAD + (H - PAD * 2) * (1 - (v - lo) / span)
  const x = (i) => (points.length <= 1 ? W / 2 : (W / (points.length - 1)) * i)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')

  return (
    <div className="mt-10">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height: 220 }} role="img" aria-label={`${marker.name} over time`}>
        {/* the lab's range, then the optimal band inside it */}
        <rect x="0" y={y(marker.lab[1])} width={W} height={Math.max(1, y(marker.lab[0]) - y(marker.lab[1]))} fill="#EEEAE1" />
        <rect x="0" y={y(marker.best[1])} width={W} height={Math.max(1, y(marker.best[0]) - y(marker.best[1]))} fill="#DCE3D6" />
        <line x1="0" y1={y(marker.best[1])} x2={W} y2={y(marker.best[1])} stroke="#6F8A63" strokeWidth="1" />
        <line x1="0" y1={y(marker.best[0])} x2={W} y2={y(marker.best[0])} stroke="#6F8A63" strokeWidth="1" />
        {points.length > 1 && <path d={line} fill="none" stroke={INK} strokeWidth="1.5" />}
        {points.map((p, i) => <rect key={i} x={x(i) - 3} y={y(p.v) - 3} width="6" height="6" fill={INK} />)}
      </svg>
      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-stone-500">
        <span className="flex items-center gap-2"><span className="block h-[9px] w-[18px]" style={{ background: '#DCE3D6' }} />Optimal {marker.best[0]}–{marker.best[1]}</span>
        <span className="flex items-center gap-2"><span className="block h-[9px] w-[18px]" style={{ background: '#EEEAE1' }} />Lab {marker.lab[0]}–{marker.lab[1]}</span>
        <span>{marker.unit}</span>
      </div>
      <p className="mt-5 text-[13px] italic leading-relaxed text-stone-400">
        Reference, not a diagnosis. Optimal ranges are those commonly cited in women&rsquo;s and functional practice; they are here so you can ask a specific question, not answer one.
      </p>
    </div>
  )
}

// ── 4 · What to ask for ────────────────────────────────────────────
function Bridge() {
  const [picked, setPicked] = useLocalStorage('mos:test:symptoms', [])
  const on = arr(picked)
  const toggle = (id) => setPicked((p) => (arr(p).includes(id) ? arr(p).filter((x) => x !== id) : [...arr(p), id]))

  // A test pointed at by three symptoms is a better question than one pointed
  // at by one, so they are counted and ordered.
  const tally = {}
  SYMPTOMS.filter((s) => on.includes(s.id)).forEach((s) => s.tests.forEach((t) => { tally[t] = (tally[t] || 0) + 1 }))
  const asks = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ m: markerById(id), n })).filter((x) => x.m)

  return (
    <Page kicker="Testing" title="What to ask for"
      intro="Describe it here and the page turns it into a list of tests. You walk in with a specific request instead of a vague complaint.">
      <Band>What is going on</Band>
      <div className="flex flex-wrap gap-2">
        {SYMPTOMS.map((s) => {
          const sel = on.includes(s.id)
          return (
            <button key={s.id} onClick={() => toggle(s.id)} aria-pressed={sel}
              className="border px-3.5 py-2 text-[13px] lowercase transition-colors"
              style={{ borderColor: sel ? INK : '#D6D3D1', background: sel ? INK : 'transparent', color: sel ? '#F7F4ED' : '#57534E' }}>
              {s.name}
            </button>
          )
        })}
      </div>

      {asks.length > 0 ? (
        <>
          <Band count={asks.length}>Worth asking about</Band>
          {asks.map((a, i) => (
            <div key={a.m.id} className={`flex items-baseline justify-between gap-6 py-5 ${i ? 'border-t border-stone-200' : ''}`}>
              <span className="font-serif text-[22px] text-stone-900">{a.m.name}</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                {a.n > 1 ? `${a.n} of what you picked` : a.m.group}
              </span>
            </div>
          ))}
          <p className="mt-8 text-[13px] italic leading-relaxed text-stone-400">
            This is a list of questions, not a diagnosis. Take it to the person who can order them.
          </p>
        </>
      ) : <Empty>Pick what is going on and the tests appear.</Empty>}
    </Page>
  )
}

// ── 5 · Wearables ──────────────────────────────────────────────────
const METRICS = ['resting heart rate', 'hrv', 'sleep', 'deep sleep', 'rem', 'steps', 'vo2 max',
  'body temperature', 'respiratory rate', 'readiness', 'blood oxygen', 'weight']

function Wearables() {
  const [raw, setRaw] = useLocalStorage('mos:test:wearables', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const metrics = [...new Set(all.map((x) => x.name))]

  return (
    <Page kicker="Testing" title="Wearables"
      intro="What the ring and the watch say, in one view. Typed for now — the devices do not hand their numbers over without a connection, and that comes later.">
      {metrics.length ? metrics.map((name) => {
        const rows = all.filter((x) => x.name === name).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
        const last = rows[0]
        return (
          <React.Fragment key={name}>
            <Band count={rows.length}>{name}</Band>
            <div className="flex items-baseline justify-between gap-6 pb-6">
              <span className="font-serif text-[38px] leading-none text-stone-900">{last.value}</span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{[said(last.on), last.device].filter(Boolean).join(' · ')}</span>
            </div>
            {rows.slice(1, 6).map((x, i) => (
              <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
                <Name>{x.value}</Name>
                <Meta>{[said(x.on), x.device].filter(Boolean).join(' · ')}</Meta>
              </Row>
            ))}
          </React.Fragment>
        )
      }) : <Empty>Nothing recorded yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Record a reading" />
      <Starters label="Record one for today" options={METRICS} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, value: '', on: today(), device: '', notes: '' }])} />

      {(adding || open) && (
        <WearSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
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

function WearSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [value, setValue] = useState(item ? item.value || '' : '')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [device, setDevice] = useState(item ? item.device || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, value, on, device, notes }) }
  return (
    <Sheet kicker="Wearables" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Hrv" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="The number" value={value} onChange={setValue} placeholder="58" width="flex-1" onEnter={save} />
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
      </div>
      <Field label="Which device" value={device} onChange={setDevice} placeholder="oura" width="mt-8" onEnter={save} />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}
