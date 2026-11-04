import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, longDate } from '../lib/date'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import {
  Page, Band, Row, Name, Meta, Mark, Plus, Empty, Starters, Sheet, Big, Field, Notes, Chips,
  useRequiredName, uid, arr,
} from './shared/Ledger'

export default function Spirituality({ subPage }) {
  if (subPage === 'rituals') return <Rituals />
  if (subPage === 'journal') return <Journal />
  if (subPage === 'sessions') return <Sessions />
  if (subPage === 'tools') return <Tools />
  return <PracticeLog />
}

const said = (k) => (k ? longDate(k) : '')
const today = () => dateKey(new Date())
const mins = (v) => String(v || '').replace(/[^\d]/g, '')

// ── 1 · The practice log ───────────────────────────────────────────
const PRACTICE_STARTERS = ['morning prayer', 'evening prayer', 'meditation', 'scripture', 'a psalm',
  'the examen', 'gratitude', 'breathwork', 'the rosary', 'silence', 'journalling', 'worship', 'fasting', 'sabbath']

function PracticeLog() {
  const [raw, setRaw] = useLocalStorage('mos:spirit:log', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const week = all.filter((x) => x.on && x.on > dateKey(new Date(Date.now() - 7 * 86400000)))
  const total = week.reduce((n, x) => n + (Number(x.minutes) || 0), 0)

  return (
    <Page
      kicker="Spirit"
      title="The practice"
      intro="What she did, and how long she sat with it. Not to score it — so that a thin week is visible before it becomes a thin month."
    >
      {total > 0 && (
        <p className="-mt-6 mb-10 text-[10px] uppercase tracking-[0.16em] text-stone-500">
          {`Seven days · ${Math.floor(total / 60) ? `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}` : `${total} min`}`}
        </p>
      )}
      {all.length ? all.map((x, i) => (
        <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
          <Name>{x.name}</Name>
          <Meta>{[said(x.on), x.minutes ? `${x.minutes} min` : ''].filter(Boolean).join(' · ')}</Meta>
        </Row>
      )) : <Empty>Nothing logged yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Log a practice" />
      <Starters
        label="Log one from today"
        options={PRACTICE_STARTERS}
        has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, on: today(), minutes: '', notes: '' }])}
      />

      {(adding || open) && (
        <LogSheet
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

function LogSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [minutes, setMinutes] = useState(item ? String(item.minutes || '') : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, on, minutes: mins(minutes), notes }) }
  return (
    <Sheet kicker="The practice" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Morning prayer" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="How long" value={minutes} onChange={setMinutes} placeholder="20" width="w-[34%]" onEnter={save} />
      </div>
      <Notes value={notes} onChange={setNotes} label="What came of it" />
    </Sheet>
  )
}

// ── 2 · The ritual calendar ────────────────────────────────────────
//
// The practices that repeat, and the dates that come round — the sabbath, the
// new moon, a fast, a feast. Putting one on the calendar puts it on her day.
const OFTEN = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'once', label: 'Just once' },
]
const oftenLabel = (id) => (OFTEN.find((o) => o.id === id) || {}).label || ''
const RITUAL_STARTERS = ['sabbath', 'new moon', 'full moon', 'a fast day', 'weekly confession',
  'monthly retreat', 'sunday service', 'morning office', 'evening office']

function Rituals() {
  const [raw, setRaw] = useLocalStorage('mos:spirit:rituals', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const drop = (x) => { if (x.linked) remove(x.linked); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }

  const onDay = (x) => {
    let linked = x.linked || ''
    if (linked) remove(linked)
    const made = add(blankActivity('protocol', {
      title: x.name, category: 'spirituality',
      frequency: x.often === 'once' ? 'once' : x.often,
      seriesStart: x.on || today(),
      timeOfDay: [x.half === 'pm' ? 'evening' : 'morning'],
      details: { block: x.half === 'pm' ? 'evening' : 'morning' },
    }))
    linked = made.id
    setRaw((p) => arr(p).map((y) => (y.id === x.id ? { ...y, linked } : y)))
  }

  return (
    <Page
      kicker="Spirit"
      title="The calendar"
      intro="What comes round — the sabbath, the office, a fast, a feast. Putting one on the day puts it in the routine."
    >
      {all.length ? all.map((x, i) => (
        <Row
          key={x.id}
          first={!i}
          onOpen={() => setOpen(x)}
          onAway={() => drop(x)}
          aside={<Mark on={!!x.linked} onClick={() => (x.linked ? (remove(x.linked), setRaw((p) => arr(p).map((y) => (y.id === x.id ? { ...y, linked: '' } : y)))) : onDay(x))} label={`Put ${x.name} on the day`}>{x.linked ? 'On the day' : 'Add to day'}</Mark>}
        >
          <Name>{x.name}</Name>
          <Meta>{[oftenLabel(x.often), x.on ? said(x.on) : '', x.half === 'pm' ? 'Evening' : 'Morning'].filter(Boolean).join(' · ')}</Meta>
        </Row>
      )) : <Empty>Nothing that repeats yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Add a ritual" />
      <Starters
        options={RITUAL_STARTERS}
        has={(o) => all.some((x) => x.name === o)}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, often: 'weekly', half: 'am', on: today(), notes: '', linked: '' }])}
      />

      {(adding || open) && (
        <RitualSheet
          item={open}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid(), linked: '' }])
            setAdding(false); setOpen(null)
          }}
        />
      )}
    </Page>
  )
}

function RitualSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [often, setOften] = useState(item ? item.often || 'weekly' : 'weekly')
  const [half, setHalf] = useState(item ? item.half || 'am' : 'am')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, often, half, on, notes }) }
  return (
    <Sheet kicker="The calendar" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Sabbath" onEnter={save} />
      <Chips label="How often" options={OFTEN} value={often} onChange={setOften} />
      <Chips label="Which half of the day" options={[{ id: 'am', label: 'Morning' }, { id: 'pm', label: 'Evening' }]} value={half} onChange={setHalf} />
      <Field label="Starting" type="date" value={on} onChange={setOn} width="mt-8" />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── 3 · The journal ────────────────────────────────────────────────
function Journal() {
  const [raw, setRaw] = useLocalStorage('mos:spirit:journal', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  return (
    <Page kicker="Spirit" title="The journal" intro="Reflections, and the things that only arrive when you sit still long enough.">
      {all.length ? all.map((x, i) => (
        <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
          <Name>{x.name}</Name>
          <Meta>{said(x.on)}</Meta>
          {x.notes && <span className="mt-3 block max-w-xl text-[15px] leading-relaxed text-stone-500 line-clamp-2">{x.notes}</span>}
        </Row>
      )) : <Empty>Nothing written yet.</Empty>}
      <Plus onClick={() => setAdding(true)} label="Write an entry" />
      {(adding || open) && (
        <JournalSheet
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

function JournalSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [on, setOn] = useState(item ? item.on || today() : today())
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, on, notes }) }
  return (
    <Sheet kicker="The journal" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="What came up this morning" onEnter={save} />
      <Field label="When" type="date" value={on} onChange={setOn} width="mt-8" />
      <Notes value={notes} onChange={setNotes} label="The entry" placeholder="Write it as it comes." />
    </Sheet>
  )
}

// ── 4 · Sessions ───────────────────────────────────────────────────
//
// Booked and been are the same thing at two moments, so they are one page
// with two bands rather than two pages that would each be half empty.
const BOOKING = [
  { id: 'looking', label: 'Looking into it' },
  { id: 'booked', label: 'Booked' },
  { id: 'paid', label: 'Paid' },
  { id: 'been', label: 'Been' },
]
const bookLabel = (id) => (BOOKING.find((b) => b.id === id) || {}).label || ''
const SESSION_STARTERS = ['sound bath', 'energy healing', 'reiki', 'acupuncture', 'breathwork session',
  'retreat', 'workshop', 'spiritual direction', 'confession', 'astrology reading', 'human design reading', 'kinesiology']

function Sessions() {
  const [raw, setRaw] = useLocalStorage('mos:spirit:sessions', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const k = today()
  const ahead = all.filter((x) => x.status !== 'been' && (!x.on || x.on >= k)).sort((a, b) => (a.on || '9').localeCompare(b.on || '9'))
  const been = all.filter((x) => x.status === 'been' || (x.on && x.on < k)).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (x) => { if (x.linked) remove(x.linked); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }

  const sync = (x) => {
    let linked = x.linked || ''
    if ((x.status === 'booked' || x.status === 'paid') && x.on) {
      if (linked) remove(linked)
      const made = add(blankActivity('event', {
        title: x.name, category: 'spirituality', frequency: 'once', seriesStart: x.on,
        details: { time: x.at || '', endTime: '', partOfDay: 'afternoon', description: x.where || '', attendees: x.who || '', durationMinutes: '' },
      }))
      linked = made.id
    } else if (linked) { remove(linked); linked = '' }
    return linked
  }

  const line = (x, first) => (
    <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x)}>
      <Name>{x.name}</Name>
      <Meta>{[said(x.on), x.at, x.who, x.where, x.cost, bookLabel(x.status)].filter(Boolean).join(' · ')}</Meta>
      {x.notes && x.status === 'been' && <span className="mt-3 block max-w-xl text-[15px] leading-relaxed text-stone-500 line-clamp-2">{x.notes}</span>}
    </Row>
  )

  return (
    <Page
      kicker="Spirit"
      title="Sessions"
      intro="Sound baths, acupuncture, a retreat — who with, where, what it cost, and whether it is actually booked. Booked and dated puts it on the day."
    >
      <Band count={ahead.length || null}>Ahead</Band>
      {ahead.length ? ahead.map((x, i) => line(x, !i)) : <Empty>Nothing booked.</Empty>}
      {been.length > 0 && (<><Band count={been.length}>Been</Band>{been.map((x, i) => line(x, !i))}</>)}

      <Plus onClick={() => setAdding(true)} label="Add a session" />
      <Starters
        options={SESSION_STARTERS}
        has={() => false}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, who: '', where: '', on: '', at: '', cost: '', status: 'looking', notes: '', linked: '' }])}
      />

      {(adding || open) && (
        <SessionSheet
          item={open}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open); setOpen(null) } : null}
          onSave={(d) => {
            const base = open ? { ...open, ...d } : { ...d, id: uid(), linked: '' }
            const linked = sync(base)
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...base, linked } : x)))
            else setRaw((p) => [...arr(p), { ...base, linked }])
            setAdding(false); setOpen(null)
          }}
        />
      )}
    </Page>
  )
}

function SessionSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [who, setWho] = useState(item ? item.who || '' : '')
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [on, setOn] = useState(item ? item.on || '' : '')
  const [at, setAt] = useState(item ? item.at || '' : '')
  const [cost, setCost] = useState(item ? item.cost || '' : '')
  const [status, setStatus] = useState(item ? item.status || 'looking' : 'looking')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, who, where, on, at, cost, status, notes }) }
  return (
    <Sheet kicker="A session" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Sound bath" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="With" value={who} onChange={setWho} placeholder="practitioner" width="flex-1" onEnter={save} />
        <Field label="What it costs" value={cost} onChange={setCost} placeholder="$45" width="w-[36%]" onEnter={save} />
      </div>
      <Field label="Where" value={where} onChange={setWhere} placeholder="the studio in hackney" width="mt-8" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="At" type="time" value={at} onChange={setAt} width="w-[40%]" />
      </div>
      <Chips label="Where it stands" options={BOOKING} value={status} onChange={setStatus} />
      <p className="mt-3 text-[13px] italic text-cream/50">Booked or paid, with a date, puts it on the day.</p>
      <Notes value={notes} onChange={setNotes} label="Notes from it" />
    </Sheet>
  )
}

// ── 5 · The tools ──────────────────────────────────────────────────
const KINDS = [
  { id: 'crystal', label: 'Crystal' },
  { id: 'oil', label: 'Oil' },
  { id: 'candle', label: 'Candle' },
  { id: 'cards', label: 'Cards' },
  { id: 'bowl', label: 'Sound' },
  { id: 'other', label: 'Other' },
]
const kindLabel = (id) => (KINDS.find((k) => k.id === id) || {}).label || ''
const TOOL_STARTERS = ['rose quartz', 'amethyst', 'clear quartz', 'selenite', 'black tourmaline',
  'palo santo', 'white sage', 'frankincense oil', 'lavender oil', 'tarot deck', 'oracle deck',
  'singing bowl', 'tuning fork', 'beeswax candle', 'mala beads']

function Tools() {
  const [raw, setRaw] = useLocalStorage('mos:spirit:tools', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const cleanse = (id) => setRaw((p) => arr(p).map((x) => (x.id === id ? { ...x, cleansed: today() } : x)))
  const stale = (x) => x.cleansed && (Date.now() - new Date(`${x.cleansed}T12:00:00`).getTime()) / 86400000 > 60

  return (
    <Page
      kicker="Spirit"
      title="The tools"
      intro="The crystals, the oils, the cards, the bowl — what each one is for, and the last time it was cleansed."
    >
      {all.length ? all.map((x, i) => (
        <Row
          key={x.id}
          first={!i}
          onOpen={() => setOpen(x)}
          onAway={() => drop(x.id)}
          aside={<Mark on={false} onClick={() => cleanse(x.id)} label={`Cleansed ${x.name} today`}>Cleansed</Mark>}
        >
          <Name>{x.name}</Name>
          <Meta>{[kindLabel(x.kind), x.purpose, x.cleansed ? `cleansed ${said(x.cleansed)}` : 'never cleansed', stale(x) ? 'a while ago' : ''].filter(Boolean).join(' · ')}</Meta>
        </Row>
      )) : <Empty>Nothing on the altar yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Add a tool" />
      <Starters
        options={TOOL_STARTERS}
        has={(o) => all.some((x) => x.name === o)}
        onPick={(o) => setRaw((p) => [...arr(p), { id: uid(), name: o, kind: 'crystal', purpose: '', cleansed: '', notes: '' }])}
      />

      {(adding || open) && (
        <ToolSheet
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

function ToolSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [kind, setKind] = useState(item ? item.kind || 'crystal' : 'crystal')
  const [purpose, setPurpose] = useState(item ? item.purpose || '' : '')
  const [cleansed, setCleansed] = useState(item ? item.cleansed || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, kind, purpose, cleansed, notes }) }
  return (
    <Sheet kicker="The tools" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Rose quartz" onEnter={save} />
      <Chips label="What it is" options={KINDS} value={kind} onChange={setKind} />
      <Field label="What it is for" value={purpose} onChange={setPurpose} placeholder="the heart, and softening" width="mt-8" onEnter={save} />
      <Field label="Last cleansed" type="date" value={cleansed} onChange={setCleansed} width="mt-8" />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}
