import React, { useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, longDate, parseKey } from '../lib/date'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import {
  Page, Band, Row, Name, Meta, Mark, Plus, Empty, Starters, Sheet, Big, Field, Notes, Chips,
  useRequiredName, uid, arr, shrink,
} from './shared/Ledger'

export default function Haircare({ subPage, cycleConfig }) {
  if (subPage === 'calendar') return <HairCalendar />
  if (subPage === 'log') return <HairLog cycleConfig={cycleConfig} />
  if (subPage === 'photos') return <PhotoLog />
  if (subPage === 'salon') return <Salon />
  if (subPage === 'treatments') return <Treatments />
  return <Routines />
}

const said = (k) => (k ? longDate(k) : '')
const today = () => dateKey(new Date())
const plusDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + Number(n || 0)); return dateKey(d) }
const daysTo = (k) => Math.round((parseKey(k) - parseKey(today())) / 86400000)

// ── 1 · The routines ───────────────────────────────────────────────
//
// Hair is not one routine, it is four, and which one she is in depends on
// where she is in the wash cycle. So a routine is a named thing with its own
// steps, each step carrying the product it uses, and today's checklist is
// whichever routine she says she is doing today.
const TYPES = [
  { id: 'wash', label: 'Wash day' },
  { id: 'between', label: 'Between washes' },
  { id: 'overnight', label: 'Overnight' },
  { id: 'styling', label: 'Styling' },
]
const typeLabel = (id) => (TYPES.find((t) => t.id === id) || {}).label || ''
const STEP_STARTERS = {
  wash: ['pre-wash oil', 'clarify', 'shampoo', 'second shampoo', 'conditioner', 'bond builder', 'mask', 'cold rinse', 'leave-in', 'scalp serum', 'air dry'],
  between: ['dry shampoo', 'scalp massage', 'rosemary oil', 'brush from the ends up', 'refresh the roots', 'silk scrunchie'],
  overnight: ['scalp oil', 'hair mask overnight', 'loose plait', 'satin bonnet', 'silk pillowcase', 'heatless curls'],
  styling: ['heat protectant', 'blow dry', 'round brush', 'curl', 'straighten', 'hair oil on the ends', 'texture spray'],
}

