import React, { useState } from 'react'
import { Plus, X, Target, Flag, CalendarClock, CheckCircle2, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useActivities } from '../hooks/useActivities'
import { blankActivity, isDoneOn } from '../lib/activities'
import { dateKey, parseKey, addDays, longDate, MONTHS } from '../lib/date'
import Checkbox from './shared/Checkbox'

const uid = () => Math.random().toString(36).slice(2, 10)

// Three phases a goal can sit in — the columns of the board.
const PHASES = [
  { id: 'now', label: 'Now', note: 'Actively working' },
  { id: 'next', label: 'Next', note: 'On deck' },
  { id: 'later', label: 'Later', note: 'Someday' },
]

// Goals were once a flat checklist ({id,text,done}); read both shapes.
const normMilestone = (m) => ({ id: m.id || uid(), title: m.title || '', targetDate: m.targetDate || '', done: !!m.done })
const normGoal = (g) => {
  if (typeof g === 'string') return { id: uid(), title: g, vision: '', phase: 'now', targetDate: '', status: 'active', milestones: [] }
  return {
    id: g.id || uid(),
    title: g.title != null ? g.title : (g.text || ''),
    vision: g.vision || '',
    phase: ['now', 'next', 'later'].includes(g.phase) ? g.phase : 'now',
    targetDate: g.targetDate || '',
    status: g.status || (g.done ? 'done' : 'active'),
    milestones: Array.isArray(g.milestones) ? g.milestones.map(normMilestone) : [],
  }
}

