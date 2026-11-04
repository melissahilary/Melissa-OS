import React, { useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import { dateKey, longDate, parseKey } from '../lib/date'
import {
  Page, Band, Row, Name, Meta, Mark, Plus, Empty, Starters, Sheet, Big, Field, Notes, Chips,
  useRequiredName, uid, arr, shrink,
} from './shared/Ledger'

// ── Skin.
//
// Five pages, and only the first one is a routine. The other four are the
// things a woman actually needs and no app gives her: what she owns and when
// it goes off, what her face looked like in March, what the LED mask has
// actually done, and what she is halfway through patch-testing.

export default function Skincare({ subPage }) {
  if (subPage === 'shelf') return <Shelf />
  if (subPage === 'photos') return <Photos />
  if (subPage === 'rituals') return <Rituals />
  if (subPage === 'wishlist') return <Wishlist />
  if (subPage === 'appointments') return <Appointments />
  return <Routine />
}

const said = (k) => (k ? longDate(k) : '')
const today = () => dateKey(new Date())
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000)

// ── 1 · The routine ────────────────────────────────────────────────
//
// Four versions of a face, because one of them is a lie. Her skin on a normal
// Tuesday is not her skin on a plane, or the week after a peel, or the day it
// has decided to be angry. Switching version switches the whole page; the
// steps she ticks are the steps of the version she is standing in.
const MODES = [
  { id: 'everyday', label: 'Every day' },
  { id: 'travel', label: 'Travelling' },
  { id: 'treated', label: 'After a treatment' },
  { id: 'irritated', label: 'Irritated' },
]
const HALVES = [{ id: 'am', label: 'Morning' }, { id: 'pm', label: 'Evening' }]

const AM_STARTERS = ['cleanse', 'splash with cold water only', 'toner', 'essence', 'vitamin c serum',
  'hyaluronic acid on damp skin', 'peptide serum', 'eye cream', 'moisturiser', 'spf', 'spf on the neck and chest', 'lip balm']
const PM_STARTERS = ['remove makeup with balm', 'double cleanse', 'toner', 'retinol', 'niacinamide',
  'peptide serum', 'eye cream', 'face oil', 'night cream', 'lip mask', 'neck cream', 'a sleeping mask']