function Routines() {
  const [raw, setRaw] = useLocalStorage('mos:hair:routines', [])
  const [doing, setDoing] = useLocalStorage('mos:hair:doing', '')
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newRoutine, setNewRoutine] = useState(false)
  const all = arr(raw)
  const active = all.find((r) => r.id === doing) || all[0] || null
  const k = today()

  const setRoutine = (id, patch) => setRaw((p) => arr(p).map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const dropRoutine = (id) => { setRaw((p) => arr(p).filter((r) => r.id !== id)); if (doing === id) setDoing('') }
  const steps = active ? arr(active.steps) : []
  const done = (st) => !!(st.completions && st.completions[k])
  const tick = (sid) => setRoutine(active.id, {
    steps: steps.map((st) => {
      if (st.id !== sid) return st
      const c = { ...(st.completions || {}) }
      if (c[k]) delete c[k]; else c[k] = true
      return { ...st, completions: c }
    }),
  })
  const putStep = (name) => setRoutine(active.id, { steps: [...steps, { id: uid(), name, product: '', completions: {} }] })
  const dropStep = (sid) => setRoutine(active.id, { steps: steps.filter((st) => st.id !== sid) })

  return (
    <Page kicker="Hair" title="The routines"
      intro="Hair is not one routine, it is four. Pick the one you are doing today and tick it off; the steps keep their own record.">
      {/* Which routine she is in. */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {all.map((r) => {
          const on = active && active.id === r.id
          return (
            <button key={r.id} onClick={() => setDoing(r.id)} aria-pressed={on}
              className="shrink-0 whitespace-nowrap border px-4 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors"
              style={{ borderColor: on ? '#16130F' : '#D6D3D1', background: on ? '#16130F' : 'transparent', color: on ? '#F7F4ED' : '#57534E' }}>
              {r.name}
            </button>
          )
        })}
        <button onClick={() => setNewRoutine(true)}
          className="shrink-0 whitespace-nowrap border border-stone-300 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-stone-500 transition-colors hover:border-stone-900 hover:text-stone-900">
          + Routine
        </button>
      </div>

      {active ? (
        <div className="mt-4">
          <Band count={steps.length ? `${steps.filter(done).length} of ${steps.length} today` : null}>
            {`${active.name} · ${typeLabel(active.type)}`}
          </Band>
          {steps.length ? steps.map((st, i) => {
            const kept = done(st)
            return (
              <Row key={st.id} first={!i} onOpen={() => setOpen({ routine: active.id, step: st })} onAway={() => dropStep(st.id)}
                aside={<Mark on={kept} onClick={() => tick(st.id)} label={`${kept ? 'Done' : 'Do'} ${st.name}`}>{kept ? 'Done' : 'Do'}</Mark>}>
                <Name struck={kept}>{st.name}</Name>
                <Meta>{st.product}</Meta>
              </Row>
            )
          }) : <Empty>No steps in this routine yet.</Empty>}

          <Plus onClick={() => setAdding(true)} label="Add a step" />
          <Starters label={`Common ${typeLabel(active.type).toLowerCase()} steps`}
            options={STEP_STARTERS[active.type] || STEP_STARTERS.wash}
            has={(o) => steps.some((st) => st.name === o)} onPick={putStep} />

          <button onClick={() => dropRoutine(active.id)}
            className="mt-14 text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-70" style={{ color: '#C87A7A' }}>
            Delete this routine
          </button>
        </div>
      ) : <Empty>No routines yet. Start with a wash day.</Empty>}

      {newRoutine && (
        <RoutineSheet onClose={() => setNewRoutine(false)} onSave={(d) => {
          const made = { ...d, id: uid(), steps: [] }
          setRaw((p) => [...arr(p), made]); setDoing(made.id); setNewRoutine(false)
        }} />
      )}
      {(adding || open) && (
        <StepSheet item={open && open.step}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { dropStep(open.step.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRoutine(active.id, { steps: steps.map((st) => (st.id === open.step.id ? { ...st, ...d } : st)) })
            else setRoutine(active.id, { steps: [...steps, { ...d, id: uid(), completions: {} }] })
            setAdding(false); setOpen(null)
          }} />
      )}
    </Page>
  )
}

function RoutineSheet({ onSave, onClose }) {
  const { name, setName, field, ready } = useRequiredName('')
  const [type, setType] = useState('wash')
  const save = () => { const t = ready(); if (t) onSave({ name: t, type }) }
  return (
    <Sheet kicker="A routine" onClose={onClose} onSave={save} saveLabel="Add">
      <Big ref={field} value={name} onChange={setName} placeholder="Sunday wash day" onEnter={save} />
      <Chips label="What kind" options={TYPES} value={type} onChange={setType} />
    </Sheet>
  )
}

function StepSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [product, setProduct] = useState(item ? item.product || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, product }) }
  return (
    <Sheet kicker="A step" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Bond builder" onEnter={save} />
      <Field label="Which product" value={product} onChange={setProduct} placeholder="olaplex no.3" width="mt-8" onEnter={save} />
    </Sheet>
  )
}

// ── 2 · The calendar ───────────────────────────────────────────────
//
// Wash day, oiling and masks happen on an interval rather than a weekday, and
// the interval is the thing that slips. Each one says when it is next owed and
// puts that day on her schedule.
const CAL_STARTERS = ['wash day', 'scalp oiling', 'deep mask', 'bond treatment', 'clarify', 'trim']

function HairCalendar() {
  const [raw, setRaw] = useLocalStorage('mos:hair:cycle', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const nextOn = (x) => (x.last && x.every ? plusDays(x.last, x.every) : '')
  const drop = (x) => { if (x.linked) remove(x.linked); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }

  const didIt = (x) => {
    const last = today()
    const next = plusDays(last, x.every || 7)
    if (x.linked) remove(x.linked)
    const made = add(blankActivity('event', {
      title: x.name, category: 'haircare', frequency: 'once', seriesStart: next,
      details: { time: '', endTime: '', partOfDay: 'evening', description: '', attendees: '', durationMinutes: '' },
    }))
    setRaw((p) => arr(p).map((y) => (y.id === x.id ? { ...y, last, linked: made.id } : y)))
  }

  return (
    <Page kicker="Hair" title="The calendar"
      intro="Wash day, oiling and masks run on an interval, not a weekday — and the interval is the thing that slips. Marking one done books the next.">
      {all.length ? all.map((x, i) => {
        const next = nextOn(x)
        const left = next ? daysTo(next) : null
        const word = left == null ? 'never done' : left < 0 ? `${-left} days overdue` : left === 0 ? 'today' : `in ${left} days`
        return (
          <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x)}
            aside={<Mark on={false} onClick={() => didIt(x)} label={`Did ${x.name} today`}>Done today</Mark>}>
            <Name>{x.name}</Name>
            <Meta>{[`every ${x.every} days`, x.last ? `last ${said(x.last)}` : '', word].filter(Boolean).join(' · ')}</Meta>
          </Row>
        )
      }) : <Empty>Nothing on a cycle yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Add to the cycle" />
      <Starters options={CAL_STARTERS} has={(o) => all.some((x) => x.name === o)}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, every: 7, last: '', notes: '', linked: '' }])} />

      {(adding || open) && (
        <CycleSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid(), linked: '' }])
            setAdding(false); setOpen(null)
          }} />
      )}
    </Page>
  )
}

