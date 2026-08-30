import React, { useState } from 'react'
import { X, Check, Plus, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { PATTERNS as SHARED_PATTERNS, UNITS } from './CadencePicker'
import { dateKey } from '../../lib/date'
import { upsertShelfItem } from '../../lib/goalRoutes'

// ── RoutineBuilder — an ordered ritual where every step is a real record:
// name, product used, type, frequency. Adding walks you through the fields;
// tapping a step opens it to edit. Steps check off per-day.

const uid = () => Math.random().toString(36).slice(2, 10)

// The same expansive recurrence vocabulary as the main calendar.
// The same vocabulary the Repeat control on an event uses, so "how often" reads
// identically wherever it's set — plus "Specific days", which a routine needs.
const FREQS = [
  ...SHARED_PATTERNS.filter((p) => p.id !== 'once' && p.id !== 'asneeded' && p.id !== 'custom')
    .flatMap((p) => (p.id === 'weekly' ? [p, { id: 'days', label: 'Specific days' }] : [p])),
  { id: 'custom', label: 'Custom' },
  { id: 'asneeded', label: 'As needed' },
]
const WD = [
  { d: 1, l: 'M' }, { d: 2, l: 'T' }, { d: 3, l: 'W' }, { d: 4, l: 'T' }, { d: 5, l: 'F' }, { d: 6, l: 'S' }, { d: 0, l: 'S' },
]

export const freqLabel = (s) => {
  const f = s.freq || 'daily'
  if (f === 'days') { const n = (s.days || []).length; return n ? `${n}× a week` : 'Specific days' }
  if (f === 'custom') { const n = s.interval || 2; const u = s.unit || 'week'; return `Every ${n} ${u}${n === 1 ? '' : 's'}` }
  if (f === '2-3x') return '2–3× a week' // legacy steps keep their label
  return (FREQS.find((x) => x.id === f) || {}).label || f
}

export default function RoutineBuilder({ storeKey, Icon, intro, types = [], productLabel = 'Product', shelfKey = null }) {
  const [stored, setSteps] = useLocalStorage(storeKey, [])
  const steps = (Array.isArray(stored) ? stored : []).map((s) => ({ id: s.id || uid(), name: s.name || s.text || '', product: s.product || '', type: s.type || '', freq: s.freq || 'daily', ...s }))
  const [doneStore, setDone] = useLocalStorage(`${storeKey}:done`, {})
  const dm = doneStore && typeof doneStore === 'object' ? doneStore : {}
  const todayKey = dateKey(new Date())
  const doneToday = Array.isArray(dm[todayKey]) ? dm[todayKey] : []
  const [openId, setOpenId] = useState(null) // editing step id, or 'new'

  const commit = (step) => {
    if (step.id === 'new') setSteps((p) => [...(Array.isArray(p) ? p : []), { ...step, id: uid() }])
    else setSteps((p) => (Array.isArray(p) ? p : []).map((s) => (s.id === step.id ? step : s)))
    // The product named on a step also lives on the pillar's Products shelf.
    if (shelfKey && (step.product || '').trim()) upsertShelfItem(shelfKey, step.product, step.type ? `${step.type.toLowerCase()} · from your routine` : 'from your routine')
    setOpenId(null)
  }
  const remove = (id) => { setSteps((p) => (Array.isArray(p) ? p : []).filter((s) => s.id !== id)); setOpenId(null) }
  const toggle = (id) => setDone((p) => {
    const pp = p && typeof p === 'object' ? p : {}
    const cur = Array.isArray(pp[todayKey]) ? pp[todayKey] : []
    return { ...pp, [todayKey]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }
  })

  const editing = openId === 'new'
    ? { id: 'new', name: '', product: '', type: types[0] || '', freq: 'daily' }
    : steps.find((s) => s.id === openId) || null

  return (
    <div className="mx-auto max-w-lg">
      <ol className="space-y-2.5">
        {steps.map((s, i) => {
          const done = doneToday.includes(s.id)
          return (
            <li key={s.id} className="flex items-center gap-3.5 rounded-2xl border border-stone-200 bg-cream/50 px-4 py-3">
              <button
                onClick={() => toggle(s.id)}
                aria-label={done ? 'Done today' : 'Mark done'}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-serif text-sm transition-all ${done ? 'border-transparent text-cream' : 'border-stone-300 text-stone-400 hover:border-stone-500'}`}
                style={done ? { backgroundColor: '#1C1C1A' } : undefined}
              >
                {done ? <Check size={15} strokeWidth={2} /> : i + 1}
              </button>
              <button onClick={() => setOpenId(s.id)} className="min-w-0 flex-1 text-left">
                <p className={`truncate font-serif text-lg leading-tight ${done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{s.name || 'Untitled step'}</p>
                {(s.product || s.type || s.freq !== 'daily') && (
                  <p className="mt-0.5 truncate text-xs text-stone-400">
                    {[s.product, s.type, s.freq !== 'daily' ? freqLabel(s) : null].filter(Boolean).join(' · ')}
                  </p>
                )}
              </button>
              <ChevronRight size={15} className="shrink-0 text-stone-300" />
            </li>
          )
        })}
      </ol>

      <button onClick={() => setOpenId('new')} className="mt-3 flex w-full items-center gap-3.5 rounded-2xl border border-dashed border-stone-200 px-4 py-3 text-left transition-colors hover:border-stone-400">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-300"><Plus size={16} /></span>
        <span className="font-serif text-lg italic text-stone-400">Add a step…</span>
      </button>

      {editing && <StepForm step={editing} types={types} productLabel={productLabel} onSave={commit} onDelete={editing.id !== 'new' ? () => remove(editing.id) : null} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function StepForm({ step, types, productLabel, onSave, onDelete, onClose }) {
  const [s, setS] = useState(step)
  const patch = (x) => setS((prev) => ({ ...prev, ...x }))
  const canSave = (s.name || '').trim()
  const chip = (on) => `rounded-full border px-3.5 py-1.5 text-xs transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pb-1 pt-5">
          <span className="kicker text-stone-400">{step.id === 'new' ? 'New step' : 'Step'}</span>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="space-y-5 px-6 pb-2 pt-2">
          <input
            autoFocus
            value={s.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="The step — e.g. Vitamin C serum"
            className="w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-2xl text-stone-900 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-900"
          />
          <div>
            <p className="kicker mb-1.5 text-stone-400">{productLabel}</p>
            <input value={s.product} onChange={(e) => patch({ product: e.target.value })} placeholder="Brand & product you use" className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900" />
          </div>
          {types.length > 0 && (
            <div>
              <p className="kicker mb-2 text-stone-400">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {types.map((t) => <button key={t} onClick={() => patch({ type: s.type === t ? '' : t })} className={chip(s.type === t)}>{t}</button>)}
              </div>
            </div>
          )}
          <div>
            <p className="kicker mb-2 text-stone-400">How often</p>
            <div className="flex flex-wrap gap-1.5">
              {FREQS.map((f) => <button key={f.id} onClick={() => patch({ freq: f.id })} className={chip((s.freq === f.id) || (s.freq === '2-3x' && f.id === 'days'))}>{f.label}</button>)}
            </div>
            {(s.freq === 'days' || s.freq === '2-3x') && (
              <div className="mt-3 flex gap-1.5">
                {WD.map((w) => {
                  const on = (s.days || []).includes(w.d)
                  return <button key={w.d} onClick={() => patch({ freq: 'days', days: on ? (s.days || []).filter((x) => x !== w.d) : [...(s.days || []), w.d].sort() })} className={`h-8 w-9 rounded-full border text-xs transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{w.l}</button>
                })}
              </div>
            )}
            {s.freq === 'custom' && (
              <div className="mt-3 flex items-center gap-2 text-sm text-stone-700">
                Every
                <input type="number" min="1" value={s.interval || 2} onChange={(e) => patch({ interval: Math.max(1, Number(e.target.value) || 1) })} className="w-14 border-b border-stone-300 bg-transparent pb-1 text-center outline-none focus:border-stone-900" />
                <select value={s.unit || 'week'} onChange={(e) => patch({ unit: e.target.value })} className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900">
                  {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-6 pb-6 pt-4">
          {onDelete ? <button onClick={onDelete} className="text-xs text-stone-400 hover:text-phase-menstrual">Remove step</button> : <span />}
          <button onClick={() => canSave && onSave(s)} disabled={!canSave} className={`rounded-full px-8 py-2.5 text-sm transition-colors ${canSave ? 'bg-stone-900 text-cream hover:bg-stone-700' : 'cursor-not-allowed bg-stone-200 text-stone-400'}`}>Save</button>
        </div>
      </div>
    </div>
  )
}