function Routine() {
  const [raw, setRaw] = useLocalStorage('mos:skin:routine', [])
  const [mode, setMode] = useLocalStorage('mos:skin:mode', 'everyday')
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(null) // the half being added to
  const key = today()
  const all = arr(raw)
  const using = MODES.some((m) => m.id === mode) ? mode : 'everyday'
  const inHalf = (half) => all
    .filter((x) => (x.mode || 'everyday') === using && (x.half || 'am') === half)
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const done = (x) => !!(x.completions && x.completions[key])
  const tick = (id) => setRaw((p) => arr(p).map((x) => {
    if (x.id !== id) return x
    const c = { ...(x.completions || {}) }
    if (c[key]) delete c[key]; else c[key] = true
    return { ...x, completions: c }
  }))
  const put = (name, half) => setRaw((p) => [...arr(p), {
    id: uid(), name, product: '', notes: '', mode: using, half, order: arr(p).length, completions: {},
  }])

  const half = (id, label, starters) => {
    const rows = inHalf(id)
    return (
      <>
        <Band count={rows.length ? `${rows.filter(done).length} of ${rows.length}` : null}>{label}</Band>
        {rows.length ? rows.map((x, i) => {
          const kept = done(x)
          return (
            <Row
              key={x.id}
              first={!i}
              onOpen={() => setOpen(x)}
              onAway={() => drop(x.id)}
              aside={<Mark on={kept} onClick={() => tick(x.id)} label={`${kept ? 'Done' : 'Do'} ${x.name}`}>{kept ? 'Done' : 'Do'}</Mark>}
            >
              <Name struck={kept}>{x.name}</Name>
              <Meta>{x.product}</Meta>
            </Row>
          )
        }) : <Empty>Nothing in this half yet.</Empty>}
        <Plus onClick={() => setAdding(id)} label={`Add a ${label.toLowerCase()} step`} />
        <Starters
          label={`Common ${label.toLowerCase()} steps`}
          options={starters}
          has={(o) => rows.some((x) => x.name === o)}
          onPick={(o) => put(o, id)}
        />
      </>
    )
  }

  return (
    <Page
      kicker="Skin"
      title="The routine"
      intro="Four versions of a face, because one of them is a lie. Her skin on a plane is not her skin on a Tuesday."
    >
      {/* Which face she is in today. */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {MODES.map((m) => {
          const on = using === m.id
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={on}
              className="shrink-0 whitespace-nowrap border px-4 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors"
              style={{
                borderColor: on ? '#16130F' : '#D6D3D1',
                background: on ? '#16130F' : 'transparent',
                color: on ? '#F7F4ED' : '#57534E',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        {half('am', 'Morning', AM_STARTERS)}
        {half('pm', 'Evening', PM_STARTERS)}
      </div>

      {(adding || open) && (
        <StepSheet
          item={open}
          onClose={() => { setAdding(null); setOpen(null) }}
          onDrop={open ? () => { drop(open.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid(), mode: using, half: adding, order: arr(p).length, completions: {} }])
            setAdding(null); setOpen(null)
          }}
        />
      )}
    </Page>
  )
}

function StepSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [product, setProduct] = useState(item ? item.product || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, product, notes }) }
  return (
    <Sheet kicker="A step" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Vitamin c serum" onEnter={save} />
      <Field label="Which product" value={product} onChange={setProduct} placeholder="skinceuticals c e ferulic" width="mt-8" onEnter={save} />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 2 · The shelf ──────────────────────────────────────────────────
//
// Everything she owns, and the two dates nobody keeps: when it was opened and
// when it turns. A serum is a live thing with a shelf life, and the page says
// so before it goes off rather than after.
const SHELF_STARTERS = ['cleanser', 'balm cleanser', 'toner', 'vitamin c serum', 'retinol', 'niacinamide',
  'hyaluronic acid', 'peptide serum', 'moisturiser', 'night cream', 'eye cream', 'face oil', 'spf', 'sheet masks', 'clay mask']

function Shelf() {
  const [raw, setRaw] = useLocalStorage('mos:skin:shelf', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const k = today()

  // Opened plus its period-after-opening is when it turns.
  const turnsOn = (x) => {
    if (x.expiry) return x.expiry
    if (!x.opened || !x.pao) return ''
    const d = parseKey(x.opened)
    d.setMonth(d.getMonth() + Number(x.pao))
    return dateKey(d)
  }
  const state = (x) => {
    const t = turnsOn(x)
    if (!t) return ''
    const left = daysBetween(k, t)
    if (left < 0) return 'Past it'
    if (left <= 30) return `${left} days left`
    return ''
  }

  const going = all.filter((x) => state(x))
  const rest = all.filter((x) => !state(x))
  const line = (x, first) => (
    <Row
      key={x.id}
      first={first}
      onOpen={() => setOpen(x)}
      onAway={() => drop(x.id)}
      aside={x.repurchase ? <Mark on={false} onClick={() => setOpen(x)} label="Repurchase">Repurchase</Mark> : null}
    >
      <Name>{x.name}</Name>
      <Meta>{[x.brand, x.ingredients, x.price, state(x)].filter(Boolean).join(' · ')}</Meta>
    </Row>
  )

  return (
    <Page
      kicker="Skin"
      title="The shelf"
      intro="Everything she owns, and the two dates nobody keeps: when it was opened, and when it turns."
    >
      {going.length > 0 && (
        <>
          <Band count={going.length}>Running out or turned</Band>
          {going.map((x, i) => line(x, !i))}
        </>
      )}
      <Band count={rest.length || null}>On the shelf</Band>
      {rest.length ? rest.map((x, i) => line(x, !i)) : <Empty>Nothing on the shelf yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Add a product" />
      <Starters
        options={SHELF_STARTERS}
        has={(o) => all.some((x) => x.name === o)}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, brand: '', ingredients: '', opened: '', pao: '', expiry: '', price: '', repurchase: false, notes: '' }])}
      />

      {(adding || open) && (
        <ShelfSheet
          item={open}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid() }])
            setAdding(false); setOpen(null)
          }}
        />
      )}
    </Page>
  )
}

