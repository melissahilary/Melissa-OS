import React, { useMemo, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { AddIcon, CloseIcon, LoggedIcon, NextIcon, FitnessMark } from './shared/marks'
import { Sparkles } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, parseKey, MONTHS, MONTHS_SHORT } from '../lib/date'
import Checkbox from './shared/Checkbox'
import EmptyState from './shared/EmptyState'

const uid = () => Math.random().toString(36).slice(2, 10)

// ── Projects — a piece of work with a face.
//
// A project was a text row in an accordion, which is why none of them ever felt
// like anything. A wedding, a move, a renovation, a course of treatment — these
// are the largest things a woman is holding, and they have a look. So: a card
// with a cover, one visible next action, and the money.

export const PILLAR_TAGS = [
  { id: 'skincare', label: 'Skincare', tint: '#889072' },
  { id: 'aesthetics', label: 'Aesthetics', tint: '#A0654C' },
  { id: 'fitness', label: 'Fitness', tint: '#5A6B7B' },
  { id: 'hormones', label: 'Hormones', tint: '#B08D45' },
  { id: 'nutrition', label: 'Nutrition', tint: '#8C7A5F' },
  { id: 'mindset', label: 'Mindset', tint: '#8E7BA0' },
  { id: 'haircare', label: 'Haircare', tint: '#9E7B5A' },
  { id: 'bodycare', label: 'Bodycare', tint: '#6E8CA0' },
  { id: 'relationship', label: 'Relationships', tint: '#B07A9A' },
  { id: 'diagnostics', label: 'Testing', tint: '#8A9BA8' },
]
const tagMeta = (id) => PILLAR_TAGS.find((p) => p.id === id) || PILLAR_TAGS[5]

// Each template pre-loads the tasks the thing actually involves, and the pillars
// it touches — because a wedding is a fitness and skincare project too, and a
// treatment course is a testing one.
const TEMPLATES = [
  { id: 'wedding', label: 'Wedding', pillars: ['aesthetics', 'skincare', 'fitness'], tasks: ['Set the date', 'Book the venue', 'Dress — first fitting', 'Skin plan starts (6 months out)', 'Trial hair and makeup', 'Final fitting'] },
  { id: 'move', label: 'Move', pillars: ['mindset'], tasks: ['Give notice', 'Book movers', 'Change the address', 'Pack the kitchen last', 'Meter readings', 'First night box'] },
  { id: 'renovation', label: 'Renovation', pillars: ['mindset'], tasks: ['Scope and budget', 'Three quotes', 'Choose the contractor', 'Order long-lead items', 'Snagging list'] },
  { id: 'conception', label: 'Conception', pillars: ['hormones', 'nutrition', 'diagnostics'], tasks: ['Preconception panel', 'Start folate', 'Track ovulation', 'Partner semen analysis', 'Review with the clinic'] },
  { id: 'launch', label: 'Launch', pillars: ['mindset'], tasks: ['Define the offer', 'Build the page', 'Line up the first ten', 'Announce', 'Follow up'] },
  { id: 'trip', label: 'Trip', pillars: ['mindset', 'skincare'], tasks: ['Book flights', 'Book the stay', 'Vaccinations / meds', 'Decant the routine', 'Out-of-office'] },
  { id: 'treatment', label: 'Treatment course', pillars: ['aesthetics', 'diagnostics'], tasks: ['Consultation', 'Baseline photographs', 'Session one', 'Session two', 'Review'] },
]

// The same three horizons as goals. Choosing one sets the date from today;
// she can then move the date without moving the horizon.
const HORIZONS = [
  { id: 'now', note: 'Next 6 months', months: 6 },
  { id: 'next', note: '6–12 months', months: 12 },
  { id: 'later', note: 'Beyond a year', months: 18 },
]
const addMonths = (key, n) => { const d = parseKey(key) || new Date(); return dateKey(new Date(d.getFullYear(), d.getMonth() + n, d.getDate())) }
const dueFor = (id) => { const h = HORIZONS.find((x) => x.id === id); return h ? addMonths(dateKey(new Date()), h.months) : '' }
const fmtLong = (key) => { const d = parseKey(key); return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '' }

