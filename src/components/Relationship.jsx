import React, { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { parseKey, longDate, dateKey } from '../lib/date'
import SectionTitle from './shared/SectionTitle'
import CategorySchedule from './shared/CategorySchedule'
import { useRegisterAdd } from './shared/AddButton'

const uid = () => Math.random().toString(36).slice(2, 10)

const focusAdd = (ref) => {
  const el = ref.current && ref.current.querySelector('input[placeholder], textarea[placeholder]')
  if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
}

export default function Relationship({ subPage, cycleConfig }) {
  if (subPage === 'circle') return <Circle />
  if (subPage === 'overview') return <RelationshipOverview />
  return <CategorySchedule category="relationship" noun="Plan" cycleConfig={cycleConfig} />
}

// ── My Circle — the people you hold, and how warm the thread is. Every person
// carries a cadence; when too long passes, the card quietly asks for them.
const KINDS = [
  { id: 'romantic', label: 'Romantic', tint: '#B07A9A' },
  { id: 'friend', label: 'Friend', tint: '#889072' },
  { id: 'family', label: 'Family', tint: '#B08D45' },
  { id: 'mentor', label: 'Mentor', tint: '#5A6B7B' },
]
const CADENCES = [
  { id: 7, label: 'Weekly' },
  { id: 14, label: 'Every 2 weeks' },
  { id: 30, label: 'Monthly' },
  { id: 90, label: 'Seasonally' },
]
const kindMeta = (id) => KINDS.find((k) => k.id === id) || KINDS[1]

function Circle() {
  const [stored, setPeople] = useLocalStorage('mos:rel:circle', [])
  const people = Array.isArray(stored) ? stored : []
  const [openId, setOpenId] = useState(null)
  const todayK = dateKey(new Date())
  const daysSince = (k) => (k ? Math.round((new Date(todayK) - new Date(k)) / 86400000) : null)

  const add = () => { const p = { id: uid(), name: '', kind: 'friend', cadence: 14, lastTouch: '', notes: '' }; setPeople((prev) => [...(Array.isArray(prev) ? prev : []), p]); setOpenId(p.id) }
  const update = (id, patch) => setPeople((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const remove = (id) => { setPeople((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id)); setOpenId(null) }
  const touch = (id) => update(id, { lastTouch: todayK })

  // Warmest obligations first: overdue by the most days.
  const scored = [...people].map((p) => {
    const ds = daysSince(p.lastTouch)
    const overdue = ds == null ? true : ds >= (p.cadence || 14)
    return { p, ds, overdue }
  }).sort((a, b) => (b.overdue - a.overdue) || ((b.ds ?? 999) - (a.ds ?? 999)))
  const open = people.find((x) => x.id === openId) || null
  const dueCount = scored.filter((x) => x.overdue).length

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-7 flex items-end justify-between">
        <p className="max-w-sm text-sm italic leading-relaxed text-stone-400">
          {people.length === 0 ? 'The people you hold — and how warm each thread is.' : dueCount ? `${dueCount} ${dueCount === 1 ? 'person is' : 'people are'} waiting to hear from you.` : 'Every thread is warm. Well held.'}
        </p>
        <button onClick={add} className="shrink-0 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream hover:bg-stone-700">Add someone</button>
      </div>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-200 py-14 text-center font-serif italic text-lg text-stone-400">No one in the circle yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {scored.map(({ p, ds, overdue }) => {
            const K = kindMeta(p.kind)
            return (
              <div key={p.id} className={`rounded-2xl border bg-white/50 p-5 transition-all ${overdue ? 'border-stone-300' : 'border-stone-200'}`}>
                <button onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-3 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-lg" style={{ background: `${K.tint}22`, color: K.tint }}>{(p.name || '?').charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-lg leading-tight text-stone-900">{p.name || 'Unnamed'}</span>
                    <span className="text-xs text-stone-400">{K.label} · {(CADENCES.find((c) => c.id === p.cadence) || {}).label || 'Every 2 weeks'}</span>
                  </span>
                </button>
                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className={`text-xs ${overdue ? 'text-phase-menstrual' : 'text-stone-400'}`}>
                    {ds == null ? 'Never logged' : ds === 0 ? 'Touched today' : `${ds}d since you connected`}
                  </span>
                  <button onClick={() => touch(p.id)} className="rounded-full border border-stone-300 px-3.5 py-1 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">We connected</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setOpenId(null)} />
          <div className="relative w-full max-w-md rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
            <div className="space-y-5 px-6 pb-2 pt-6">
              <input autoFocus value={open.name} onChange={(e) => update(open.id, { name: e.target.value })} placeholder="Their name" className="w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-2xl text-stone-900 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-900" />
              <div>
                <p className="kicker mb-2 text-stone-400">Who they are to you</p>
                <div className="flex flex-wrap gap-1.5">
                  {KINDS.map((k) => <button key={k.id} onClick={() => update(open.id, { kind: k.id })} className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${open.kind === k.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}><span className="h-2 w-2 rounded-full" style={{ background: k.tint }} />{k.label}</button>)}
                </div>
              </div>
              <div>
                <p className="kicker mb-2 text-stone-400">How often you want to connect</p>
                <div className="flex flex-wrap gap-1.5">
                  {CADENCES.map((c) => <button key={c.id} onClick={() => update(open.id, { cadence: c.id })} className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${open.cadence === c.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{c.label}</button>)}
                </div>
              </div>
              <div>
                <p className="kicker mb-1.5 text-stone-400">Notes</p>
                <input value={open.notes || ''} onChange={(e) => update(open.id, { notes: e.target.value })} placeholder="What matters — dates, loves, what to remember" className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900" />
              </div>
            </div>
            <div className="flex items-center justify-between px-6 pb-6 pt-4">
              <button onClick={() => remove(open.id)} className="text-xs text-stone-400 hover:text-phase-menstrual">Remove</button>
              <button onClick={() => setOpenId(null)} className="rounded-full bg-stone-900 px-8 py-2.5 text-sm text-cream hover:bg-stone-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RelationshipOverview() {
  const rootRef = useRef(null)
  const [data, setData] = useLocalStorage('mos:rel', {
    anniversary: '',
    dateNights: [],
    ideas: [],
    habits: [],
  })
  useRegisterAdd(() => focusAdd(rootRef), [])

  const daysUntilAnniversary = (() => {
    if (!data.anniversary) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const ann = parseKey(data.anniversary)
    const next = new Date(today.getFullYear(), ann.getMonth(), ann.getDate())
    if (next < today) next.setFullYear(today.getFullYear() + 1)
    return Math.round((next - today) / 86400000)
  })()

  return (
    <div ref={rootRef}>
      <SectionTitle kicker="03 · The two of us" title="Relationships." />

      {/* Anniversary */}
      <section className="mb-12 flex flex-wrap items-end gap-8 border border-stone-200 bg-white/40 px-5 py-4">
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Anniversary</label>
          <input
            type="date"
            value={data.anniversary}
            onChange={(e) => setData((d) => ({ ...d, anniversary: e.target.value }))}
            className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
          />
        </div>
        {daysUntilAnniversary != null && (
          <div>
            <p className="kicker text-stone-400 mb-1">Countdown</p>
            <p className="font-serif italic text-3xl text-stone-900">
              {daysUntilAnniversary === 0 ? 'Today' : `${daysUntilAnniversary} days`}
            </p>
          </div>
        )}
      </section>

      {/* Ideas */}
      <SimpleList
        title="Date night ideas."
        placeholder="Somewhere worth dressing for"
        items={data.ideas}
        onAdd={(text) => setData((d) => ({ ...d, ideas: [...d.ideas, { id: uid(), text }] }))}
        onRemove={(id) => setData((d) => ({ ...d, ideas: d.ideas.filter((x) => x.id !== id) }))}
      />

      {/* Habits with confirm toggle */}
      <section className="mt-12">
        <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-4">Daily habits.</h2>
        <HabitInput onAdd={(text) => setData((d) => ({ ...d, habits: [...d.habits, { id: uid(), text, confirm: false }] }))} />
        <div className="divide-y divide-stone-100">
          {data.habits.map((h) => (
            <div key={h.id} className="group flex items-center gap-3 py-2.5">
              <span className="flex-1 text-sm text-stone-800">{h.text}</span>
              <button
                onClick={() =>
                  setData((d) => ({ ...d, habits: d.habits.map((x) => (x.id === h.id ? { ...x, confirm: !x.confirm } : x)) }))
                }
                className={`rounded-full px-3.5 py-1.5 text-xs border transition-colors ${
                  h.confirm ? 'bg-mauve text-white border-mauve' : 'border-stone-300 text-stone-500 hover:border-stone-500'
                }`}
              >
                Confirm w/ Tariq
              </button>
              <button
                onClick={() => setData((d) => ({ ...d, habits: d.habits.filter((x) => x.id !== h.id) }))}
                className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SimpleList({ title, placeholder, items, onAdd, onRemove }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }
  return (
    <section>
      <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-4">{title}</h2>
      <div className="mb-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
      </div>
      <div className="divide-y divide-stone-100">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-3 py-2.5">
            <span className="flex-1 text-sm text-stone-800">{it.text}</span>
            <button onClick={() => onRemove(it.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function HabitInput({ onAdd }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }
  return (
    <div className="mb-4 flex items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        placeholder="Something we hold to"
        className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
      />
    </div>
  )
}
