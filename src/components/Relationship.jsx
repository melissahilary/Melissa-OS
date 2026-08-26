import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, longDate } from '../lib/date'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import CategorySchedule from './shared/CategorySchedule'
import { useRegisterAdd } from './shared/AddButton'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Relationship({ subPage, cycleConfig }) {
  if (subPage === 'circle') return <Circle />
  return <CategorySchedule category="relationship" noun="Plan" cycleConfig={cycleConfig} />
}

// ── My Circle — a private CRM for the people who matter. Every person carries
// the dates you must never miss, the cadence you want, gift ideas as they come
// to you, and one button that puts real time with them on your calendar.
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

// Next occurrence of a MM-DD anniversary-style date, in days from today.
const daysToNext = (isoDate, today) => {
  if (!isoDate) return null
  const [, m, d] = isoDate.split('-').map(Number)
  if (!m || !d) return null
  let next = new Date(today.getFullYear(), m - 1, d)
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (next < t0) next = new Date(today.getFullYear() + 1, m - 1, d)
  return Math.round((next - t0) / 86400000)
}

function Circle() {
  const [stored, setPeople] = useLocalStorage('mos:rel:circle', [])
  const people = Array.isArray(stored) ? stored : []
  const { add: addActivity } = useActivities()
  const [openId, setOpenId] = useState(null)
  const [planFor, setPlanFor] = useState(null)
  const today = new Date()
  const todayK = dateKey(today)
  const daysSince = (k) => (k ? Math.round((new Date(todayK) - new Date(k)) / 86400000) : null)

  const add = () => {
    const p = { id: uid(), name: '', kind: 'friend', cadence: 14, birthday: '', anniversary: '', giftIdeas: '', notes: '', lastTouch: '' }
    setPeople((prev) => [...(Array.isArray(prev) ? prev : []), p])
    setOpenId(p.id)
  }
  useRegisterAdd(add, [])
  const update = (id, patch) => setPeople((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const remove = (id) => { setPeople((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id)); setOpenId(null) }
  const touch = (id) => update(id, { lastTouch: todayK })

  // Coming up — every birthday & anniversary inside 90 days, soonest first.
  const upcoming = people.flatMap((p) => [
    { p, kind: 'Birthday', days: daysToNext(p.birthday, today) },
    { p, kind: 'Anniversary', days: daysToNext(p.anniversary, today) },
  ]).filter((x) => x.days != null && x.days <= 90).sort((a, b) => a.days - b.days)

  const scored = [...people].map((p) => {
    const ds = daysSince(p.lastTouch)
    const overdue = ds == null ? true : ds >= (p.cadence || 14)
    return { p, ds, overdue }
  }).sort((a, b) => (b.overdue - a.overdue) || ((b.ds ?? 999) - (a.ds ?? 999)))
  const open = people.find((x) => x.id === openId) || null
  const dueCount = scored.filter((x) => x.overdue).length

  const planTime = (p, dk, time, title) => {
    const a = blankActivity('event', {
      title: title || `With ${p.name || 'someone'}`,
      category: 'relationship',
      frequency: 'once',
      date: dk,
      time: time || '',
      details: { personId: p.id },
    })
    addActivity(a)
    touch(p.id)
    setPlanFor(null)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-7 flex items-end justify-between">
        <p className="max-w-sm text-sm italic leading-relaxed text-stone-400">
          {people.length === 0 ? 'The people you hold — dates, gifts, and time together.' : dueCount ? `${dueCount} ${dueCount === 1 ? 'person is' : 'people are'} waiting to hear from you.` : 'Every thread is warm. Well held.'}
        </p>
        <button onClick={add} className="shrink-0 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream hover:bg-stone-700">Add someone</button>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-8 rounded-2xl border border-stone-200 bg-white/50 p-5">
          <p className="kicker mb-3 text-stone-400">Coming up</p>
          <div className="space-y-1">
            {upcoming.slice(0, 5).map((u, i) => (
              <div key={i} className="flex items-baseline gap-3">
                <span className="w-14 shrink-0 text-right font-serif text-lg tabular-nums text-stone-900">{u.days === 0 ? 'Today' : `${u.days}d`}</span>
                <span className="flex-1 text-sm text-stone-700">{u.p.name || 'Unnamed'}&rsquo;s {u.kind.toLowerCase()}</span>
                <button onClick={() => setPlanFor({ p: u.p, hint: u.kind })} className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:border-stone-900 hover:bg-stone-900 hover:text-cream">Plan something</button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <span className="flex gap-1.5">
                    <button onClick={() => setPlanFor({ p })} className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">Plan time</button>
                    <button onClick={() => touch(p.id)} className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">We connected</button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setOpenId(null)} />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
            <div className="space-y-5 px-6 pb-2 pt-6">
              <input autoFocus value={open.name} onChange={(e) => update(open.id, { name: e.target.value })} placeholder="Their name" className="w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-2xl text-stone-900 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-900" />
              <div>
                <p className="kicker mb-2 text-stone-400">Who they are to you</p>
                <div className="flex flex-wrap gap-1.5">
                  {KINDS.map((k) => <button key={k.id} onClick={() => update(open.id, { kind: k.id })} className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${open.kind === k.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}><span className="h-2 w-2 rounded-full" style={{ background: k.tint }} />{k.label}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="kicker mb-1.5 text-stone-400">Birthday</p>
                  <input type="date" value={open.birthday || ''} onChange={(e) => update(open.id, { birthday: e.target.value })} className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none focus:border-stone-900" />
                </div>
                <div>
                  <p className="kicker mb-1.5 text-stone-400">Anniversary</p>
                  <input type="date" value={open.anniversary || ''} onChange={(e) => update(open.id, { anniversary: e.target.value })} className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none focus:border-stone-900" />
                </div>
              </div>
              <div>
                <p className="kicker mb-2 text-stone-400">How often you want to connect</p>
                <div className="flex flex-wrap gap-1.5">
                  {CADENCES.map((c) => <button key={c.id} onClick={() => update(open.id, { cadence: c.id })} className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${open.cadence === c.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{c.label}</button>)}
                </div>
              </div>
              <div>
                <p className="kicker mb-1.5 text-stone-400">Gift ideas</p>
                <input value={open.giftIdeas || ''} onChange={(e) => update(open.id, { giftIdeas: e.target.value })} placeholder="Things they mentioned wanting" className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900" />
              </div>
              <div>
                <p className="kicker mb-1.5 text-stone-400">Notes</p>
                <input value={open.notes || ''} onChange={(e) => update(open.id, { notes: e.target.value })} placeholder="What matters — loves, allergies, what to remember" className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900" />
              </div>
            </div>
            <div className="flex items-center justify-between px-6 pb-6 pt-4">
              <button onClick={() => remove(open.id)} className="text-xs text-stone-400 hover:text-phase-menstrual">Remove</button>
              <span className="flex gap-2">
                <button onClick={() => { setPlanFor({ p: open }); setOpenId(null) }} className="rounded-full border border-stone-300 px-5 py-2.5 text-sm text-stone-700 hover:border-stone-900">Plan time</button>
                <button onClick={() => setOpenId(null)} className="rounded-full bg-stone-900 px-8 py-2.5 text-sm text-cream hover:bg-stone-700">Done</button>
              </span>
            </div>
          </div>
        </div>
      )}

      {planFor && <PlanTimeSheet person={planFor.p} hint={planFor.hint} onCommit={planTime} onClose={() => setPlanFor(null)} />}
    </div>
  )
}

// Plan time — one small sheet that ends with a real event on the calendar.
function PlanTimeSheet({ person, hint, onCommit, onClose }) {
  const [title, setTitle] = useState(hint ? `${person.name || 'Their'}${person.name ? '’s' : ''} ${hint.toLowerCase()}` : `With ${person.name || 'someone'}`)
  const [dk, setDk] = useState(dateKey(new Date()))
  const [time, setTime] = useState('')
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
        <div className="space-y-5 px-6 pb-2 pt-6">
          <p className="font-serif text-2xl text-stone-900">Time with {person.name || 'them'}.</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none focus:border-stone-900" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="kicker mb-1.5 text-stone-400">When</p>
              <input type="date" value={dk} onChange={(e) => setDk(e.target.value)} className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none focus:border-stone-900" />
            </div>
            <div>
              <p className="kicker mb-1.5 text-stone-400">Time</p>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none focus:border-stone-900" />
            </div>
          </div>
          {(person.giftIdeas || '').trim() && <p className="text-xs italic text-stone-400">Gift ideas on file: {person.giftIdeas}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-4">
          <button onClick={onClose} className="rounded-full border border-stone-300 px-5 py-2.5 text-sm text-stone-700 hover:border-stone-900">Cancel</button>
          <button onClick={() => onCommit(person, dk, time, title)} className="rounded-full bg-stone-900 px-6 py-2.5 text-sm text-cream hover:bg-stone-700">Put it on the calendar</button>
        </div>
      </div>
    </div>
  )
}