const EVERY_DAYS = [
  { id: '3', label: 'Every 3 days' }, { id: '4', label: 'Every 4 days' },
  { id: '7', label: 'Weekly' }, { id: '14', label: 'Fortnightly' },
  { id: '28', label: 'Monthly' }, { id: '84', label: 'Every 12 weeks' },
]

function CycleSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [every, setEvery] = useState(item ? String(item.every || 7) : '7')
  const [last, setLast] = useState(item ? item.last || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, every: Number(every), last, notes }) }
  return (
    <Sheet kicker="The calendar" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Wash day" onEnter={save} />
      <Chips label="How often" options={EVERY_DAYS} value={every} onChange={setEvery} />
      <Field label="Last done" type="date" value={last} onChange={setLast} width="mt-8" />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 3 · The log ────────────────────────────────────────────────────
//
// How it actually was, in her words and in tags that can be counted later —
// with the wash count and the heat beside them, because those are the two
// things that explain most of what hair does.
const TAGS = ['oily', 'dry', 'frizzy', 'breakage', 'shedding', 'itchy scalp', 'flaky', 'limp', 'good hair day']

function HairLog({ cycleConfig }) {
  const [raw, setRaw] = useLocalStorage('mos:hair:log', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))

  // Cycle day comes from Hormones rather than being typed again.
  const dayOf = (k) => {
    const start = cycleConfig && (cycleConfig.lastPeriod || cycleConfig.start)
    if (!start || !k) return ''
    const n = Math.round((parseKey(k) - parseKey(start)) / 86400000) + 1
    const len = Number((cycleConfig && cycleConfig.cycleLength) || 28)
    if (!Number.isFinite(n) || n < 1) return ''
    return `day ${((n - 1) % len) + 1}`
  }

  return (
    <Page kicker="Hair" title="The log"
      intro="How it actually was. The tags can be counted later; the wash count and the heat are the two things that explain most of what hair does.">
      {all.length ? all.map((x, i) => (
        <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
          <Name>{arr(x.tags).length ? arr(x.tags).join(', ') : 'noted'}</Name>
          <Meta>{[said(x.on), x.washes ? `${x.washes} since washing` : '', x.heat ? `heat · ${[x.tool, x.temp].filter(Boolean).join(' ')}` : 'no heat', dayOf(x.on)].filter(Boolean).join(' · ')}</Meta>
          {x.notes && <span className="mt-3 block max-w-xl text-[15px] leading-relaxed text-stone-500 line-clamp-2">{x.notes}</span>}
        </Row>
      )) : <Empty>Nothing logged yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Log today" />
      <Starters label="Log today as" options={TAGS} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), on: today(), tags: [o], washes: '', heat: false, tool: '', temp: '', notes: '' }])} />

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

