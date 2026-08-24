import React, { useState, useEffect } from 'react'
import { Plus, X, Check, ChevronRight, Target, Sparkles, Calendar } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useActivities } from '../hooks/useActivities'
import { blankActivity, isDoneOn } from '../lib/activities'
import { dateKey, parseKey, addDays, MONTHS } from '../lib/date'
import Checkbox from './shared/Checkbox'

const uid = () => Math.random().toString(36).slice(2, 10)

// Pillars a goal's steps can route into. `cat` is the activity category, so a step
// lands in that pillar's Today / Weekly / Monthly natively.
const PILLARS = {
  skincare: { label: 'Skincare', tint: '#889072', cat: 'skincare' },
  aesthetics: { label: 'Aesthetics', tint: '#A0654C', cat: 'aesthetics' },
  fitness: { label: 'Fitness', tint: '#5A6B7B', cat: 'fitness' },
  hormones: { label: 'Hormones', tint: '#B08D45', cat: 'hormones' },
  nutrition: { label: 'Nutrition', tint: '#8C7A5F', cat: 'nutrition' },
  mindset: { label: 'Mindset', tint: '#8E7BA0', cat: 'mindset' },
  haircare: { label: 'Haircare', tint: '#9E7B5A', cat: 'haircare' },
  bodycare: { label: 'Bodycare', tint: '#6E8CA0', cat: 'bodycare' },
  brainhealth: { label: 'Brain Health', tint: '#7C6E9E', cat: 'brainhealth' },
  relationships: { label: 'Relationships', tint: '#B07A9A', cat: 'relationship' },
  spirituality: { label: 'Spirituality', tint: '#C4A76A', cat: 'spirituality' },
  diagnostics: { label: 'Diagnostics', tint: '#8A9BA8', cat: 'diagnostics' },
}
const pillarMeta = (id) => PILLARS[id] || PILLARS.mindset
const PILLAR_IDS = Object.keys(PILLARS)

const PHASES = [
  { id: 'now', label: 'Now', note: 'Working on' },
  { id: 'next', label: 'Next', note: 'On deck' },
  { id: 'later', label: 'Later', note: 'Someday' },
]
const HEALTH = { on: { c: '#7C8B6B', label: 'On track' }, risk: { c: '#B0873F', label: 'At risk' }, stall: { c: '#A0654C', label: 'Stalled' } }