const PAOS = [
  { id: '', label: 'Not sure' },
  { id: '3', label: '3 months' },
  { id: '6', label: '6 months' },
  { id: '12', label: '12 months' },
  { id: '24', label: '24 months' },
]

function ShelfSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [brand, setBrand] = useState(item ? item.brand || '' : '')
  const [ingredients, setIngredients] = useState(item ? item.ingredients || '' : '')
  const [opened, setOpened] = useState(item ? item.opened || '' : '')
  const [pao, setPao] = useState(item ? String(item.pao || '') : '')
  const [price, setPrice] = useState(item ? item.price || '' : '')
  const [repurchase, setRepurchase] = useState(item ? !!item.repurchase : false)
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, brand, ingredients, opened, pao, price, repurchase, notes }) }

  return (
    <Sheet kicker="On the shelf" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Vitamin c serum" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="Brand" value={brand} onChange={setBrand} placeholder="skinceuticals" width="flex-1" onEnter={save} />
        <Field label="What it cost" value={price} onChange={setPrice} placeholder="$140" width="w-[36%]" onEnter={save} />
      </div>
      <Field label="What is in it" value={ingredients} onChange={setIngredients} placeholder="15% l-ascorbic, ferulic" width="mt-8" onEnter={save} />
      <Field label="Opened on" type="date" value={opened} onChange={setOpened} width="mt-8" />
      <Chips label="Good for" options={PAOS} value={pao} onChange={setPao} />
      <Chips
        label="Buy it again"
        options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]}
        value={repurchase ? 'yes' : 'no'}
        onChange={(v) => setRepurchase(v === 'yes')}
      />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 3 · The photographs ────────────────────────────────────────────
