import React, { useState } from 'react'
import { X, Dumbbell } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'

// ── Workout Plan — the training programme as a dashboard. Focus areas up top
// show how the plan covers the body; each workout below is tagged with what it
// hits. Balance is visible at a glance.

const uid = () => Math.random().toString(36).slice(2, 10)

const FOCUS = [
  { id: 'strength', label: 'Strength', tint: '#5A6B7B' },
  { id: 'glutes', label: 'Glutes', tint: '#A0654C' },
  { id: 'core', label: 'Core', tint: '#8C7A5F' },
  { id: 'pelvic', label: 'Pelvic floor', tint: '#B07A9A' },
  { id: 'flexibility', label: 'Flexibility', tint: '#889072' },
  { id: 'mobility', label: 'Mobility', tint: '#7C8B6B' },
  { id: 'cardio', label: 'Cardio', tint: '#B08D45' },
  { id: 'posture', label: 'Posture', tint: '#8E7BA0' },
]
const focusMeta = (id) => FOCUS.find((f) => f.id === id) || { id, label: id, tint: '#8C7A5F' }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function FitnessPlan() {
  const [stored, setPlan] = useLocalStorage('mos:fitness:plan', [])
  const workouts = Array.isArray(stored) ? stored : []
  const [openId, setOpenId] = useState(null)
  const { activities, add: addAct, update: updAct, remove: rmAct } = useActivities()

  // The loop: a workout with days becomes a real recurring activity, so the
  // plan lands on the Fitness Schedule and on Today — not just on this page.
  const pairedOf = (wid) => activities.find((a) => a.details?.planId === wid && a.status !== 'archived')
  const monIdxToJs = (i) => (i + 1) % 7 // plan days are Mon-first; activities use JS Sunday-first
  const syncWorkout = (w) => {
    if (!w) return
    const existing = pairedOf(w.id)
    const name = (w.name || '').trim()
    if (!name || !(w.days || []).length) { if (existing) rmAct(existing.id); return }
    const patch = {
      title: name, category: 'fitness', frequency: 'specific',
      daysOfWeek: w.days.map(monIdxToJs), notes: w.notes || '', timeOfDay: ['morning'],
      details: { ...(existing?.details || {}), planId: w.id },
    }
    if (existing) updAct(existing.id, { ...existing, ...patch })
    else addAct(blankActivity('protocol', patch))
  }

  const add = () => { const w = { id: uid(), name: '', focus: [], days: [], notes: '' }; setPlan((p) => [...(Array.isArray(p) ? p : []), w]); setOpenId(w.id) }
  const update = (id, patch) => setPlan((p) => (Array.isArray(p) ? p : []).map((w) => (w.id === id ? { ...w, ...patch } : w)))
  const remove = (id) => { const paired = pairedOf(id); if (paired) rmAct(paired.id); setPlan((p) => (Array.isArray(p) ? p : []).filter((w) => w.id !== id)); setOpenId(null) }
  const close = () => { syncWorkout(workouts.find((w) => w.id === openId)); setOpenId(null) }

  // Coverage — how many workouts hit each focus area.
  const coverage = FOCUS.map((f) => ({ ...f, n: workouts.filter((w) => (w.focus || []).includes(f.id)).length }))
  const maxN = Math.max(1, ...coverage.map((c) => c.n))
  const open = workouts.find((w) => w.id === openId) || null

  return (
    <div className="mx-auto max-w-3xl">
      {/* Coverage — is the plan balanced? */}
      <div className="mb-8 rounded-2xl border border-stone-200 bg-white/40 p-6">
        <p className="kicker mb-4 text-stone-400">What the plan covers</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {coverage.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm text-stone-600">{c.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full transition-all" style={{ width: `${(c.n / maxN) * 100}%`, background: c.tint, opacity: c.n ? 1 : 0 }} />
              </div>
              <span className="w-4 text-right text-xs tabular-nums text-stone-400">{c.n}</span>
            </div>
          ))}
        </div>
        {workouts.length > 0 && coverage.some((c) => c.n === 0) && (
          <p className="mt-4 text-xs italic text-stone-400">Uncovered: {coverage.filter((c) => c.n === 0).map((c) => c.label).join(' · ')}</p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm italic text-stone-400">{workouts.length ? `${workouts.length} workout${workouts.length > 1 ? 's' : ''} in the plan` : ''}</p>
        <button onClick={add} className="rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream hover:bg-stone-700">New workout</button>
      </div>

      {workouts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-200 py-14 text-center font-serif italic text-lg text-stone-400">No plan yet.<br /><span className="text-sm not-italic text-stone-400">Add a workout and tag what it hits — the coverage fills in above.</span></p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {workouts.map((w) => (
            <button key={w.id} onClick={() => setOpenId(w.id)} className="rounded-2xl border border-stone-200 bg-white/50 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-2.5">
                <Dumbbell size={16} strokeWidth={1.5} className="text-stone-400" />
                <span className="flex-1 truncate font-serif text-lg text-stone-900">{w.name || 'Untitled workout'}</span>
              </div>
              {(w.days || []).length > 0 && <p className="mt-1.5 text-xs text-stone-400">{w.days.map((d) => DAYS[d]).join(' · ')}{pairedOf(w.id) ? ' · on the schedule' : ''}</p>}
              {(w.focus || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {w.focus.map((f) => { const F = focusMeta(f); return <span key={f} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]" style={{ background: `${F.tint}1a`, color: F.tint }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: F.tint }} />{F.label}</span> })}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-md rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between px-6 pb-1 pt-5">
              <span className="kicker text-stone-400">Workout</span>
              <button onClick={close} aria-label="Close" className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
            </div>
            <div className="space-y-5 px-6 pb-2 pt-2">
              <input autoFocus value={open.name} onChange={(e) => update(open.id, { name: e.target.value })} placeholder="Name it — e.g. Lower Power" className="w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-2xl text-stone-900 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-900" />
              <div>
                <p className="kicker mb-2 text-stone-400">What it hits</p>
                <div className="flex flex-wrap gap-1.5">
                  {FOCUS.map((f) => {
                    const on = (open.focus || []).includes(f.id)
                    return <button key={f.id} onClick={() => update(open.id, { focus: on ? open.focus.filter((x) => x !== f.id) : [...(open.focus || []), f.id] })} className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}><span className="h-2 w-2 rounded-full" style={{ background: f.tint }} />{f.label}</button>
                  })}
                </div>
              </div>
              <div>
                <p className="kicker mb-2 text-stone-400">Days</p>
                <div className="flex gap-1.5">
                  {DAYS.map((d, i) => {
                    const on = (open.days || []).includes(i)
                    return <button key={d} onClick={() => update(open.id, { days: on ? open.days.filter((x) => x !== i) : [...(open.days || []), i].sort() })} className={`h-8 w-9 rounded-full border text-xs transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{d[0]}</button>
                  })}
                </div>
                {(open.days || []).length > 0 && <p className="mt-2 text-[11px] italic text-stone-400">These days land on your Schedule and on Today — automatically.</p>}
              </div>
              <div>
                <p className="kicker mb-1.5 text-stone-400">The work</p>
                <textarea value={open.notes || ''} onChange={(e) => update(open.id, { notes: e.target.value })} placeholder={'Squats 4×6\nHip thrusts 4×8\nRDLs 3×10'} rows={4} className="w-full resize-y rounded-xl bg-stone-500/5 px-4 py-3 text-sm leading-relaxed outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-between px-6 pb-6 pt-4">
              <button onClick={() => remove(open.id)} className="text-xs text-stone-400 hover:text-phase-menstrual">Delete</button>
              <button onClick={close} className="rounded-full bg-stone-900 px-8 py-2.5 text-sm text-cream hover:bg-stone-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