const todayKey = () => dateKey(new Date())
const daysUntil = (key) => {
  if (!key) return null
  return Math.round((parseKey(key).getTime() - parseKey(todayKey()).getTime()) / 86400000)
}
const shortDate = (key) => { const d = parseKey(key); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}` }
const partFromTime = (t) => { if (!t) return 'morning'; const h = parseInt(t.slice(0, 2), 10); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening' }

export default function DreamDashboard() {
  const [rawGoals, setRawGoals] = useLocalStorage('mos:dream:goals', [])
  const goals = (Array.isArray(rawGoals) ? rawGoals : []).map(normGoal)
  const { activities, add, remove, toggleComplete } = useActivities()
  const [openId, setOpenId] = useState(null)

  const setGoals = (updater) => setRawGoals((prev) => {
    const cur = (Array.isArray(prev) ? prev : []).map(normGoal)
    return typeof updater === 'function' ? updater(cur) : updater
  })
  const addGoal = () => {
    const g = { id: uid(), title: '', vision: '', phase: 'now', targetDate: '', status: 'active', milestones: [] }
    setGoals((prev) => [...prev, g])
    setOpenId(g.id)
  }
  const updateGoal = (id, patch) => setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const removeGoal = (id) => {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    setOpenId(null)
  }

  // Everything linked to a goal lives in the real planner, tagged by goalId.
  const linkedTo = (goalId) => activities.filter((a) => a.details && a.details.goalId === goalId && a.status !== 'archived')
  const actionsOf = (goalId) => linkedTo(goalId).filter((a) => a.type !== 'event')
  const apptsOf = (goalId) => linkedTo(goalId).filter((a) => a.type === 'event')

  // ── Roll-up stats across active goals ──
  const active = goals.filter((g) => g.status !== 'done')
  const allMs = active.flatMap((g) => g.milestones)
  const msDone = allMs.filter((m) => m.done).length
  const weekAgo = dateKey(addDays(new Date(), -6))
  const tKey = todayKey()
  const linkedAll = activities.filter((a) => a.details && a.details.goalId && a.status !== 'archived')
  const actionsThisWeek = linkedAll.reduce((n, a) => n + Object.keys(a.completions || {}).filter((k) => k >= weekAgo && k <= tKey).length, 0)
  const upcomingAppts = linkedAll
    .filter((a) => a.type === 'event' && a.seriesStart && a.seriesStart >= tKey)
    .sort((a, b) => a.seriesStart.localeCompare(b.seriesStart))
  const nextAppt = upcomingAppts[0]

  const openGoal = goals.find((g) => g.id === openId) || null

  return (
    <section>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="kicker text-stone-400">The board</p>
          <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">Life on track.</h2>
        </div>
        <button onClick={addGoal} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-colors hover:bg-stone-700">
          <Plus size={15} strokeWidth={1.75} /> New goal
        </button>
      </div>

      {/* KPI row */}
      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={Target} label="Active goals" value={active.length} />
        <StatTile icon={Flag} label="Milestones" value={`${msDone}/${allMs.length}`} sub="reached" />
        <StatTile icon={CheckCircle2} label="Actions" value={actionsThisWeek} sub="done this week" />
        <StatTile icon={CalendarClock} label="Next appointment" value={nextAppt ? shortDate(nextAppt.seriesStart) : '—'} sub={nextAppt ? nextAppt.title : 'none scheduled'} />
      </div>

      {/* Phase columns */}
      <div className="grid gap-6 md:grid-cols-3">
        {PHASES.map((ph) => {
          const inPhase = goals.filter((g) => g.status !== 'done' && g.phase === ph.id)
          return (
            <div key={ph.id}>
              <div className="mb-3 flex items-baseline justify-between border-b border-stone-200 pb-2">
                <span className="font-serif text-lg text-stone-800">{ph.label}</span>
                <span className="kicker text-stone-400">{inPhase.length} · {ph.note}</span>
              </div>
              <div className="space-y-3">
                {inPhase.map((g) => (
                  <GoalCard key={g.id} goal={g} actions={actionsOf(g.id)} appts={apptsOf(g.id)} onOpen={() => setOpenId(g.id)} />
                ))}
                {inPhase.length === 0 && <p className="py-6 text-center text-xs italic text-stone-300">Nothing here.</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Achieved */}
      <Achieved goals={goals.filter((g) => g.status === 'done')} onOpen={setOpenId} />

      {openGoal && (
        <GoalDetail
          goal={openGoal}
          actions={actionsOf(openGoal.id)}
          appts={apptsOf(openGoal.id)}
          onUpdate={(patch) => updateGoal(openGoal.id, patch)}
          onRemove={() => removeGoal(openGoal.id)}
          onClose={() => setOpenId(null)}
          onAddAction={(title) => add(blankActivity('protocol', { title, category: 'wellness', frequency: 'daily', timeOfDay: ['morning'], details: { goalId: openGoal.id, block: 'morning', categoryFields: {} } }))}
          onAddAppt={(title, date, time) => add(blankActivity('event', { title, category: 'personal', frequency: 'once', seriesStart: date || tKey, details: { goalId: openGoal.id, time: time || '', partOfDay: partFromTime(time), description: '', attendees: '', durationMinutes: '' } }))}
          onToggleAction={(id) => toggleComplete(id, tKey)}
          onRemoveLinked={(id) => remove(id)}
        />
      )}
    </section>
  )
}

function StatTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-cream/50 p-5">
      <div className="mb-3 flex items-center gap-2 text-stone-400">
        <Icon size={15} strokeWidth={1.75} />
        <span className="kicker">{label}</span>
      </div>
      <p className="font-serif text-3xl leading-none text-stone-900">{value}</p>
      {sub && <p className="mt-1.5 truncate text-xs text-stone-400">{sub}</p>}
    </div>
  )
}

// Small progress ring — milestones reached.
function Ring({ pct, size = 44 }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E7E5E4" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1C1C1A" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
    </svg>
  )
}

function GoalCard({ goal, actions, appts, onOpen }) {
  const total = goal.milestones.length
  const done = goal.milestones.filter((m) => m.done).length
  const pct = total ? done / total : 0
  const d = daysUntil(goal.targetDate)
  return (
    <button onClick={onOpen} className="group w-full rounded-2xl border border-stone-200 bg-white/50 p-4 text-left transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <Ring pct={pct} />
          <span className="absolute text-[10px] font-medium text-stone-600">{Math.round(pct * 100)}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg text-stone-900">{goal.title || 'Untitled goal'}</p>
          <p className="mt-0.5 kicker text-stone-400">
            {total ? `${done}/${total} milestones` : 'no milestones'}
            {actions.length ? ` · ${actions.length} action${actions.length > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-stone-300 transition-colors group-hover:text-stone-600" />
      </div>
      {(goal.targetDate || appts.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          {goal.targetDate && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] ${d != null && d < 0 ? 'bg-phase-menstrual/10 text-phase-menstrual' : 'bg-stone-100 text-stone-500'}`}>
              {d != null && d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'due today' : `${d}d to target`}
            </span>
          )}
          {appts.length > 0 && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-500">{appts.length} appt{appts.length > 1 ? 's' : ''}</span>}
        </div>
      )}
    </button>
  )
}

function Achieved({ goals, onOpen }) {
  if (!goals.length) return null
  return (
    <div className="mt-12 border-t border-stone-200 pt-6">
      <p className="kicker mb-3 text-stone-400">Achieved · {goals.length}</p>
      <div className="flex flex-wrap gap-2">
        {goals.map((g) => (
          <button key={g.id} onClick={() => onOpen(g.id)} className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3.5 py-1.5 text-sm text-stone-500 transition-colors hover:border-stone-400">
            <CheckCircle2 size={13} className="text-stone-400" /> <span className="line-through">{g.title || 'Untitled'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function GoalDetail({ goal, actions, appts, onUpdate, onRemove, onClose, onAddAction, onAddAppt, onToggleAction, onRemoveLinked }) {
  const [msDraft, setMsDraft] = useState('')
  const [actDraft, setActDraft] = useState('')
  const [apptDraft, setApptDraft] = useState({ title: '', date: '', time: '' })

  const setMs = (id, patch) => onUpdate({ milestones: goal.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const addMs = () => { const t = msDraft.trim(); if (!t) return; onUpdate({ milestones: [...goal.milestones, { id: uid(), title: t, targetDate: '', done: false }] }); setMsDraft('') }
  const removeMs = (id) => onUpdate({ milestones: goal.milestones.filter((m) => m.id !== id) })
  const addAction = () => { const t = actDraft.trim(); if (!t) return; onAddAction(t); setActDraft('') }
  const addAppt = () => { const t = apptDraft.title.trim(); if (!t) return; onAddAppt(t, apptDraft.date, apptDraft.time); setApptDraft({ title: '', date: '', time: '' }) }

  const tKey = todayKey()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-cream shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <input
            value={goal.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Name the goal"
            autoFocus
            className="w-full bg-transparent font-serif text-2xl text-stone-900 placeholder-stone-300 outline-none"
          />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="max-h-[70vh] space-y-7 overflow-y-auto px-6 py-6">
          {/* Vision */}
          <textarea
            value={goal.vision}
            onChange={(e) => onUpdate({ vision: e.target.value })}
            placeholder="Why this matters — the vision…"
            rows={2}
            className="w-full resize-none rounded-xl bg-stone-500/5 px-4 py-3 text-sm leading-relaxed text-stone-700 placeholder-stone-400 outline-none"
          />

          {/* Phase + target */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {PHASES.map((p) => (
                <button key={p.id} onClick={() => onUpdate({ phase: p.id })} className={`rounded-full px-3.5 py-1.5 text-xs border transition-colors ${goal.phase === p.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{p.label}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-500">
              <span className="kicker text-stone-400">Target</span>
              <input type="date" value={goal.targetDate} onChange={(e) => onUpdate({ targetDate: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
            </label>
          </div>

          {/* Milestones */}
          <div>
            <p className="kicker mb-2 text-stone-400">Milestones</p>
            <div className="space-y-1">
              {goal.milestones.map((m) => (
                <div key={m.id} className="group flex items-center gap-3">
                  <Checkbox checked={m.done} onClick={() => setMs(m.id, { done: !m.done })} />
                  <input value={m.title} onChange={(e) => setMs(m.id, { title: e.target.value })} className={`flex-1 bg-transparent text-sm outline-none ${m.done ? 'text-stone-400 line-through' : 'text-stone-800'}`} />
                  <input type="date" value={m.targetDate} onChange={(e) => setMs(m.id, { targetDate: e.target.value })} className="bg-transparent text-xs text-stone-400 outline-none" />
                  <button onClick={() => removeMs(m.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={13} /></button>
                </div>
              ))}
            </div>
            <input value={msDraft} onChange={(e) => setMsDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMs()} placeholder="Add a milestone…" className="mt-2 w-full bg-transparent border-b border-stone-200 pb-1 text-sm outline-none focus:border-stone-900" />
          </div>

          {/* Actions — linked into the planner */}
          <div>
            <p className="kicker mb-1 text-stone-400">Actions</p>
            <p className="mb-2 text-xs italic text-stone-400">These land in your planner (Today &amp; the calendars).</p>
            <div className="space-y-1">
              {actions.map((a) => (
                <div key={a.id} className="group flex items-center gap-3">
                  <Checkbox checked={isDoneOn(a, tKey)} onClick={() => onToggleAction(a.id)} />
                  <span className={`flex-1 text-sm ${isDoneOn(a, tKey) ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{a.title}</span>
                  <button onClick={() => onRemoveLinked(a.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={13} /></button>
                </div>
              ))}
            </div>
            <input value={actDraft} onChange={(e) => setActDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addAction()} placeholder="Add an action…" className="mt-2 w-full bg-transparent border-b border-stone-200 pb-1 text-sm outline-none focus:border-stone-900" />
          </div>

          {/* Appointments — linked events */}
          <div>
            <p className="kicker mb-2 text-stone-400">Appointments</p>
            <div className="space-y-1">
              {appts.map((a) => (
                <div key={a.id} className="group flex items-center gap-3">
                  <CalendarClock size={14} className="text-stone-400" />
                  <span className="flex-1 text-sm text-stone-800">{a.title}</span>
                  <span className="text-xs text-stone-400">{a.seriesStart ? shortDate(a.seriesStart) : ''}{a.details?.time ? ` · ${a.details.time}` : ''}</span>
                  <button onClick={() => onRemoveLinked(a.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={apptDraft.title} onChange={(e) => setApptDraft((p) => ({ ...p, title: e.target.value }))} placeholder="Appointment…" className="flex-1 bg-transparent border-b border-stone-200 pb-1 text-sm outline-none focus:border-stone-900" />
              <input type="date" value={apptDraft.date} onChange={(e) => setApptDraft((p) => ({ ...p, date: e.target.value }))} className="bg-transparent border-b border-stone-200 pb-1 text-xs text-stone-500 outline-none focus:border-stone-900" />
              <input type="time" value={apptDraft.time} onChange={(e) => setApptDraft((p) => ({ ...p, time: e.target.value }))} className="bg-transparent border-b border-stone-200 pb-1 text-xs text-stone-500 outline-none focus:border-stone-900" />
              <button onClick={addAppt} className="rounded-full bg-stone-900 px-4 py-1.5 text-sm text-cream hover:bg-stone-700">Add</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          <button onClick={onRemove} className="text-sm text-stone-400 hover:text-phase-menstrual">Delete goal</button>
          <button onClick={() => onUpdate({ status: goal.status === 'done' ? 'active' : 'done' })} className={`rounded-full px-5 py-2 text-sm transition-colors ${goal.status === 'done' ? 'border border-stone-300 text-stone-600 hover:border-stone-500' : 'bg-stone-900 text-cream hover:bg-stone-700'}`}>
            {goal.status === 'done' ? 'Reopen' : 'Mark achieved'}
          </button>
        </div>
      </div>
    </div>
  )
}