//
// Same light, same angle, same face. The slider is the whole point: skin
// changes too slowly to see day to day and all at once when you put March
// beside November.
//
// The picture is shrunk to 900px and written down at middling quality before
// it is kept, because a photograph straight off a phone is four megabytes and
// this is a planner, not a darkroom.
function Photos() {
  const [raw, setRaw] = useLocalStorage('mos:skin:photos', [])
  const all = arr(raw).sort((a, b) => (a.on || '').localeCompare(b.on || ''))
  const file = useRef(null)
  const [busy, setBusy] = useState(false)
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const [wipe, setWipe] = useState(50)

  const take = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const src = await shrink(f)
      setRaw((p) => [...arr(p), { id: uid(), on: today(), src, note: '' }])
    } finally { setBusy(false) }
  }
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))

  const left = all[Math.min(a, all.length - 1)]
  const right = all[Math.min(Math.max(b, 0), all.length - 1)]

  return (
    <Page
      kicker="Skin"
      title="The photographs"
      intro="Same light, same angle, same face. Skin changes too slowly to see day to day and all at once when you put March beside November."
    >
      {all.length >= 2 && left && right && (
        <>
          <Band>{`${said(left.on)} beside ${said(right.on)}`}</Band>
          {/* Two pictures in one frame, the top one revealed by the handle. */}
          <div className="relative w-full select-none overflow-hidden border border-stone-200" style={{ aspectRatio: '3 / 4', background: '#EEEAE1' }}>
            <img src={right.src} alt={`Skin on ${said(right.on)}`} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${wipe}%` }}>
              <img src={left.src} alt={`Skin on ${said(left.on)}`} className="absolute inset-0 h-full w-full object-cover" style={{ width: `${100 * (100 / Math.max(wipe, 1))}%`, maxWidth: 'none' }} />
            </div>
            <span className="pointer-events-none absolute inset-y-0 w-px bg-cream" style={{ left: `${wipe}%` }} />
          </div>
          <input
            type="range" min="0" max="100" value={wipe}
            onChange={(e) => setWipe(Number(e.target.value))}
            aria-label="Slide between the two"
            className="mt-5 w-full accent-stone-900"
          />
          <div className="mt-5 grid grid-cols-2 gap-6">
            <Pick label="Before" all={all} i={a} onPick={setA} />
            <Pick label="After" all={all} i={b} onPick={setB} />
          </div>
        </>
      )}

      <Band count={all.length || null}>Every picture</Band>
      {all.length ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {all.map((x) => (
            <figure key={x.id} className="relative">
              <img src={x.src} alt={said(x.on)} className="block w-full border border-stone-200 object-cover" style={{ aspectRatio: '3 / 4' }} />
              <figcaption className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-[9px] uppercase tracking-[0.14em] text-stone-500">{said(x.on)}</span>
                <button onClick={() => drop(x.id)} className="text-[9px] uppercase tracking-[0.14em] transition-opacity hover:opacity-70" style={{ color: '#C87A7A' }}>Delete</button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : <Empty>No pictures yet. Take the first in the light you will always use.</Empty>}

      <input ref={file} type="file" accept="image/*" onChange={take} className="hidden" />
      <div className="pt-8">
        <button
          onClick={() => file.current && file.current.click()}
          disabled={busy}
          className="mx-auto block border border-stone-300 px-6 py-3 text-[10px] uppercase tracking-[0.18em] text-stone-900 transition-colors hover:border-stone-900 disabled:opacity-40"
        >
          {busy ? 'Keeping it…' : 'Add today’s picture'}
        </button>
      </div>
    </Page>
  )
}

function Pick({ label, all, i, onPick }) {
  return (
    <label className="block">
      <span className="kicker block text-stone-500">{label}</span>
      <select
        value={i}
        onChange={(e) => onPick(Number(e.target.value))}
        className="mt-3 w-full border-b border-stone-300 bg-transparent pb-2 text-[15px] text-stone-900 outline-none"
      >
        {all.map((x, k) => <option key={x.id} value={k}>{said(x.on)}</option>)}
      </select>
    </label>
  )
}

// ── 4 · At-home rituals ────────────────────────────────────────────
const RITUAL_STARTERS = ['led mask', 'microcurrent', 'gua sha', 'ice facial', 'sheet mask', 'clay mask',
  'dermaplane', 'derma roller', 'steam', 'enzyme peel', 'lymphatic massage', 'face taping']

function Rituals() {
  const [raw, setRaw] = useLocalStorage('mos:skin:rituals', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))

  return (
    <Page
      kicker="Skin"
      title="At home"
      intro="The mask, the microcurrent, the gua sha — when, how long, and what her skin did afterwards. It is the only way to tell whether any of it works."
    >
      {all.length ? all.map((x, i) => (
        <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
          <Name>{x.name}</Name>
          <Meta>{[said(x.on), x.minutes ? `${x.minutes} min` : '', x.after].filter(Boolean).join(' · ')}</Meta>
        </Row>
      )) : <Empty>Nothing logged yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Log a ritual" />
      <Starters
        label="Log one from today"
        options={RITUAL_STARTERS}
        has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, on: today(), minutes: '', after: '', notes: '' }])}
      />

      {(adding || open) && (
        <RitualSheet
          item={open}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid() }])
            setAdding(false); setOpen(null)
          }}
        />
      )}
    </Page>
  )
}

const AFTERS = [
  { id: 'calm', label: 'Calm' },
  { id: 'glowing', label: 'Glowing' },
  { id: 'plump', label: 'Plump' },
  { id: 'red', label: 'Red' },
  { id: 'dry', label: 'Dry' },
  { id: 'broke out', label: 'Broke out' },
]

function RitualSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [minutes, setMinutes] = useState(item ? String(item.minutes || '') : '')
  const [after, setAfter] = useState(item ? item.after || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, on, minutes: minutes.replace(/[^\d]/g, ''), after, notes }) }
  return (
    <Sheet kicker="At home" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Led mask" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="How long" value={minutes} onChange={setMinutes} placeholder="10" width="w-[34%]" onEnter={save} />
      </div>
      <Chips label="How her skin looked after" options={AFTERS} value={after} onChange={setAfter} />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 5 · Wanted, and on trial ───────────────────────────────────────
const STAGES = [
  { id: 'want', label: 'Want to try' },
  { id: 'testing', label: 'Patch testing' },
  { id: 'kept', label: 'Kept it' },
  { id: 'dropped', label: 'Not for me' },
]
const PRIORITY = [
  { id: 'now', label: 'Buying now' },
  { id: 'soon', label: 'Soon' },
  { id: 'someday', label: 'Someday' },
]
const stageLabel = (id) => (STAGES.find((s) => s.id === id) || {}).label || ''

function Wishlist() {
  const [raw, setRaw] = useLocalStorage('mos:skin:wishlist', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const want = all.filter((x) => (x.stage || 'want') === 'want')
  const buying = want.filter((x) => x.priority === 'now')
  const someday = want.filter((x) => x.priority !== 'now')
  const band = (stage) => all.filter((x) => (x.stage || 'want') === stage)

  const line = (x, first) => (
    <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
      <Name>{x.name}</Name>
      <Meta>{[x.brand, x.price, x.where, x.started ? `since ${said(x.started)}` : '', x.result].filter(Boolean).join(' · ')}</Meta>
      {x.reason && <span className="mt-2 block max-w-xl text-[15px] leading-relaxed text-stone-500">{x.reason}</span>}
    </Row>
  )

  return (
    <Page
      kicker="Skin"
      title="Wanted"
      intro="What she means to try, and what is on her face right now on trial — with the day it started, so a reaction has a date attached to it."
    >
      <Band count={buying.length || null}>To buy</Band>
      {buying.length ? buying.map((x, i) => line(x, !i)) : <Empty>Nothing on the list right now.</Empty>}

      <Band count={someday.length || null}>Wishlist</Band>
      {someday.length ? someday.map((x, i) => line(x, !i)) : <Empty>Nothing wanted yet.</Empty>}

      {STAGES.filter((s) => s.id !== 'want').map((s) => {
        const rows = band(s.id)
        if (!rows.length) return null
        return (
          <React.Fragment key={s.id}>
            <Band count={rows.length}>{s.label}</Band>
            {rows.map((x, i) => line(x, !i))}
          </React.Fragment>
        )
      })}

      <Plus onClick={() => setAdding(true)} label="Add a product" />

      {(adding || open) && (
        <WishSheet
          item={open}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid() }])
            setAdding(false); setOpen(null)
          }}
        />
      )}
    </Page>
  )
}

function WishSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [brand, setBrand] = useState(item ? item.brand || '' : '')
  const [price, setPrice] = useState(item ? item.price || '' : '')
  const [stage, setStage] = useState(item ? item.stage || 'want' : 'want')
  const [reason, setReason] = useState(item ? item.reason || '' : '')
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [priority, setPriority] = useState(item ? item.priority || 'someday' : 'someday')
  const [started, setStarted] = useState(item ? item.started || '' : '')
  const [result, setResult] = useState(item ? item.result || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, brand, price, stage, started, result, notes, reason, where, priority }) }
  return (
    <Sheet kicker="Wanted" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="The barrier cream everyone is on about" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="Brand" value={brand} onChange={setBrand} placeholder="a name" width="flex-1" onEnter={save} />
        <Field label="What it costs" value={price} onChange={setPrice} placeholder="$64" width="w-[36%]" onEnter={save} />
      </div>
      <Field label="Why she wants it" value={reason} onChange={setReason} placeholder="for the texture on my cheeks" width="mt-8" onEnter={save} />
      <Field label="Where to buy it" value={where} onChange={setWhere} placeholder="sephora · the clinic · direct" width="mt-8" onEnter={save} />
      <Chips label="How soon" options={PRIORITY} value={priority} onChange={setPriority} />
      <Chips label="Where it is up to" options={STAGES} value={stage} onChange={setStage} />
      {(stage === 'testing' || stage === 'kept' || stage === 'dropped') && (
        <>
          <Field label="Started on" type="date" value={started} onChange={setStarted} width="mt-8" />
          <Field label="How it is going" value={result} onChange={setResult} placeholder="no reaction so far" width="mt-8" onEnter={save} />
        </>
      )}
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 6 · The chair ──────────────────────────────────────────────────
//
// A facial is not a note in a diary, it is two hours of a Thursday and a
// thing that has to happen again in six weeks. So one entry writes twice: the
// appointment on its day, and the rebooking on the day it comes due — which
// is the one everybody forgets and the reason a course of anything lapses.
const SERVICE_STARTERS = ['facial', 'hydrafacial', 'chemical peel', 'microneedling', 'dermaplane',
  'laser', 'ipl', 'led therapy', 'extraction facial', 'lymphatic facial', 'consultation']

function Appointments() {
  const [raw, setRaw] = useLocalStorage('mos:skin:appointments', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const k = today()
  const ahead = all.filter((x) => !x.on || x.on >= k).sort((a, b) => (a.on || '9').localeCompare(b.on || '9'))
  const past = all.filter((x) => x.on && x.on < k).sort((a, b) => (b.on || '').localeCompare(a.on || ''))

  const unlink = (x) => { if (x.linked) remove(x.linked); if (x.rebook) remove(x.rebook) }
  const drop = (x) => { unlink(x); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }

  // Two lines on the calendar from one entry.
  const sync = (x) => {
    unlink(x)
    let linked = ''
    let rebook = ''
    if (x.on) {
      linked = add(blankActivity('event', {
        title: x.name, category: 'skincare', frequency: 'once', seriesStart: x.on,
        details: { time: x.at || '', endTime: '', partOfDay: 'afternoon', description: x.where || '', attendees: x.who || '', durationMinutes: '' },
      })).id
    }
    if (x.due) {
      rebook = add(blankActivity('event', {
        title: `rebook ${x.name}`, category: 'skincare', frequency: 'once', seriesStart: x.due,
        details: { time: '', endTime: '', partOfDay: 'morning', description: x.who || '', attendees: '', durationMinutes: '' },
      })).id
    }
    return { linked, rebook }
  }

  const line = (x, first) => (
    <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x)}>
      <Name>{x.name}</Name>
      <Meta>{[said(x.on), x.at, x.who, x.where, x.cost, x.due ? `rebook ${said(x.due)}` : ''].filter(Boolean).join(' · ')}</Meta>
      {x.used && <span className="mt-2 block text-[10px] uppercase tracking-[0.16em] text-stone-400">{x.used}</span>}
    </Row>
  )

  return (
    <Page kicker="Skin" title="The chair"
      intro="Facials, peels, lasers — who did it, what they used, what it cost, and when it is due again. One entry writes twice: the appointment, and the rebooking.">
      <Band count={ahead.length || null}>Coming</Band>
      {ahead.length ? ahead.map((x, i) => line(x, !i)) : <Empty>Nothing booked.</Empty>}
      {past.length > 0 && (<><Band count={past.length}>Been</Band>{past.map((x, i) => line(x, !i))}</>)}

      <Plus onClick={() => setAdding(true)} label="Add an appointment" />
      <Starters options={SERVICE_STARTERS} has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, who: '', where: '', on: '', at: '', cost: '', used: '', due: '', notes: '', linked: '', rebook: '' }])} />

      {(adding || open) && (
        <ChairSheet item={open} onClose={() => { setAdding(false); setOpen(null) }}
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

function ChairSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [who, setWho] = useState(item ? item.who || '' : '')
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [on, setOn] = useState(item ? item.on || '' : '')
  const [at, setAt] = useState(item ? item.at || '' : '')
  const [cost, setCost] = useState(item ? item.cost || '' : '')
  const [used, setUsed] = useState(item ? item.used || '' : '')
  const [due, setDue] = useState(item ? item.due || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, who, where, on, at, cost, used, due, notes }) }
  return (
    <Sheet kicker="The chair" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Hydrafacial" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="Who did it" value={who} onChange={setWho} placeholder="the facialist" width="flex-1" onEnter={save} />
        <Field label="What it cost" value={cost} onChange={setCost} placeholder="$240" width="w-[36%]" onEnter={save} />
      </div>
      <Field label="Where" value={where} onChange={setWhere} placeholder="the clinic" width="mt-8" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="At" type="time" value={at} onChange={setAt} width="w-[40%]" />
      </div>
      <Field label="What they used on her" value={used} onChange={setUsed} placeholder="glycolic 30%, led, barrier mask" width="mt-8" onEnter={save} />
      <Field label="Due again" type="date" value={due} onChange={setDue} width="mt-8" />
      <p className="mt-3 text-[13px] italic text-cream/50">The appointment goes on its day; the rebooking goes on the day it is due.</p>
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}