function LogSheet({ item, onSave, onDrop, onClose }) {
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [tags, setTags] = useState(item ? arr(item.tags) : [])
  const [washes, setWashes] = useState(item ? String(item.washes || '') : '')
  const [heat, setHeat] = useState(item ? !!item.heat : false)
  const [tool, setTool] = useState(item ? item.tool || '' : '')
  const [temp, setTemp] = useState(item ? item.temp || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const flip = (t) => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  const save = () => onSave({ on, tags, washes: washes.replace(/[^\d]/g, ''), heat, tool, temp, notes })
  return (
    <Sheet kicker="The log" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <div className="mt-6 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="Days since washing" value={washes} onChange={setWashes} placeholder="3" width="w-[40%]" />
      </div>
      <div className="mt-8">
        <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">How it was</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const on2 = tags.includes(t)
            return (
              <button key={t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => flip(t)} aria-pressed={on2}
                className="border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors"
                style={{ borderColor: on2 ? '#F7F4ED' : 'rgba(247,244,237,0.3)', background: on2 ? '#F7F4ED' : 'transparent', color: on2 ? '#68472C' : 'rgba(247,244,237,0.75)' }}>
                {t}
              </button>
            )
          })}
        </div>
      </div>
      <Chips label="Heat today" options={[{ id: 'no', label: 'None' }, { id: 'yes', label: 'Yes' }]} value={heat ? 'yes' : 'no'} onChange={(v) => setHeat(v === 'yes')} />
      {heat && (
        <div className="mt-8 flex items-end gap-6">
          <Field label="What with" value={tool} onChange={setTool} placeholder="dyson · straighteners" width="flex-1" />
          <Field label="How hot" value={temp} onChange={setTemp} placeholder="180°" width="w-[36%]" />
        </div>
      )}
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 4 · The photographs ────────────────────────────────────────────
//
// Matched by angle, because a crown shot beside a length shot tells you
// nothing. Pick the angle and the page compares like with like.
const ANGLES = [
  { id: 'front', label: 'Front' }, { id: 'back', label: 'Back' },
  { id: 'part', label: 'Part line' }, { id: 'crown', label: 'Crown' }, { id: 'length', label: 'Length' },
]
const LIGHTS = [{ id: 'daylight', label: 'Daylight' }, { id: 'indoor', label: 'Indoors' }, { id: 'bathroom', label: 'Bathroom' }]

function PhotoLog() {
  const [raw, setRaw] = useLocalStorage('mos:hair:photos', [])
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
    try {
      const src = await shrink(f)
      setRaw((p) => [...arr(p), { id: uid(), on: today(), angle, light: 'daylight', src }])
    } finally { setBusy(false) }
  }

  const left = same[Math.min(a, same.length - 1)]
  const right = same[Math.min(Math.max(b, same.length - 1), same.length - 1)]

  return (
    <Page kicker="Hair" title="The photographs"
      intro="Matched by angle, because a crown shot beside a length shot tells you nothing. Same light, same place, every time.">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {ANGLES.map((x) => {
          const on = angle === x.id
          const n = all.filter((y) => y.angle === x.id).length
          return (
            <button key={x.id} onClick={() => { setAngle(x.id); setA(0); setB(0) }} aria-pressed={on}
              className="shrink-0 whitespace-nowrap border px-4 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors"
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

// ── 5 · The salon ──────────────────────────────────────────────────
//
// The formula is the point. A colour she loved is useless if nobody wrote
// down what was in it, so the most recent one is held at the top of the page
// where she can read it out.
const SERVICES = ['cut', 'colour', 'gloss', 'balayage', 'root touch-up', 'toner', 'treatment', 'extensions', 'keratin', 'blowout']

function Salon() {
  const [raw, setRaw] = useLocalStorage('mos:hair:salon', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const k = today()
  const ahead = all.filter((x) => !x.on || x.on >= k).sort((a, b) => (a.on || '9').localeCompare(b.on || '9'))
  const past = all.filter((x) => x.on && x.on < k).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const lastFormula = past.find((x) => x.formula)

  const unlink = (x) => { if (x.linked) remove(x.linked); if (x.rebook) remove(x.rebook) }
  const drop = (x) => { unlink(x); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }
  const sync = (x) => {
    unlink(x)
    let linked = ''
    let rebook = ''
    if (x.on) linked = add(blankActivity('event', {
      title: x.name, category: 'haircare', frequency: 'once', seriesStart: x.on,
      details: { time: x.at || '', endTime: '', partOfDay: 'afternoon', description: x.where || '', attendees: x.who || '', durationMinutes: '' },
    })).id
    if (x.due) rebook = add(blankActivity('event', {
      title: `rebook ${x.name}`, category: 'haircare', frequency: 'once', seriesStart: x.due,
      details: { time: '', endTime: '', partOfDay: 'morning', description: x.who || '', attendees: '', durationMinutes: '' },
    })).id
    return { linked, rebook }
  }

  const line = (x, first) => (
    <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x)}>
      <Name>{x.name}</Name>
      <Meta>{[said(x.on), x.who, x.where, x.cost, x.off ? `${x.off} off` : '', x.due ? `rebook ${said(x.due)}` : ''].filter(Boolean).join(' · ')}</Meta>
      {x.formula && <span className="mt-2 block text-[10px] uppercase tracking-[0.16em]" style={{ color: '#68472C' }}>{x.formula}</span>}
    </Row>
  )

  return (
    <Page kicker="Hair" title="The salon"
      intro="Who did it, what it cost, and the formula — which is the whole point, because a colour she loved is useless if nobody wrote down what was in it.">
      {lastFormula && (
        <div className="mb-12 border-t border-stone-900 pt-6">
          <p className="kicker text-stone-500">The last formula</p>
          <p className="mt-3 font-serif text-[26px] leading-snug text-stone-900">{lastFormula.formula}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-stone-400">{[lastFormula.who, said(lastFormula.on)].filter(Boolean).join(' · ')}</p>
        </div>
      )}

      <Band count={ahead.length || null}>Coming</Band>
      {ahead.length ? ahead.map((x, i) => line(x, !i)) : <Empty>Nothing booked.</Empty>}
      {past.length > 0 && (<><Band count={past.length}>Been</Band>{past.map((x, i) => line(x, !i))}</>)}

      <Plus onClick={() => setAdding(true)} label="Add an appointment" />
      <Starters options={SERVICES} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, who: '', where: '', on: '', at: '', cost: '', formula: '', off: '', due: '', notes: '', linked: '', rebook: '' }])} />

      {(adding || open) && (
        <SalonSheet item={open} lastFormula={lastFormula ? lastFormula.formula : ''}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open); setOpen(null) } : null}
          onSave={(d) => {
            const base = open ? { ...open, ...d } : { ...d, id: uid(), linked: '', rebook: '' }
            const ids = sync(base)
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...base, ...ids } : x)))
            else setRaw((p) => [...arr(p), { ...base, ...ids }])
            setAdding(false); setOpen(null)
          }} />
      )}
    </Page>
  )
}