const todayKey = () => dateKey(new Date())
const daysAgoKey = (n) => dateKey(addDays(new Date(), -n))
const daysUntil = (key) => (key ? Math.round((parseKey(key).getTime() - parseKey(todayKey()).getTime()) / 86400000) : null)
const fmtShort = (key) => { if (!key) return ''; const d = parseKey(key); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}` }

const normMilestone = (m) => ({ id: m.id || uid(), title: m.title || '', done: !!m.done })
const normGoal = (g) => {
  if (typeof g === 'string') return { id: uid(), title: g, vision: '', pillar: 'mindset', phase: 'now', target: '', status: 'active', milestones: [] }
  return {
    id: g.id || uid(),
    title: g.title != null ? g.title : (g.text || ''),
    vision: g.vision || '',
    pillar: PILLARS[g.pillar] ? g.pillar : 'mindset',
    phase: ['now', 'next', 'later'].includes(g.phase) ? g.phase : 'now',
    target: g.target || g.targetDate || '',
    status: g.status || (g.done ? 'achieved' : 'active'),
    milestones: Array.isArray(g.milestones) ? g.milestones.map(normMilestone) : [],
  }
}
const msDone = (m) => !!m.done
const pct = (g) => (g.milestones.length ? Math.round(g.milestones.filter(msDone).length / g.milestones.length * 100) : 0)

// A goal's steps live in the planner, tagged by goalId; group them by milestone.
function everDone(a) { return !!(a.completions && Object.keys(a.completions).length) }
function healthOf(g, steps) {
  const done = g.milestones.filter(msDone).length, tot = g.milestones.length
  if (g.target && g.target < todayKey() && done < tot) return 'stall'
  const recent = steps.some((a) => Object.keys(a.completions || {}).some((k) => k >= daysAgoKey(14)))
  if (tot > 0 && done < tot && steps.length > 0 && !recent) return 'risk'
  if (g.target) { const d = daysUntil(g.target); if (d != null && d >= 0 && d < 30 && tot > 0 && done / tot < 0.5) return 'risk' }
  return 'on'
}

// Build a real planner activity for a goal step, routed to its pillar + section.
function stepActivity(goalId, milestoneId, s) {
  const P = pillarMeta(s.pillar)
  const details = { goalId, milestoneId, section: s.section || '', pillarId: s.pillar }
  if (['appointment', 'lab', 'treatment'].includes(s.kind)) {
    return blankActivity('event', { title: s.title, category: P.cat, frequency: 'once', seriesStart: todayKey(), details: { ...details, partOfDay: 'morning', description: '', attendees: '', durationMinutes: '' } })
  }
  const frequency = s.cadence === 'weekly' ? 'weekly' : s.cadence === 'daily' ? 'daily' : 'asneeded'
  return blankActivity('protocol', { title: s.title, category: P.cat, frequency, timeOfDay: ['morning'], details: { ...details, block: 'morning', categoryFields: {} } })
}

function Ring({ p, size = 46 }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E7E2D6" strokeWidth="3.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1C1C1A" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
    </svg>
  )
}

export default function DreamDashboard() {
  const [rawGoals, setRawGoals] = useLocalStorage('mos:dream:goals', [])
  const goals = (Array.isArray(rawGoals) ? rawGoals : []).map(normGoal)
  const { activities, add, remove, toggleComplete } = useActivities()
  const [openId, setOpenId] = useState(null)
  const [openMs, setOpenMs] = useState(() => new Set())
  const [ai, setAi] = useState(null) // { goalId, status:'loading'|'ready'|'error', plan }
  const [dragId, setDragId] = useState(null)

  const setGoals = (updater) => setRawGoals((prev) => {
    const cur = (Array.isArray(prev) ? prev : []).map(normGoal)
    return typeof updater === 'function' ? updater(cur) : updater
  })
  const updateGoal = (id, patch) => setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const addGoal = () => { const g = { id: uid(), title: '', vision: '', pillar: 'mindset', phase: 'now', target: '', status: 'active', milestones: [] }; setGoals((p) => [...p, g]); openGoal(g.id) }
  const removeGoal = (id) => { setGoals((p) => p.filter((g) => g.id !== id)); activities.filter((a) => a.details && a.details.goalId === id).forEach((a) => remove(a.id)); setOpenId(null) }

  const stepsOf = (goalId) => activities.filter((a) => a.details && a.details.goalId === goalId && a.status !== 'archived')
  const addStep = (goalId, milestoneId, s) => add(stepActivity(goalId, milestoneId, s))
  const acceptPlan = (g, plan) => {
    const newMs = []
    plan.forEach((m) => { const mid = uid(); newMs.push({ id: mid, title: m.title, done: false }); m.steps.forEach((s) => addStep(g.id, mid, s)) })
    updateGoal(g.id, { milestones: [...g.milestones, ...newMs] })
    setAi(null)
  }

  const runAI = async (g) => {
    setAi({ goalId: g.id, status: 'loading' })
    try {
      const r = await fetch('/api/goal-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: g.title, why: g.vision, pillar: g.pillar }) })
      const data = await r.json()
      if (data && Array.isArray(data.milestones) && data.milestones.length) setAi({ goalId: g.id, status: 'ready', plan: data.milestones })
      else setAi({ goalId: g.id, status: 'error' })
    } catch (e) { setAi({ goalId: g.id, status: 'error' }) }
  }

  const openGoal = (id) => {
    setOpenId(id)
    const g = goals.find((x) => x.id === id)
    const next = new Set()
    if (g) { const cur = g.milestones.findIndex((m) => !msDone(m)); if (cur >= 0) next.add(cur) }
    setOpenMs(next); setAi(null)
  }
  const toggleMsOpen = (mi) => setOpenMs((s) => { const n = new Set(s); n.has(mi) ? n.delete(mi) : n.add(mi); return n })

  // ── stats ──
  const active = goals.filter((g) => g.status !== 'achieved')
  const withHealth = active.map((g) => ({ g, h: healthOf(g, stepsOf(g.id)) }))
  const on = withHealth.filter((x) => x.h === 'on').length
  const attn = withHealth.length - on
  const achieved = goals.filter((g) => g.status === 'achieved')
  const openGoalObj = goals.find((g) => g.id === openId) || null

  return (
    <section>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <p className="kicker text-stone-400">The board</p>
          <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">Life on track.</h2>
        </div>
        <button onClick={addGoal} className="flex shrink-0 items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-colors hover:bg-stone-700"><Plus size={15} strokeWidth={1.75} /> New goal</button>
      </div>

      {/* KPIs */}
      <div className="mb-9 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-stone-200 bg-cream/50 p-5">
          <div className="mb-3 flex items-center gap-2 text-stone-400"><Target size={15} strokeWidth={1.75} /><span className="kicker">Active goals</span></div>
          <p className="font-serif text-4xl leading-none text-stone-900 tabular-nums">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-cream/50 p-5">
          <div className="mb-3 flex items-center gap-2 text-stone-400"><Sparkles size={15} strokeWidth={1.75} /><span className="kicker">Momentum</span></div>
          <div className="flex items-baseline gap-5">
            <span className="flex items-baseline gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: HEALTH.on.c }} /><span className="font-serif text-3xl leading-none tabular-nums" style={{ color: HEALTH.on.c }}>{on}</span><span className="text-xs text-stone-400">on track</span></span>
            <span className="flex items-baseline gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: HEALTH.risk.c }} /><span className="font-serif text-3xl leading-none tabular-nums" style={{ color: HEALTH.risk.c }}>{attn}</span><span className="text-xs text-stone-400">need attention</span></span>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="grid gap-6 md:grid-cols-3">
        {PHASES.map((ph) => {
          const inp = active.filter((g) => g.phase === ph.id)
          return (
            <div key={ph.id}
              onDragOver={(e) => { e.preventDefault() }}
              onDrop={() => { if (dragId) { updateGoal(dragId, { phase: ph.id }); setDragId(null) } }}>
              <div className="mb-3 flex items-baseline justify-between border-b border-stone-200 pb-2">
                <span className="font-serif text-lg text-stone-800">{ph.label}</span>
                <span className="kicker text-stone-400">{inp.length} · {ph.note}</span>
              </div>
              <div className="min-h-[60px] space-y-3">
                {inp.map((g) => (
                  <GoalCard key={g.id} goal={g} steps={stepsOf(g.id)} onOpen={() => openGoal(g.id)} onDragStart={() => setDragId(g.id)} onDragEnd={() => setDragId(null)} />
                ))}
                {inp.length === 0 && <p className="py-6 text-center text-xs italic text-stone-300">Nothing here.</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Achieved */}
      {achieved.length > 0 && (
        <div className="mt-10 border-t border-stone-200 pt-6">
          <p className="kicker mb-3 text-stone-400">Achieved · {achieved.length}</p>
          <div className="flex flex-wrap gap-2">
            {achieved.map((g) => (
              <button key={g.id} onClick={() => openGoal(g.id)} className="flex items-center gap-2 rounded-full border border-stone-200 px-4 py-1.5 text-sm text-stone-500 transition-colors hover:border-stone-400">
                <Check size={13} style={{ color: HEALTH.on.c }} /><span className="font-serif text-base line-through">{g.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {openGoalObj && (
        <GoalPanel
          goal={openGoalObj}
          steps={stepsOf(openGoalObj.id)}
          health={healthOf(openGoalObj, stepsOf(openGoalObj.id))}
          openMs={openMs}
          onToggleMsOpen={toggleMsOpen}
          onUpdate={(patch) => updateGoal(openGoalObj.id, patch)}
          onClose={() => setOpenId(null)}
          onRemove={() => removeGoal(openGoalObj.id)}
          onToggleStep={(id) => toggleComplete(id, todayKey())}
          onRemoveStep={(id) => remove(id)}
          onAddStep={(mid, title) => addStep(openGoalObj.id, mid, { title, pillar: openGoalObj.pillar, section: 'Today', kind: 'action', cadence: 'once' })}
          ai={ai && ai.goalId === openGoalObj.id ? ai : null}
          onRunAI={() => runAI(openGoalObj)}
          onAcceptAI={(plan) => acceptPlan(openGoalObj, plan)}
          onDismissAI={() => setAi(null)}
        />
      )}
    </section>
  )
}

function GoalCard({ goal, steps, onOpen, onDragStart, onDragEnd }) {
  const p = pct(goal), h = HEALTH[healthOf(goal, steps)], pl = pillarMeta(goal.pillar)
  const done = goal.milestones.filter(msDone).length
  const d = daysUntil(goal.target)
  return (
    <div role="button" tabIndex={0} draggable onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      className="w-full cursor-pointer rounded-2xl border border-stone-200 bg-white/50 p-4 text-left shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <Ring p={p} />
          <span className="absolute text-[10px] font-medium text-stone-600 tabular-nums">{p}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-lg text-stone-900">{goal.title || 'Untitled goal'}</h3>
          <p className="kicker mt-0.5 text-stone-400">{goal.milestones.length ? `${done}/${goal.milestones.length} milestones` : 'needs a plan'}</p>
        </div>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.c, boxShadow: '0 0 0 3px var(--tw-ring-offset-color,#faf8f3)' }} title={h.label} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-600"><span className="h-1.5 w-1.5 rounded-full" style={{ background: pl.tint }} />{pl.label}</span>
        {goal.target && <span className="rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-500">◷ {fmtShort(goal.target)}{d != null && d < 0 ? ` · ${Math.abs(d)}d over` : ''}</span>}
        {!goal.milestones.length && <span className="rounded-full px-2.5 py-1 text-[11px] text-cream" style={{ background: HEALTH.risk.c }}>✦ plan it</span>}
      </div>
    </div>
  )
}

function GoalPanel({ goal, steps, health, openMs, onToggleMsOpen, onUpdate, onClose, onRemove, onToggleStep, onRemoveStep, onAddStep, ai, onRunAI, onAcceptAI, onDismissAI }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 10); return () => clearTimeout(t) }, [])
  useEffect(() => { const onEsc = (e) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc) }, [onClose])

  const pl = pillarMeta(goal.pillar), h = HEALTH[health]
  const done = goal.milestones.filter(msDone).length
  const stepsByMs = (mid) => steps.filter((a) => a.details && a.details.milestoneId === mid)

  const setMilestone = (id, patch) => onUpdate({ milestones: goal.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const addMilestone = (title) => onUpdate({ milestones: [...goal.milestones, { id: uid(), title, done: false }] })
  const removeMilestone = (id) => { stepsByMs(id).forEach((a) => onRemoveStep(a.id)); onUpdate({ milestones: goal.milestones.filter((m) => m.id !== id) }) }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity ${mounted ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside className={`relative flex h-full w-full max-w-[470px] flex-col border-l border-stone-200 bg-cream shadow-2xl transition-transform duration-300 ${mounted ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-start gap-3 border-b border-stone-200 px-6 py-5">
          <input value={goal.title} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Name the goal" autoFocus className="flex-1 bg-transparent font-serif text-2xl text-stone-900 placeholder-stone-300 outline-none" />
          <button onClick={onClose} aria-label="Close" className="mt-1 text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <input value={goal.vision} onChange={(e) => onUpdate({ vision: e.target.value })} placeholder="Why this matters — one line"
            className="w-full border-b border-transparent bg-transparent py-1 font-serif italic text-lg leading-snug text-stone-600 placeholder-stone-300 outline-none transition-colors hover:border-stone-200 focus:border-stone-400" />

          {/* calm meta line */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-stone-400">
            <PillarPicker value={goal.pillar} onChange={(v) => onUpdate({ pillar: v })} />
            <span className="h-3 w-px bg-stone-200" />
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-stone-600 hover:bg-stone-500/5">
              <Calendar size={13} className="opacity-70" />
              <input type="date" value={goal.target} onChange={(e) => onUpdate({ target: e.target.value })} className="cursor-pointer bg-transparent text-xs text-stone-600 outline-none" aria-label="Target date" />
            </label>
            <span className="h-3 w-px bg-stone-200" />
            <span className="inline-flex items-center gap-1.5 text-stone-600"><span className="h-2 w-2 rounded-full" style={{ background: h.c }} />{h.label}</span>
          </div>

          {/* path */}
          <div className="mt-7 mb-1 flex items-center gap-2.5">
            <span className="kicker text-stone-400">The path · {done}/{goal.milestones.length || 0} milestones</span>
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          {goal.milestones.length === 0 && (
            <p className="mt-2 text-sm italic text-stone-300">No plan yet — build the ladder below.</p>
          )}
          <div>
            {goal.milestones.map((m, mi) => {
              const mSteps = stepsByMs(m.id)
              const open = openMs.has(mi)
              const sdone = mSteps.filter((a) => isDoneOn(a, todayKey()) || everDone(a)).length
              return (
                <div key={m.id} className="border-b border-stone-100 last:border-b-0">
                  <div className="flex items-center gap-3 py-3">
                    <button onClick={() => setMilestone(m.id, { done: !m.done })} aria-label="Mark milestone reached"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-all"
                      style={m.done ? { background: '#1C1C1A', borderColor: '#1C1C1A', color: '#FAF8F3' } : { borderColor: '#D8D2C6', color: '#9A9488' }}>
                      {m.done ? <Check size={13} strokeWidth={2.5} /> : mi + 1}
                    </button>
                    <button onClick={() => onToggleMsOpen(mi)} className="flex flex-1 items-center gap-2 text-left">
                      <span className={`flex-1 font-serif text-lg ${m.done ? 'text-stone-400' : 'text-stone-800'}`}>{m.title || 'Milestone'}</span>
                      <span className="text-[11px] tabular-nums text-stone-400">{mSteps.length ? `${sdone}/${mSteps.length}` : ''}</span>
                      <ChevronRight size={15} className={`text-stone-300 transition-transform ${open ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                  {open && (
                    <div className="mb-2 ml-3 border-l border-stone-200 pl-5">
                      {mSteps.map((a) => {
                        const P = pillarMeta(a.details?.pillarId)
                        return (
                          <div key={a.id} className="group flex items-center gap-3 py-1.5">
                            <Checkbox checked={isDoneOn(a, todayKey())} onClick={() => onToggleStep(a.id)} />
                            <span className={`flex-1 text-sm ${isDoneOn(a, todayKey()) ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{a.title}</span>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-stone-400" title={`${P.label} · ${a.details?.section || ''}`}><span className="h-2 w-2 rounded-full" style={{ background: P.tint }} />{a.details?.section || P.label}</span>
                            <button onClick={() => onRemoveStep(a.id)} aria-label="Remove step" className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><X size={13} /></button>
                          </div>
                        )
                      })}
                      <StepAdd onAdd={(t) => onAddStep(m.id, t)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <MilestoneAdd onAdd={addMilestone} />

          {/* AI */}
          {ai ? (
            <AIPlan ai={ai} onAccept={onAcceptAI} onDismiss={onDismissAI} onRetry={onRunAI} />
          ) : (
            <button onClick={onRunAI} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white/40 px-4 py-3.5 text-sm font-medium text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900">
              <Sparkles size={16} /> {goal.milestones.length ? 'Extend the plan with AI' : 'Build the plan with AI'}
            </button>
          )}

          <div className="mt-7 flex items-center justify-between border-t border-stone-200 pt-4">
            <button onClick={onRemove} className="text-xs text-stone-400 hover:text-phase-menstrual">Delete goal</button>
            <button onClick={() => onUpdate({ status: goal.status === 'achieved' ? 'active' : 'achieved' })}
              className={`rounded-full px-5 py-2 text-sm transition-colors ${goal.status === 'achieved' ? 'border border-stone-300 text-stone-600 hover:border-stone-500' : 'bg-stone-900 text-cream hover:bg-stone-700'}`}>
              {goal.status === 'achieved' ? 'Reopen' : 'Mark achieved'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function PillarPicker({ value, onChange }) {
  const P = pillarMeta(value)
  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-stone-600 hover:bg-stone-500/5">
      <span className="h-2 w-2 rounded-full" style={{ background: P.tint }} />{P.label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Home pillar">
        {PILLAR_IDS.map((id) => <option key={id} value={id}>{PILLARS[id].label}</option>)}
      </select>
    </span>
  )
}

function StepAdd({ onAdd }) {
  const [v, setV] = useState('')
  const commit = () => { const t = v.trim(); if (t) { onAdd(t); setV('') } }
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} onBlur={commit}
      placeholder="+ add a step" className="mt-1 w-full bg-transparent py-1 text-sm italic text-stone-400 placeholder-stone-400 outline-none" />
  )
}
function MilestoneAdd({ onAdd }) {
  const [v, setV] = useState('')
  const commit = () => { const t = v.trim(); if (t) { onAdd(t); setV('') } }
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} onBlur={commit}
      placeholder="+ add a milestone" className="mt-2 w-full border-t border-dashed border-stone-200 bg-transparent pt-3 text-sm italic text-stone-400 placeholder-stone-400 outline-none" />
  )
}

function AIPlan({ ai, onAccept, onDismiss, onRetry }) {
  if (ai.status === 'loading') {
    return <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white/50 px-4 py-4 text-sm text-stone-500"><Sparkles size={15} className="animate-pulse" /> Building your plan…</div>
  }
  if (ai.status === 'error') {
    return (
      <div className="mt-3 rounded-xl border border-stone-200 bg-white/50 px-4 py-4 text-sm text-stone-500">
        <p>Couldn't reach the planner right now. Add milestones and steps by hand, or</p>
        <button onClick={onRetry} className="mt-1 text-stone-800 underline underline-offset-2 hover:text-stone-900">try again</button>.
      </div>
    )
  }
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white/60 shadow-sm">
      <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-500/5 px-4 py-3"><Sparkles size={15} className="text-stone-600" /><span className="kicker text-stone-600">Proposed path</span></div>
      <div className="px-4 py-2">
        {ai.plan.map((m, i) => (
          <div key={i} className="py-3 border-b border-stone-100 last:border-b-0">
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-stone-300 text-[11px] font-medium text-stone-500 tabular-nums">{i + 1}</span>
              <span className="font-serif text-base font-semibold text-stone-900">{m.title}</span>
            </div>
            {m.steps.map((s, j) => { const P = pillarMeta(s.pillar); return (
              <div key={j} className="flex items-start gap-2.5 py-1 pl-7.5" style={{ paddingLeft: '1.9rem' }}>
                <Check size={14} className="mt-0.5 shrink-0" style={{ color: HEALTH.on.c }} />
                <div className="min-w-0">
                  <div className="text-sm text-stone-800">{s.title}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-stone-400"><span className="h-2 w-2 rounded-full" style={{ background: P.tint }} /><span className="text-stone-500">{P.label}</span> · {s.section}</div>
                </div>
              </div>
            ) })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-stone-100 px-4 py-3">
        <button onClick={() => onAccept(ai.plan)} className="flex-1 rounded-full bg-stone-900 px-4 py-2.5 text-sm text-cream hover:bg-stone-700">Accept plan → send to planner</button>
        <button onClick={onDismiss} className="text-xs text-stone-400 hover:text-stone-700">Not now</button>
      </div>
    </div>
  )
}
