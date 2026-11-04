import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import {
  Page, Band, Row, Name, Meta, Mark, Plus, Empty, Starters, Sheet, Big, Field, Notes, Chips,
  useRequiredName, uid, arr,
} from './shared/Ledger'

// ── The body, cared for.
//
// What stood here was a second gym: sessions, programmes, equipment, a plan —
// all of it already on the day under Workouts, and none of it ever filled in.
// The body does ask for something daily that nothing else covers, and it is
// not training. It is the brush before the shower, the scrub twice a week,
// the oil on damp skin, the SPF nobody puts below the jaw.

const WHEN = [
  { id: 'morning', label: 'Morning' },
  { id: 'evening', label: 'Evening' },
  { id: 'either', label: 'Either' },
]
const OFTEN = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Once a week' },
  { id: '2x', label: 'Twice a week' },
  { id: 'fortnightly', label: 'Fortnightly' },
  { id: 'asneeded', label: 'When it is wanted' },
]
const label = (set, id) => (set.find((x) => x.id === id) || {}).label || ''
const ORDER = { morning: 0, either: 1, evening: 2 }

// One press each, already filled in. She can open any of them afterwards.
const STARTERS = [
  { name: 'dry brushing', when: 'morning', often: 'daily' },
  { name: 'body exfoliation', when: 'evening', often: '2x' },
  { name: 'body oil on damp skin', when: 'evening', often: 'daily' },
  { name: 'body serum', when: 'evening', often: 'daily' },
  { name: 'body spf', when: 'morning', often: 'daily' },
  { name: 'body lotion', when: 'evening', often: 'daily' },
  { name: 'hands and cuticle oil', when: 'evening', often: 'daily' },
  { name: 'feet, then socks', when: 'evening', often: 'daily' },
  { name: 'deodorant', when: 'morning', often: 'daily' },
  { name: 'neck and chest cream', when: 'evening', often: 'daily' },
  { name: 'in-shower scrub', when: 'morning', often: '2x' },
  { name: 'self tan', when: 'evening', often: 'weekly' },
  { name: 'magnesium oil on the legs', when: 'evening', often: 'daily' },
  { name: 'gua sha the body', when: 'evening', often: 'weekly' },
  { name: 'back and shoulders', when: 'evening', often: 'weekly' },
]

export default function Fitness() {
  const [raw, setRaw] = useLocalStorage('mos:body:routine', [])
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const key = dateKey(new Date())
  const all = arr(raw).sort((a, b) => ((ORDER[a.when] ?? 1) - (ORDER[b.when] ?? 1)) || (a.order || 0) - (b.order || 0))
  const drop = (id) => setRaw((p) => arr(p).filter((x) => x.id !== id))
  const done = (x) => !!(x.completions && x.completions[key])
  const keep = (id) => setRaw((p) => arr(p).map((x) => {
    if (x.id !== id) return x
    const c = { ...(x.completions || {}) }
    if (c[key]) delete c[key]; else c[key] = true
    return { ...x, completions: c }
  }))

  return (
    <Page
      kicker="Bodycare"
      title="The body"
      intro="Everything from the neck down that is not training. The brush, the scrub, the oil, the SPF — in the order it is done, ticked as it is done."
    >
      {all.length ? all.map((x, i) => {
        const kept = done(x)
        return (
          <Row
            key={x.id}
            first={!i}
            onOpen={() => setOpen(x)}
            onAway={() => drop(x.id)}
            aside={<Mark on={kept} onClick={() => keep(x.id)} label={`${kept ? 'Kept' : 'Keep'} ${x.name}`}>{kept ? 'Kept' : 'Keep'}</Mark>}
          >
            <Name struck={kept}>{x.name}</Name>
            <Meta>{[label(WHEN, x.when), label(OFTEN, x.often), x.product].filter(Boolean).join(' · ')}</Meta>
          </Row>
        )
      }) : (
        <Empty>Dry brushing, exfoliation, body serum, body SPF — the ones most often skipped.</Empty>
      )}

      <Plus onClick={() => setAdding(true)} label="Add a step" />

      <Starters
        options={STARTERS}
        has={(o) => all.some((x) => x.name === o.name)}
        onPick={(o) => setRaw((p) => [...arr(p), { ...o, id: uid(), product: '', notes: '', order: arr(p).length, completions: {} }])}
      />

      {(adding || open) && (
        <StepSheet
          item={open}
          onClose={() => { setAdding(false); setOpen(null) }}
          onDrop={open ? () => { drop(open.id); setOpen(null) } : null}
          onSave={(d) => {
            if (open) setRaw((p) => arr(p).map((x) => (x.id === open.id ? { ...x, ...d } : x)))
            else setRaw((p) => [...arr(p), { ...d, id: uid(), order: arr(raw).length, completions: {} }])
            setAdding(false); setOpen(null)
          }}
        />
      )}
    </Page>
  )
}

function StepSheet({ item, onSave, onDrop, onClose }) {
  const { name, setName, field, ready } = useRequiredName(item ? item.name : '')
  const [product, setProduct] = useState(item ? item.product || '' : '')
  const [when, setWhen] = useState(item ? item.when || 'morning' : 'morning')
  const [often, setOften] = useState(item ? item.often || 'daily' : 'daily')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const save = () => { const t = ready(); if (t) onSave({ name: t, product, when, often, notes }) }

  return (
    <Sheet kicker="The body" onClose={onClose} onDrop={onDrop} onSave={save} saveLabel={item ? 'Save' : 'Add'}>
      <Big ref={field} value={name} onChange={setName} placeholder="Dry brushing" onEnter={save} />
      <Field label="What she uses" value={product} onChange={setProduct} placeholder="the boar bristle brush" width="mt-8" onEnter={save} />
      <Chips label="When" options={WHEN} value={when} onChange={setWhen} />
      <Chips label="How often" options={OFTEN} value={often} onChange={setOften} />
      <Notes value={notes} onChange={setNotes} />
    </Sheet>
  )
}