function SalonSheet({ item, lastFormula, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [who, setWho] = useState(item ? item.who || '' : '')
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [on, setOn] = useState(item ? item.on || '' : '')
  const [at, setAt] = useState(item ? item.at || '' : '')
  const [cost, setCost] = useState(item ? item.cost || '' : '')
  const [formula, setFormula] = useState(item ? item.formula || '' : '')
  const [off, setOff] = useState(item ? item.off || '' : '')
  const [due, setDue] = useState(item ? item.due || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, who, where, on, at, cost, formula, off, due, notes }) }
  return (
    <Sheet kicker="The salon" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Cut and gloss" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="Stylist" value={who} onChange={setWho} placeholder="a name" width="flex-1" onEnter={save} />
        <Field label="What it cost" value={cost} onChange={setCost} placeholder="$280" width="w-[36%]" onEnter={save} />
      </div>
      <Field label="Salon" value={where} onChange={setWhere} placeholder="the salon" width="mt-8" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="At" type="time" value={at} onChange={setAt} width="w-[40%]" />
      </div>
      <Field label="The formula" value={formula} onChange={setFormula} placeholder={lastFormula || '7n + 20vol, 30 mins'} width="mt-8" onEnter={save} />
      {lastFormula && !formula && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setFormula(lastFormula)}
          className="mt-3 text-[10px] uppercase tracking-[0.18em] text-cream/60 underline underline-offset-4 transition-opacity hover:opacity-80">
          Same as last time
        </button>
      )}
      <div className="mt-8 flex items-end gap-6">
        <Field label="Length taken off" value={off} onChange={setOff} placeholder="two inches" width="flex-1" onEnter={save} />
        <Field label="Due again" type="date" value={due} onChange={setDue} width="flex-1" />
      </div>
      <p className="mt-3 text-[13px] italic text-cream/50">The appointment goes on its day; the rebooking goes on the day it is due.</p>
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 6 · Treatments ─────────────────────────────────────────────────
//
// A course of anything is six of them, and what lapses is number four. So a
// treatment knows which of how many it is, and books the next.
const WHERE = [{ id: 'home', label: 'At home' }, { id: 'salon', label: 'In salon' }]
const TREAT_STARTERS = ['bond treatment', 'deep conditioning mask', 'scalp facial', 'keratin',
  'prp for the scalp', 'microneedling the scalp', 'olaplex', 'protein treatment', 'clarifying detox']