// One control, used on the create sheet and the project itself.
function HorizonPick({ value, due, onPick, onDate }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {HORIZONS.map((h) => (
          <button key={h.id} type="button" onClick={() => onPick(h.id)} title={`Sets the date ${h.months} months from today`}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${value === h.id ? 'bg-stone-900 text-cream' : 'border border-stone-300 text-stone-900 hover:border-stone-900'}`}>
            {h.note}
          </button>
        ))}
      </div>
      {due && (
        <label className="mt-2 flex items-baseline gap-2 text-[12px] text-stone-500">
          <span className="tracking-[0.14em]">BY</span>
          <input type="date" value={due} onChange={(e) => onDate(e.target.value)} aria-label="Due date" className="bg-transparent text-[12px] text-stone-900 outline-none" />
        </label>
      )}
    </div>
  )
}

const normProject = (p) => ({
  id: p.id || uid(),
  name: p.name != null ? p.name : (p.title || ''),
  cover: p.cover || '',
  goalId: p.goalId || '',
  pillars: Array.isArray(p.pillars) ? p.pillars : [], // kept on the row; no longer asked for
  status: p.status === 'done' ? 'done' : p.status === 'dormant' ? 'dormant' : 'active',
  horizon: HORIZONS.some((h) => h.id === p.horizon) ? p.horizon : '',
  due: p.due || '',
  nextAction: p.nextAction || '',
  budget: p.budget && typeof p.budget === 'object' ? p.budget : { planned: '', spent: '' },
  people: Array.isArray(p.people) ? p.people : [],
  links: Array.isArray(p.links) ? p.links : [],
  tasks: Array.isArray(p.tasks) ? p.tasks : [],
})

const money = (v) => {
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
const fmtMoney = (v) => {
  const n = money(v)
  return n == null ? '' : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

// Covers are stored as small data URLs on the project itself — a project has one
// picture, so this stays well inside what a state row should carry.
function shrink(file, max, cb) {
  const img = new Image()
  img.onload = () => {
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    cb(c.toDataURL('image/jpeg', 0.72))
    URL.revokeObjectURL(img.src)
  }
  img.src = URL.createObjectURL(file)
}

export default function DreamProjects({ goals = [] }) {
  const [stored, setStore] = useLocalStorage('mos:dream:projects', [])
  const projects = useMemo(() => (Array.isArray(stored) ? stored : []).map(normProject), [stored])
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)

  const commit = (fn) => setStore((prev) => fn((Array.isArray(prev) ? prev : []).map(normProject)))
  const update = (id, patch) => commit((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const remove = (id) => { commit((arr) => arr.filter((p) => p.id !== id)); setOpenId(null) }
  const create = (p) => { const np = normProject(p); commit((arr) => [np, ...arr]); setCreating(false); setOpenId(np.id) }

  const active = projects.filter((p) => p.status === 'active')
  const dormant = projects.filter((p) => p.status === 'dormant')
  const done = projects.filter((p) => p.status === 'done')
  const open = projects.find((p) => p.id === openId) || null

  return (
    <div>
      <button
        onClick={() => setCreating(true)}
        className="mb-5 flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-stone-900"
      >
        <AddIcon size={14} strokeWidth={1.8} /> New project
      </button>

      {creating && <CreateSheet goals={goals} onCreate={create} onClose={() => setCreating(false)} />}

      {active.length === 0 && dormant.length === 0 && done.length === 0 ? (
        <EmptyState mark={FitnessMark} line="Nothing here yet." action="Add a project" onAction={() => setCreating(true)}>
          <div className="mt-6 flex flex-wrap justify-center gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => create({ name: t.label, pillars: t.pillars, tasks: t.tasks.map((x) => ({ id: uid(), title: x, done: false })), nextAction: t.tasks[0] })}
                className="rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream"
              >
                {t.label}
              </button>
            ))}
          </div>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((p) => <Card key={p.id} project={p} goals={goals} onOpen={() => setOpenId(p.id)} />)}
        </div>
      )}

      {dormant.length > 0 && (
        <div className="mt-8 border-t border-stone-200 pt-5">
          <p className="kicker mb-3 text-stone-400">Dormant · {dormant.length}</p>
          <div className="flex flex-wrap gap-2">
            {dormant.map((p) => (
              <button key={p.id} onClick={() => setOpenId(p.id)} className="rounded-full border border-stone-200 px-4 py-1.5 text-sm text-stone-500 hover:border-stone-400">{p.name || 'Untitled'}</button>
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6 border-t border-stone-200 pt-5">
          <p className="kicker mb-3 text-stone-400">Finished · {done.length}</p>
          <div className="flex flex-wrap gap-2">
            {done.map((p) => (
              <button key={p.id} onClick={() => setOpenId(p.id)} className="flex items-center gap-2 rounded-full border border-stone-200 px-4 py-1.5 text-sm text-stone-500 hover:border-stone-400">
                <LoggedIcon size={13} style={{ color: '#7C8B6B' }} />{p.name || 'Untitled'}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (
        <Sheet
          project={open}
          goals={goals}
          onUpdate={(patch) => update(open.id, patch)}
          onRemove={() => remove(open.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

// ── The card face ───────────────────────────────────────────────────
function Card({ project: p, goals, onOpen }) {
  const tasks = p.tasks
  const doneN = tasks.filter((t) => t.done).length
  const goal = goals.find((g) => g.id === p.goalId)
  const next = p.nextAction || (tasks.find((t) => !t.done) || {}).title || ''

  return (
    <button onClick={onOpen} className="group overflow-hidden rounded-2xl border border-stone-200 bg-white/50 text-left shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-32 w-full overflow-hidden bg-stone-100">
        {p.cover
          ? <img src={p.cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : <span className="flex h-full w-full items-center justify-center text-stone-300"><ImagePlus size={20} strokeWidth={1.4} /></span>}
      </div>
      <div className="p-4">
        <div className="flex items-baseline gap-2">
          <h3 className="min-w-0 flex-1 truncate font-serif text-lg text-stone-900">{p.name || 'Untitled project'}</h3>
          {tasks.length > 0 && <span className="shrink-0 text-[11px] tabular-nums text-stone-400">{doneN} of {tasks.length}</span>}
        </div>
        {goal && <p className="mt-0.5 truncate text-[11px] text-stone-400">toward {goal.title}</p>}

        {next && (
          <p className="mt-2.5 border-t border-stone-100 pt-2.5 text-sm leading-snug text-stone-700">
            <span className="mr-1.5 text-[10px] tracking-[0.14em] text-stone-400">NEXT</span>
            {next}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {p.horizon && <span className="text-[10px] text-stone-500">{(HORIZONS.find((h) => h.id === p.horizon) || {}).note}</span>}
          {p.due && <span className="text-[10px] tabular-nums text-stone-500">· {MONTHS_SHORT[parseKey(p.due).getMonth()]} {parseKey(p.due).getDate()}</span>}
          {money(p.budget.planned) != null && (
            <span className="ml-auto text-[10px] tabular-nums text-stone-400">
              {fmtMoney(p.budget.spent || 0)} / {fmtMoney(p.budget.planned)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Create ──────────────────────────────────────────────────────────
function CreateSheet({ goals, onCreate, onClose }) {
  const [name, setName] = useState('')
  const [goalId, setGoalId] = useState('')
  const [horizon, setHorizon] = useState('')
  const [due, setDue] = useState('')
  const [cover, setCover] = useState('')
  const fileRef = useRef(null)

  const useTemplate = (t) => setName((n) => n || t.label)
  const submit = () => {
    if (!name.trim()) return
    const t = TEMPLATES.find((x) => x.label === name.trim())
    onCreate({
      name: name.trim(), goalId, pillars: t ? t.pillars : [], horizon, due, cover,
      tasks: t ? t.tasks.map((x) => ({ id: uid(), title: x, done: false })) : [],
      nextAction: t ? t.tasks[0] : '',
    })
  }

  return (
    <div className="mb-5 rounded-2xl border border-stone-900 bg-white/60 p-5">
      <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="What is it?" className="w-full border-b border-stone-300 bg-transparent pb-1.5 font-serif text-xl outline-none placeholder:text-stone-300 focus:border-stone-900" />

      <p className="kicker mb-2 mt-5 text-stone-400">Or start from</p>
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => useTemplate(t)} className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">{t.label}</button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-5">
        <label>
          <span className="kicker mb-1 block text-stone-400">Toward</span>
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900">
            <option value="">—</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title || 'Untitled goal'}</option>)}
          </select>
        </label>
        <div>
          <span className="kicker mb-1 block text-stone-400">By</span>
          <HorizonPick value={horizon} due={due} onPick={(h) => { setHorizon(h); setDue(dueFor(h)) }} onDate={setDue} />
        </div>
        <button onClick={() => fileRef.current && fileRef.current.click()} className="flex items-center gap-1.5 border-b border-stone-300 pb-1 text-sm text-stone-500 hover:border-stone-900 hover:text-stone-900">
          <ImagePlus size={14} strokeWidth={1.6} />{cover ? 'Cover chosen' : 'Cover'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) shrink(f, 900, setCover) }} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={submit} disabled={!name.trim()} className="rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-30">Create</button>
        <button onClick={onClose} className="text-xs text-stone-400 hover:text-stone-700">Cancel</button>
      </div>
    </div>
  )
}

// ── The project itself ──────────────────────────────────────────────
function Sheet({ project: p, goals, onUpdate, onRemove, onClose }) {
  const [taskDraft, setTaskDraft] = useState('')
  const [personDraft, setPersonDraft] = useState('')
  const [linkDraft, setLinkDraft] = useState('')
  const fileRef = useRef(null)

  const tasks = p.tasks
  const doneN = tasks.filter((t) => t.done).length
  const setTask = (id, patch) => onUpdate({ tasks: tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  const addTask = () => { const t = taskDraft.trim(); if (!t) return; onUpdate({ tasks: [...tasks, { id: uid(), title: t, done: false }] }); setTaskDraft('') }
  const rmTask = (id) => onUpdate({ tasks: tasks.filter((t) => t.id !== id) })
  const goal = goals.find((g) => g.id === p.goalId)

  // The plan. Claude reads the project and the goal it serves and writes the
  // steps from start to finish. They arrive as text she can change, cut or add
  // to, and nothing touches the project until she imports them.
  const [plan, setPlan] = useState(null) // { status: 'loading'|'ready'|'error', steps: [{ id, title, detail }] }
  const buildPlan = async () => {
    setPlan({ status: 'loading', steps: [] })
    try {
      const r = await fetch('/api/project-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: p.name, goal: goal ? goal.title : '', due: p.due, existing: tasks.map((t) => t.title) }),
      })
      const d = await r.json()
      if (d && Array.isArray(d.steps) && d.steps.length) setPlan({ status: 'ready', steps: d.steps.map((x) => ({ id: uid(), title: x.title || '', detail: x.detail || '' })) })
      else setPlan({ status: 'error', steps: [] })
    } catch { setPlan({ status: 'error', steps: [] }) }
  }
  const setPlanStep = (id, patch) => setPlan((pl) => ({ ...pl, steps: pl.steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  const importPlan = () => {
    const keep = plan.steps.filter((x) => x.title.trim())
    onUpdate({ tasks: [...tasks, ...keep.map((x) => ({ id: uid(), title: x.title.trim(), done: false, detail: x.detail }))], nextAction: p.nextAction || (keep[0] ? keep[0].title.trim() : '') })
    setPlan(null)
  }

  const addPerson = () => { const t = personDraft.trim(); if (!t) return; onUpdate({ people: [...p.people, { id: uid(), name: t, role: '' }] }); setPersonDraft('') }
  const addLink = () => {
    const u = linkDraft.trim()
    if (!u) return
    const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`
    onUpdate({ links: [...p.links, { id: uid(), url: withProto, label: u.replace(/^https?:\/\//i, '').slice(0, 44) }] })
    setLinkDraft('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/25 sm:items-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-cream sm:rounded-3xl">
        <div className="relative h-40 w-full overflow-hidden bg-stone-100">
          {p.cover && <img src={p.cover} alt="" className="h-full w-full object-cover" />}
          <button onClick={() => fileRef.current && fileRef.current.click()} className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-cream/90 px-3 py-1.5 text-xs text-stone-700 backdrop-blur hover:bg-cream">
            <ImagePlus size={13} strokeWidth={1.6} />{p.cover ? 'Change cover' : 'Add a cover'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) shrink(f, 1200, (d) => onUpdate({ cover: d })) }} />
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full bg-cream/90 p-1.5 text-stone-600 backdrop-blur hover:text-stone-900"><CloseIcon size={16} /></button>
        </div>

        <div className="p-6">
          <input
            value={p.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Untitled project"
            className="w-full bg-transparent font-serif text-2xl text-stone-900 outline-none placeholder:text-stone-300"
          />

          {/* The one thing that moves it — visible everywhere this project appears. */}
          <div className="mt-5">
            <p className="kicker mb-1.5 text-stone-400">Next action</p>
            <input
              value={p.nextAction}
              onChange={(e) => onUpdate({ nextAction: e.target.value })}
              placeholder={(tasks.find((t) => !t.done) || {}).title || 'The very next thing'}
              className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-5">
            <label>
              <span className="kicker mb-1 block text-stone-400">Toward</span>
              <select value={p.goalId} onChange={(e) => onUpdate({ goalId: e.target.value })} className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900">
                <option value="">—</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title || 'Untitled goal'}</option>)}
              </select>
            </label>
            <div>
              <span className="kicker mb-1 block text-stone-400">By</span>
              <HorizonPick value={p.horizon} due={p.due} onPick={(h) => onUpdate({ horizon: h, due: dueFor(h) })} onDate={(d) => onUpdate({ due: d })} />
            </div>
            <label>
              <span className="kicker mb-1 block text-stone-400">Planned</span>
              <input value={p.budget.planned} onChange={(e) => onUpdate({ budget: { ...p.budget, planned: e.target.value } })} placeholder="0" className="w-24 border-b border-stone-300 bg-transparent pb-1 text-sm tabular-nums outline-none placeholder:text-stone-300 focus:border-stone-900" />
            </label>
            <label>
              <span className="kicker mb-1 block text-stone-400">Spent</span>
              <input value={p.budget.spent} onChange={(e) => onUpdate({ budget: { ...p.budget, spent: e.target.value } })} placeholder="0" className="w-24 border-b border-stone-300 bg-transparent pb-1 text-sm tabular-nums outline-none placeholder:text-stone-300 focus:border-stone-900" />
            </label>
          </div>

          <div className="mt-6">
            <p className="kicker mb-2 text-stone-400">Tasks {tasks.length > 0 && <span className="tabular-nums">· {doneN} of {tasks.length}</span>}</p>
            <div className="space-y-0.5">
              {tasks.map((t) => (
                <div key={t.id} className="group flex items-center gap-3 py-1">
                  <Checkbox checked={t.done} onClick={() => setTask(t.id, { done: !t.done })} />
                  <span className={`flex-1 text-sm ${t.done ? 'text-stone-300' : 'text-stone-800'}`}>{t.title}</span>
                  <button onClick={() => rmTask(t.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><CloseIcon size={13} /></button>
                </div>
              ))}
            </div>
            <div className="mt-1 flex items-center gap-2.5 border-b border-stone-200 pb-1.5 focus-within:border-stone-900">
              <AddIcon size={13} className="shrink-0 text-stone-300" />
              <input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Add a task" className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-400" />
            </div>

            {!plan && (
              <button onClick={buildPlan} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white/40 px-4 py-3 text-sm text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900">
                <Sparkles size={15} /> {tasks.length ? 'Extend the steps with AI' : 'Build the steps with AI'}
              </button>
            )}
            {plan && plan.status === 'loading' && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white/50 px-4 py-4 text-sm text-stone-500"><Sparkles size={15} className="animate-pulse" /> Reading the goal and writing the steps…</div>
            )}
            {plan && plan.status === 'error' && (
              <div className="mt-3 rounded-xl border border-stone-200 bg-white/50 px-4 py-4 text-sm text-stone-500">
                <p>Couldn't reach the planner right now.</p>
                <button onClick={buildPlan} className="mt-1 text-stone-900 underline underline-offset-4">Try again</button>
                <button onClick={() => setPlan(null)} className="ml-3 text-stone-500 hover:text-stone-900">Dismiss</button>
              </div>
            )}
            {plan && plan.status === 'ready' && (
              <div className="mt-3 border border-stone-900 bg-white/60">
                <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-2.5">
                  <Sparkles size={14} className="text-stone-600" />
                  <span className="kicker text-stone-600">Proposed steps</span>
                  <span className="ml-auto text-[11px] text-stone-500">Change anything before you import it.</span>
                </div>
                <div className="px-4 py-2">
                  {plan.steps.map((x, i) => (
                    <div key={x.id} className="group border-b border-stone-100 py-2 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-stone-500">{i + 1}</span>
                        <input value={x.title} onChange={(e) => setPlanStep(x.id, { title: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none" />
                        <button onClick={() => setPlan((pl) => ({ ...pl, steps: pl.steps.filter((y) => y.id !== x.id) }))} aria-label="Drop this step" className="text-stone-400 opacity-0 transition-opacity hover:text-stone-900 group-hover:opacity-100"><CloseIcon size={13} /></button>
                      </div>
                      <input value={x.detail} onChange={(e) => setPlanStep(x.id, { detail: e.target.value })} placeholder="What it involves"
                        className="ml-8 mt-0.5 block w-[calc(100%-2rem)] bg-transparent text-[12px] text-stone-600 outline-none placeholder:italic placeholder:text-stone-400" />
                    </div>
                  ))}
                  <button onClick={() => setPlan((pl) => ({ ...pl, steps: [...pl.steps, { id: uid(), title: '', detail: '' }] }))} className="mt-1 flex items-center gap-1.5 py-1.5 text-[12px] text-stone-500 hover:text-stone-900"><AddIcon size={12} /> Add a step</button>
                </div>
                <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3">
                  <button onClick={() => setPlan(null)} className="text-xs text-stone-500 hover:text-stone-900">Dismiss</button>
                  <button onClick={importPlan} disabled={!plan.steps.some((x) => x.title.trim())} className="rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-30">
                    Import {plan.steps.filter((x) => x.title.trim()).length} step{plan.steps.filter((x) => x.title.trim()).length === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="kicker mb-2 text-stone-400">People</p>
              {p.people.map((x) => (
                <div key={x.id} className="group flex items-center gap-2 py-1">
                  <span className="flex-1 text-sm text-stone-700">{x.name}</span>
                  <button onClick={() => onUpdate({ people: p.people.filter((y) => y.id !== x.id) })} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><CloseIcon size={12} /></button>
                </div>
              ))}
              <div className="flex items-center gap-2.5 border-b border-stone-200 pb-1.5 focus-within:border-stone-900">
                <AddIcon size={13} className="shrink-0 text-stone-300" />
                <input value={personDraft} onChange={(e) => setPersonDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPerson()} placeholder="practitioner · vendor" className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-300" />
              </div>
            </div>
            <div>
              <p className="kicker mb-2 text-stone-400">Attached</p>
              {p.links.map((x) => (
                <div key={x.id} className="group flex items-center gap-2 py-1">
                  <a href={x.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm text-stone-700 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-900">{x.label}</a>
                  <button onClick={() => onUpdate({ links: p.links.filter((y) => y.id !== x.id) })} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><CloseIcon size={12} /></button>
                </div>
              ))}
              <div className="flex items-center gap-2.5 border-b border-stone-200 pb-1.5 focus-within:border-stone-900">
                <AddIcon size={13} className="shrink-0 text-stone-300" />
                <input value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} placeholder="quote · contract · link" className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-300" />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-stone-200 pt-4">
            <button onClick={onRemove} className="text-xs text-stone-400 hover:text-phase-menstrual">Delete</button>
            <div className="flex items-center gap-2">
              {/* Dormant keeps everything and stops appearing — the honest state
                  for a project that is real but not now. */}
              <button onClick={() => onUpdate({ status: p.status === 'dormant' ? 'active' : 'dormant' })} className="rounded-full border border-stone-300 px-4 py-1.5 text-xs text-stone-600 hover:border-stone-900">
                {p.status === 'dormant' ? 'Wake' : 'Make dormant'}
              </button>
              <button onClick={() => onUpdate({ status: p.status === 'done' ? 'active' : 'done' })} className="rounded-full bg-stone-900 px-4 py-1.5 text-xs text-cream hover:opacity-90">
                {p.status === 'done' ? 'Reopen' : 'Finished'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
