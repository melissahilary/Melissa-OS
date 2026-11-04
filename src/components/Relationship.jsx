import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, longDate } from '../lib/date'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import {
  Page, Band, Row, Name, Meta, Mark, Plus, Empty, Sheet, Big, Field, Notes, Chips,
  useRequiredName, uid, arr,
} from './shared/Ledger'

// ── Relationships.
//
// Not a CRM. A person is not a record with a cadence and a last-contacted
// date — that was the old page and it read like sales software. What she
// actually keeps is four things: the nights out she means to have, what was
// given and what was received, where she is expected, and what was said.

export default function Relationship({ subPage }) {
  if (subPage === 'gifts') return <Gifts />
  if (subPage === 'social') return <Social />
  if (subPage === 'journal') return <Journal />
  return <DateNights />
}

const said = (k) => (k ? longDate(k) : '')

// ── Date nights ────────────────────────────────────────────────────
//
// Two halves of one page: the ideas, which have no date and are the point of
// keeping the page at all, and the ones that are actually in the diary.
function DateNights() {
  const [raw, setRaw] = useLocalStorage('mos:rel:dates', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const ideas = all.filter((x) => !x.on)
  const booked = all.filter((x) => x.on).sort((a, b) => (a.on || '').localeCompare(b.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))

  const line = (x, first) => (
    <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
      <Name>{x.name}</Name>
      <Meta>{[said(x.on), x.at, x.who, x.where].filter(Boolean).join(' · ')}</Meta>
    </Row>
  )

  return (
    <Page
      kicker="Relationships"
      title="Date nights"
      intro="The ones you mean to have, and the ones that are actually in the diary. Giving an idea a date books it."
    >
      <Band count={booked.length || null}>In the diary</Band>
      {booked.length ? booked.map((x, i) => line(x, !i)) : <Empty>Nothing booked yet.</Empty>}

      <Band count={ideas.length || null}>Ideas</Band>
      {ideas.length ? ideas.map((x, i) => line(x, !i)) : <Empty>Somewhere you have been meaning to go.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Add a date night" />

      {(adding || open) && (
        <DateSheet
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

function DateSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [who, setWho] = useState(item ? item.who || '' : '')
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [on, setOn] = useState(item ? item.on || '' : '')
  const [at, setAt] = useState(item ? item.at || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, who, where, on, at, notes }) }

  return (
    <Sheet kicker="Date night" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Dinner at the little Italian" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="With" value={who} onChange={setWho} placeholder="tariq" width="flex-1" onEnter={save} />
        <Field label="Where" value={where} onChange={setWhere} placeholder="the place on the corner" width="flex-1" onEnter={save} />
      </div>
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="At" type="time" value={at} onChange={setAt} width="w-[40%]" />
      </div>
      <p className="mt-3 text-[13px] italic text-cream/50">Leave the date empty and it stays an idea.</p>
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── Gifts ──────────────────────────────────────────────────────────
function Gifts() {
  const [raw, setRaw] = useLocalStorage('mos:rel:gifts', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const given = all.filter((x) => x.way !== 'received').sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const got = all.filter((x) => x.way === 'received').sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const thank = (id) => setRaw((p) => arr(p).map((x) => (x.id === id ? { ...x, thanked: !x.thanked } : x)))

  const line = (x, first, owed) => (
    <Row
      key={x.id}
      first={first}
      onOpen={() => setOpen(x)}
      onAway={() => drop(x.id)}
      aside={owed ? (
        <Mark on={!!x.thanked} onClick={() => thank(x.id)} label={`Thank you for ${x.name}`}>
          {x.thanked ? 'Thanked' : 'Thank'}
        </Mark>
      ) : null}
    >
      <Name>{x.name}</Name>
      <Meta>{[x.who, said(x.on), x.occasion, x.cost].filter(Boolean).join(' · ')}</Meta>
    </Row>
  )

  const owing = got.filter((x) => !x.thanked).length

  return (
    <Page
      kicker="Relationships"
      title="Gifts"
      intro="What was given and what was received — what it cost, what it was for, and whether the thank you has gone."
    >
      <Band count={got.length ? `${owing} to thank` : null}>Received</Band>
      {got.length ? got.map((x, i) => line(x, !i, true)) : <Empty>Nothing yet.</Empty>}

      <Band count={given.length || null}>Given</Band>
      {given.length ? given.map((x, i) => line(x, !i, false)) : <Empty>Nothing yet.</Empty>}

      <Plus onClick={() => setAdding(true)} label="Add a gift" />

      {(adding || open) && (
        <GiftSheet
          item={open}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid(), thanked: false }])
            setAdding(false); setOpen(null)
          }}
        />
      )}
    </Page>
  )
}

const WAYS = [{ id: 'given', label: 'Given' }, { id: 'received', label: 'Received' }]

function GiftSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [way, setWay] = useState(item ? item.way || 'given' : 'given')
  const [who, setWho] = useState(item ? item.who || '' : '')
  const [on, setOn] = useState(item ? item.on || dateKey(new Date()) : dateKey(new Date()))
  const [cost, setCost] = useState(item ? item.cost || '' : '')
  const [occasion, setOccasion] = useState(item ? item.occasion || '' : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, way, who, on, cost, occasion, notes }) }

  return (
    <Sheet kicker="Gift" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="The silk scarf" onEnter={save} />
      <Chips label="Which way" options={WAYS} value={way} onChange={setWay} />
      <div className="mt-8 flex items-end gap-6">
        <Field label={way === 'received' ? 'From' : 'For'} value={who} onChange={setWho} placeholder="a name" width="flex-1" onEnter={save} />
        <Field label="What it cost" value={cost} onChange={setCost} placeholder="£120" width="w-[38%]" onEnter={save} />
      </div>
      <div className="mt-8 flex items-end gap-6">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="The occasion" value={occasion} onChange={setOccasion} placeholder="birthday" width="flex-1" onEnter={save} />
      </div>
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── Social ─────────────────────────────────────────────────────────
//
// The one page here that writes on the day. An invitation she has said yes to
// is not a note about a party, it is two hours of a Thursday, so saying yes
// puts it on the schedule and saying no takes it off again.
const RSVPS = [
  { id: 'yes', label: 'Going' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'no', label: "Can't" },
  { id: 'asked', label: 'Asked' },
]
const rsvpLabel = (id) => (RSVPS.find((r) => r.id === id) || {}).label || ''

function Social() {
  const [raw, setRaw] = useLocalStorage('mos:rel:social', [])
  const { add, remove } = useActivities()
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw)
  const todayK = dateKey(new Date())
  const ahead = all.filter((x) => !x.on || x.on >= todayK).sort((a, b) => (a.on || '9').localeCompare(b.on || '9'))
  const past = all.filter((x) => x.on && x.on < todayK).sort((a, b) => (b.on || '').localeCompare(a.on || ''))

  // Going → it is on the day. Anything else → it is not.
  const sync = (x) => {
    let linked = x.linked || ''
    if (x.rsvp === 'yes' && x.on) {
      if (linked) remove(linked)
      const made = add(blankActivity('event', {
        title: x.name, category: 'personal', frequency: 'once', seriesStart: x.on,
        details: { time: x.at || '', endTime: x.until || '', partOfDay: 'evening', description: x.where || '', attendees: '', durationMinutes: '' },
      }))
      linked = made.id
    } else if (linked) {
      remove(linked)
      linked = ''
    }
    return linked
  }

  const drop = (x) => { if (x.linked) remove(x.linked); setRaw((p) => arr(p).filter((y) => y.id !== x.id)) }

  const line = (x, first) => (
    <Row key={x.id} first={first} onOpen={() => setOpen(x)} onAway={() => drop(x)}>
      <Name>{x.name}</Name>
      <Meta>{[said(x.on), x.at, x.where, rsvpLabel(x.rsvp)].filter(Boolean).join(' · ')}</Meta>
    </Row>
  )

  return (
    <Page
      kicker="Relationships"
      title="Social"
      intro="Dinners, launches, weddings, the things you have been asked to. Say you are going and it goes on the day."
    >
      <Band count={ahead.length || null}>Ahead</Band>
      {ahead.length ? ahead.map((x, i) => line(x, !i)) : <Empty>Nothing in the diary.</Empty>}

      {past.length > 0 && (
        <>
          <Band count={past.length}>Been</Band>
          {past.map((x, i) => line(x, !i))}
        </>
      )}

      <Plus onClick={() => setAdding(true)} label="Add something social" />

      {(adding || open) && (
        <SocialSheet
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

function SocialSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [where, setWhere] = useState(item ? item.where || '' : '')
  const [on, setOn] = useState(item ? item.on || '' : '')
  const [at, setAt] = useState(item ? item.at || '' : '')
  const [until, setUntil] = useState(item ? item.until || '' : '')
  const [rsvp, setRsvp] = useState(item ? item.rsvp || 'asked' : 'asked')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, where, on, at, until, rsvp, notes }) }

  return (
    <Sheet kicker="Social" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Cheryl's launch" onEnter={save} />
      <Field label="Where" value={where} onChange={setWhere} placeholder="the gallery on bond street" width="mt-8" onEnter={save} />
      <div className="mt-8 flex items-end gap-5">
        <Field label="When" type="date" value={on} onChange={setOn} width="flex-1" />
        <Field label="From" type="time" value={at} onChange={setAt} width="w-[27%]" />
        <Field label="To" type="time" value={until} onChange={setUntil} width="w-[27%]" />
      </div>
      <Chips label="Have you said" options={RSVPS} value={rsvp} onChange={setRsvp} />
      <p className="mt-3 text-[13px] italic text-cream/50">Going, with a date, puts it on the schedule.</p>
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}

// ── Journal ────────────────────────────────────────────────────────
function Journal() {
  const [raw, setRaw] = useLocalStorage('mos:rel:journal', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const all = arr(raw).sort((a, b) => (b.on || '').localeCompare(a.on || ''))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))

  return (
    <Page
      kicker="Relationships"
      title="Journal"
      intro="The conversations worth keeping, and what you thought afterwards."
    >
      {all.length ? all.map((x, i) => (
        <Row key={x.id} first={!i} onOpen={() => setOpen(x)} onAway={() => drop(x.id)}>
          <Name>{x.name}</Name>
          <Meta>{[said(x.on), x.who].filter(Boolean).join(' · ')}</Meta>
          {x.notes && <span className="mt-3 block max-w-xl text-[15px] leading-relaxed text-stone-500 line-clamp-2">{x.notes}</span>}
        </Row>
      )) : <Empty>Nothing written down yet.</Empty>}

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
  const [who, setWho] = useState(item ? item.who || '' : '')
  const [on, setOn] = useState(item ? item.on || dateKey(new Date()) : dateKey(new Date()))
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, who, on, notes }) }

  return (
    <Sheet kicker="Journal" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="The conversation about moving" onEnter={save} />
      <div className="mt-8 flex items-end gap-6">
        <Field label="With" value={who} onChange={setWho} placeholder="a name" width="flex-1" onEnter={save} />
        <Field label="When" type="date" value={on} onChange={setOn} width="w-[45%]" />
      </div>
      <Notes value={notes} onChange={setNotes} label="What was said" placeholder="What happened, and what you thought afterwards." />
    </Sheet>
  )
}