function Treatments() {
  const [raw, setRaw] = useLocalStorage('mos:hair:treatments', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const [only, setOnly] = useState('')
  const all = arr(raw).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const shown = only ? all.filter((x) => x.where === only) : all
  const drop = (x) => { if (x.linked) remove(x.linked); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }

  const book = (x) => {
    if (x.linked) remove(x.linked)
    if (!x.due) return
    const made = add(blankActivity('event', {
      title: `${x.name}${x.of ? ` (${Number(x.no || 1) + 1} of ${x.of})` : ''}`, category: 'haircare',
      frequency: 'once', seriesStart: x.due,
      details: { time: '', endTime: '', partOfDay: 'evening', description: x.who || '', attendees: '', durationMinutes: '' },
    }))
    setRaw((p) => arr(p).map((y) => (y.id === x.id ? { ...y, linked: made.id } : y)))
  }

  return (
    <Page kicker="Hair" title="Treatments"
      intro="A course of anything is six of them, and the one that lapses is number four. Each knows which of how many it is, and books the next.">
      <div className="flex gap-2">
        {[{ id: '', label: 'All' }, ...WHERE].map((w) => {
          const on = only === w.id
          return (
            <button key={w.id || 'all'} onClick={() => setOnly(w.id)} aria-pressed={on}
              className="border px-4 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors"
              style={{ borderColor: on ? '#16130F' : '#D6D3D1', background: on ? '#16130F' : 'transparent', color: on ? '#F7F4ED' : '#57534E' }}>
              {w.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        {shown.length ? shown.map((x, i) => (
          <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x)}
            aside={x.due ? <Mark on={!!x.linked} onClick={() => book(x)} label={`Book the next ${x.name}`}>{x.linked ? 'Booked' : 'Book next'}</Mark> : null}>
            <Name>{x.name}</Name>
            <Meta>{[said(x.on), (WHERE.find((w) => w.id === x.where) || {}).label, x.who, x.cost,
              x.of ? `${x.no || 1} of ${x.of}` : '', x.due ? `next ${said(x.due)}` : ''].filter(Boolean).join(' · ')}</Meta>
            {x.result && <span className="mt-3 block max-w-xl text-[15px] leading-relaxed text-stone-500">{x.result}</span>}
          </Row>
        )) : <Empty>Nothing logged yet.</Empty>}
      </div>

      <Plus onClick={() => setAdding(true)} label="Add a treatment" />
      <Starters options={TREAT_STARTERS} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, where: 'home', who: '', on: today(), cost: '', no: '', of: '', result: '', due: '', notes: '', linked: '' }])} />

      {(adding || open) && (
        <TreatSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid(), linked: '' }])
            setAdding(false); setOpen(null)
          }} />
      )}
    </Page>
  )
}

function TreatSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [where, setWhere] = useState(item ? item.where || 'home' : 'home')
  const [who, setWho] = useState(item ? item.who || '' : '')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [cost, setCost] = useState(item ? item.cost || '' : '')
  const [no, setNo] = useState(item ? String(item.no || '') : '')
  const [of, setOf] = useState(item ? String(item.of || '') : '')
  const [result, setResult] = useState(item ? item.result || '' : '')
  const [due, setDue] = useState(item ? item.due || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, where, who, on, cost, no, of, result, due, notes }) }
  return (
    <Sheet kicker="Treatments" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Bond treatment" onEnter={save} />
      <Chips label="Where" options={WHERE} value={where} onChange={setWhere} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="Who did it" value={who} onChange={setWho} placeholder="myself · the salon" width="flex-1" onEnter={save} />
        <Field label="What it cost" value={cost} onChange={setCost} placeholder="$0" width="w-[36%]" onEnter={save} />
      </div>
      <div className="mt-8 flex items-end gap-5">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="Which one" value={no} onChange={setNo} placeholder="3" width="w-[20%]" />
        <Field label="Of how many" value={of} onChange={setOf} placeholder="6" width="w-[22%]" />
      </div>
      <Field label="How it turned out" value={result} onChange={setResult} placeholder="softer, less breakage at the ends" width="mt-8" onEnter={save} />
      <Field label="Next one due" type="date" value={due} onChange={setDue} width="mt-8" />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}
