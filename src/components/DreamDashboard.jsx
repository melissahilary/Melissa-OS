import React, { useState, useEffect } from 'react'
import { Target, Sparkles, Calendar, ListChecks, FolderKanban, Image as ImageIcon } from 'lucide-react'
import { AddIcon, CloseIcon, LoggedIcon, NextIcon } from './shared/marks'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useActivities } from '../hooks/useActivities'
import { blankActivity, isDoneOn, activityOccursOn } from '../lib/activities'
import { dateKey, parseKey, addDays, MONTHS, MONTHS_SHORT, DOW_LONG } from '../lib/date'
import Checkbox from './shared/Checkbox'
import ActivityForm from './shared/ActivityForm'
import { routeStepToSection } from '../lib/goalRoutes'
import DreamBoard from './DreamBoard'
import { phaseForConfig } from '../lib/cycle'
import { useLifeStage, LIFE_STAGES } from '../lib/lifeStage'
import { isoWeek } from '../lib/week'
import DreamWeek from './DreamWeek'
import DreamProjects from './DreamProjects'
import DreamCollections from './DreamCollections'
import AddInline from './shared/AddInline'
import * as store from '../lib/dataStore'
import { adherenceOf, trajectoryOf, evidenceOf, recruitsFor } from '../lib/goalSignals'
import { BY_ID } from '../lib/biomarkers'

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

// The columns name a horizon rather than an attitude. "On deck" says nothing
// about when; six to twelve months does, and it is the thing she is actually
// deciding when she drags a goal across.
const PHASES = [
  { id: 'now', label: 'Now', note: 'Next 6 months' },
  { id: 'next', label: 'Next', note: '6–12 months' },
  { id: 'later', label: 'Later', note: 'Beyond a year' },
]
const HEALTH = { on: { c: '#7C8B6B', label: 'On track' }, risk: { c: '#B0873F', label: 'At risk' }, stall: { c: '#A0654C', label: 'Stalled' } }

const todayKey = () => dateKey(new Date())
const daysAgoKey = (n) => dateKey(addDays(new Date(), -n))
const daysUntil = (key) => (key ? Math.round((parseKey(key).getTime() - parseKey(todayKey()).getTime()) / 86400000) : null)
const fmtShort = (key) => { if (!key) return ''; const d = parseKey(key); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}` }

const normMilestone = (m) => ({ id: m.id || uid(), title: m.title || '', done: !!m.done, target: m.target || '' })
const normGoal = (g) => {
  if (typeof g === 'string') return { id: uid(), title: g, vision: '', pillar: 'mindset', phase: 'now', target: '', status: 'active', milestones: [], tags: [], notes: [], links: [] }
  return {
    id: g.id || uid(),
    title: g.title != null ? g.title : (g.text || ''),
    vision: g.vision || '',
    pillar: PILLARS[g.pillar] ? g.pillar : 'mindset',
    phase: ['now', 'next', 'later'].includes(g.phase) ? g.phase : 'now',
    target: g.target || g.targetDate || '',
    status: g.status || (g.done ? 'achieved' : 'active'),
    milestones: Array.isArray(g.milestones) ? g.milestones.map(normMilestone) : [],
    tags: Array.isArray(g.tags) ? g.tags : [],
    notes: Array.isArray(g.notes) ? g.notes : [], // { id, text, date } — the comment log
    links: Array.isArray(g.links) ? g.links : [], // { id, label, url } — attachments-lite
    evidence: g.evidence && typeof g.evidence === 'object' ? g.evidence : {}, // { marker }
    achievedOn: g.achievedOn || '',
    stages: Array.isArray(g.stages) ? g.stages : [], // empty = every stage
  }
}
const msDone = (m) => !!m.done

// A goal's steps live in the planner, tagged by goalId; group them by milestone.
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

export default function DreamDashboard({ cycleConfig = {} }) {
  const [rawGoals, setRawGoals] = useLocalStorage('mos:dream:goals', [])
  const goals = (Array.isArray(rawGoals) ? rawGoals : []).map(normGoal)
  const { activities, add, update, remove, toggleComplete } = useActivities()
  const { flags: lifeFlags, stage } = useLifeStage()
  const [openId, setOpenId] = useState(null)
  const [openMs, setOpenMs] = useState(() => new Set())
  const [ai, setAi] = useState(null) // { goalId, status:'loading'|'ready'|'error', plan }
  const [dragId, setDragId] = useState(null)
  const [tab, setTab] = useState('week')
  const [goalView, setGoalView] = useState('board') // board | timeline | metrics
  const [boardFilter, setBoardFilter] = useState(null) // a pillar id, from tapping a metrics bar
  const [editItem, setEditItem] = useState(null) // a week item opened from This Week

  const setGoals = (updater) => setRawGoals((prev) => {
    const cur = (Array.isArray(prev) ? prev : []).map(normGoal)
    return typeof updater === 'function' ? updater(cur) : updater
  })
  const updateGoal = (id, patch) => setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const addGoalIn = (phase, title) => {
    const t = (title || '').trim()
    if (!t) return
    setGoals((p) => [...p, { id: uid(), title: t, vision: '', pillar: 'mindset', phase, target: '', status: 'active', milestones: [] }])
  }
  const addGoal = () => { const g = { id: uid(), title: '', vision: '', pillar: 'mindset', phase: 'now', target: '', status: 'active', milestones: [] }; setGoals((p) => [...p, g]); openGoal(g.id) }
  const removeGoal = (id) => { setGoals((p) => p.filter((g) => g.id !== id)); activities.filter((a) => a.details && a.details.goalId === id).forEach((a) => remove(a.id)); setOpenId(null) }

  const stepsOf = (goalId) => activities.filter((a) => a.details && a.details.goalId === goalId && a.status !== 'archived')
  // A routed step lives twice on purpose: as a planner activity (checkable, on
  // Today/Schedule) AND as a record in its pillar section's own page.
  const addStep = (goalId, milestoneId, s) => {
    add(stepActivity(goalId, milestoneId, s))
    routeStepToSection({ pillar: s.pillar, kind: s.kind, title: s.title, goalId })
  }
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
  const active = goals.filter((g) => g.status !== 'achieved' && (!g.stages.length || g.stages.includes(stage)))
  const withHealth = active.map((g) => ({ g, h: healthOf(g, stepsOf(g.id)) }))
  const on = withHealth.filter((x) => x.h === 'on').length
  const attn = withHealth.length - on
  const achieved = goals.filter((g) => g.status === 'achieved')
  const openGoalObj = goals.find((g) => g.id === openId) || null

  const now = new Date()

  // The state line's other two readings. Projects live in their own store, and
  // the phase only belongs on the line for the stages that actually have one.
  const projectsRaw = useLocalStorage('mos:dream:projects', [])[0]
  const movingProjects = (Array.isArray(projectsRaw) ? projectsRaw : []).filter((p) => p.status !== 'done').length
  const statePhase = lifeFlags.phases ? phaseForConfig(cycleConfig, now) : null
  const [labRecord] = useLocalStorage('mos:labs', { markers: {}, readings: [] })
  const [boardRaw] = useLocalStorage('mos:dream:board', { template: 'scrapbook', items: [] })
  const boardItems = (boardRaw && Array.isArray(boardRaw.items) ? boardRaw.items : []).filter((it) => it.goalId)

  // The board's pictures live in private storage, so a goal card showing what
  // she pinned needs them signed first.
  const [boardUrls, setBoardUrls] = useState({})
  useEffect(() => {
    let alive = true
    const missing = boardItems.filter((it) => it.path && !boardUrls[it.path]).map((it) => it.path)
    if (!missing.length) return undefined
    ;(async () => {
      const pairs = await Promise.all([...new Set(missing)].map(async (pth) => [pth, await store.signedPhotoUrl(pth)]))
      if (alive) setBoardUrls((prev) => ({ ...prev, ...Object.fromEntries(pairs.filter(([, u]) => u)) }))
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardItems.map((it) => it.path).join(',')])

  const imagesForGoal = (gid) => boardItems
    .filter((it) => it.goalId === gid)
    .map((it) => ({ id: it.id, url: it.dataUrl || boardUrls[it.path] || '' }))
    .filter((x) => x.url)

  // Adherence — the leading indicator, and the only honest one: of the protocols
  // that came due this last week, how many actually got ticked. Read straight
  // off what she checked on the home page, across every pillar.
  const adherence = (() => {
    const days = Array.from({ length: 7 }, (_, i) => dateKey(addDays(now, -i)))
    let due = 0
    let met = 0
    activities.forEach((a) => {
      if (a.status === 'archived' || a.type !== 'protocol') return
      days.forEach((dk) => {
        if (!activityOccursOn(a, dk)) return
        due += 1
        if (isDoneOn(a, dk)) met += 1
      })
    })
    return due ? Math.round((met / due) * 100) : null
  })()

  const TABS = [
    { id: 'week', label: 'This Week', icon: ListChecks },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'board', label: 'Mood Board', icon: ImageIcon },
    { id: 'collections', label: 'Wishlist', icon: Sparkles },
  ]

  return (
    <section>
      <Header
        goalCount={active.length}
        projectCount={movingProjects}
        phase={statePhase}
        cycleLength={Number(cycleConfig && cycleConfig.cycleLength) || 28}
        fertile={lifeFlags.fertile}
        adherence={adherence}
      />

      {/* section tabs */}
      <div className="no-scrollbar mb-8 flex items-center justify-center gap-1.5 overflow-x-auto">
        {TABS.map((t) => {
          const active2 = tab === t.id
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors ${active2 ? 'bg-stone-900 text-cream' : 'text-stone-500 hover:bg-stone-500/5'}`}>
              <Icon size={14} strokeWidth={1.75} />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'week' && (
        <DreamWeek
          activities={activities}
          add={add}
          update={update}
          toggleComplete={toggleComplete}
          onOpenItem={setEditItem}
          cycleConfig={cycleConfig}
          goals={active}
          projects={Array.isArray(projectsRaw) ? projectsRaw : []}
          phases={lifeFlags.phases}
        />
      )}
      {tab === 'projects' && <DreamProjects goals={active} />}
      {tab === 'board' && (
        <DreamBoard
          goals={active}
          activities={activities}
          onCreateGoal={(title) => {
            const g = { id: uid(), title, vision: '', pillar: 'mindset', phase: 'now', target: '', status: 'active', milestones: [] }
            setGoals((p) => [...p, g])
            return g
          }}
        />
      )}
      {tab === 'collections' && <DreamCollections goals={active} projects={Array.isArray(projectsRaw) ? projectsRaw : []} />}
      {tab === 'goals' && (
        <>
          <div className="mb-7 flex items-center justify-between">
            {/* View switcher — the same goals, three readings */}
            <div className="inline-flex rounded-full border border-stone-200 bg-cream p-0.5">
              {[['board', 'Board'], ['timeline', 'Timeline']].map(([id, label]) => (
                <button key={id} onClick={() => setGoalView(id)} className={`rounded-full px-4 py-1.5 text-xs transition-colors ${goalView === id ? 'bg-stone-900 text-cream' : 'text-stone-500 hover:text-stone-800'}`}>{label}</button>
              ))}
            </div>
            <button onClick={addGoal} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-colors hover:bg-stone-700"><AddIcon size={15} strokeWidth={1.75} /> New goal</button>
          </div>

          {goalView === 'timeline' && <GoalTimeline goals={active} onOpen={openGoal} />}

          {goalView === 'board' && boardFilter && (
            <div className="mb-4 flex justify-center">
              <button onClick={() => setBoardFilter(null)} className="flex items-center gap-2 rounded-full border border-stone-900 bg-stone-900 px-4 py-1.5 text-xs text-cream transition-colors hover:bg-stone-700">
                {pillarMeta(boardFilter).label} only <CloseIcon size={12} />
              </button>
            </div>
          )}
          {goalView === 'board' && (
          <div className="grid gap-6 md:grid-cols-3">
            {PHASES.map((ph) => {
              const inp = active.filter((g) => g.phase === ph.id && (!boardFilter || g.pillar === boardFilter))
              return (
                <div key={ph.id} onDragOver={(e) => { e.preventDefault() }} onDrop={() => { if (dragId) { updateGoal(dragId, { phase: ph.id }); setDragId(null) } }}>
                  <div className="mb-3 border-b border-stone-200 pb-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] tracking-[0.18em] text-stone-900">{ph.label.toUpperCase()}</span>
                      <span className="text-[11px] tabular-nums text-stone-400">{inp.length}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-stone-500">{ph.note}</p>
                  </div>
                  <div className="min-h-[60px] space-y-3">
                    {inp.map((g) => (
                      <GoalCard
                        key={g.id}
                        goal={g}
                        steps={stepsOf(g.id)}
                        projects={Array.isArray(projectsRaw) ? projectsRaw : []}
                        images={imagesForGoal(g.id)}
                        labRecord={labRecord}
                        onOpen={() => openGoal(g.id)}
                        onDragStart={() => setDragId(g.id)}
                        onDragEnd={() => setDragId(null)}
                      />
                    ))}
                    {/* Write it into the horizon it belongs to. Enter makes it a
                        card and stops — the details are behind the card, for
                        whenever she wants them, rather than a form in the way. */}
                    <AddInline onSubmit={(title) => addGoalIn(ph.id, title)} className="mt-1" />
                  </div>
                </div>
              )
            })}
          </div>
          )}
          {goalView === 'board' && achieved.length > 0 && (
            <div className="mt-10 border-t border-stone-200 pt-6">
              <p className="kicker mb-3 text-stone-400">Achieved · {achieved.length}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {achieved.map((g) => {
                  const ev = evidenceOf(g, labRecord)
                  return (
                    <button key={g.id} onClick={() => openGoal(g.id)} className="flex items-start gap-2.5 rounded-2xl border border-stone-200 p-3 text-left transition-colors hover:border-stone-400">
                      <LoggedIcon size={14} className="mt-0.5 shrink-0" style={{ color: HEALTH.on.c }} />
                      <span className="min-w-0">
                        <span className="block truncate font-serif text-base text-stone-700">{g.title || 'Untitled'}</span>
                        <span className="block text-[11px] tabular-nums text-stone-400">
                          {g.achievedOn ? fmtShort(g.achievedOn) : ''}
                          {ev ? `${g.achievedOn ? ' · ' : ''}${ev.label} ${ev.first} → ${ev.last}` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
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
          labRecord={labRecord}
          stage={stage}
          onRecruit={(rows) => rows.forEach((r) => add(blankActivity('protocol', {
            title: r.title,
            category: pillarMeta(openGoalObj.pillar).cat,
            frequency: r.cadence === 'once' ? 'once' : r.cadence,
            seriesStart: todayKey(),
            timeOfDay: ['morning'],
            details: { goalId: openGoalObj.id, section: '', pillarId: openGoalObj.pillar, block: 'morning', categoryFields: {} },
          })))}
        />
      )}

      {/* Tap a This Week item → its full editor, right here. */}
      {editItem && (
        <ActivityForm
          activity={editItem}
          isNew={false}
          onSave={(a) => { update(a.id, a); setEditItem(null) }}
          onDelete={() => { remove(editItem.id); setEditItem(null) }}
          onClose={() => setEditItem(null)}
        />
      )}
    </section>
  )
}

// The trajectory — weekly adherence as a line. Where a percentage bar says how
// much of a list is crossed off, this says whether the effort is holding.
function Trajectory({ points }) {
  const vals = points.filter((v) => v != null)
  if (vals.length < 2) return null
  const W = 88
  const H = 20
  const step = W / (points.length - 1)
  let d = ''
  points.forEach((v, i) => {
    if (v == null) return
    const x = i * step
    const y = H - 2 - (v / 100) * (H - 4)
    d += `${d ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  })
  const lastIdx = points.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).pop()
  const lastV = points[lastIdx]
  return (
    <svg width={W} height={H} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="#A8A29E" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastIdx * step} cy={H - 2 - (lastV / 100) * (H - 4)} r="2.2" fill="#1C1917" />
    </svg>
  )
}

function GoalCard({ goal, steps, projects = [], images = [], labRecord, onOpen, onDragStart, onDragEnd }) {
  const pl = pillarMeta(goal.pillar)
  const d = daysUntil(goal.target)
  const adh = adherenceOf(steps)
  const traj = trajectoryOf(steps)
  const ev = evidenceOf(goal, labRecord)
  const project = projects.find((p) => p.goalId === goal.id)

  return (
    <div role="button" tabIndex={0} draggable onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      title={goal.vision || undefined}
      className="w-full cursor-pointer rounded-2xl border border-stone-200 bg-white/50 p-4 text-left shadow-sm transition-shadow hover:shadow-md">

      <div className="flex items-start gap-3">
        <h3 className="min-w-0 flex-1 font-serif text-lg leading-snug text-stone-900">{goal.title || 'Untitled goal'}</h3>
        <Trajectory points={traj} />
      </div>

      {/* The two indicators, in the order they move. */}
      <p className="mt-2 text-[12px] tabular-nums text-stone-500">
        {adh ? <span>Adherence {adh.pct}%</span> : <span className="text-stone-400">No practices yet</span>}
        {ev && (
          <>
            <span className="mx-1.5 text-stone-300">·</span>
            <span>{ev.label} {ev.first} → {ev.last}</span>
          </>
        )}
      </p>

      {/* What the board is picturing, and the work it turned into. */}
      {images.length > 0 && (
        <div className="mt-3 flex gap-1">
          {images.slice(0, 4).map((im) => (
            <span key={im.id} className="h-10 w-10 overflow-hidden rounded-md bg-stone-100">
              <img src={im.url} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-600"><span className="h-1.5 w-1.5 rounded-full" style={{ background: pl.tint }} />{pl.label}</span>
        {steps.length > 0 && <span className="rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-500">{steps.length} practice{steps.length === 1 ? '' : 's'}</span>}
        {project && <span className="truncate rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-500">{project.name}</span>}
        {goal.target && <span className="rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-500">◷ {fmtShort(goal.target)}{d != null && d < 0 ? ` · ${Math.abs(d)}d over` : ''}</span>}
      </div>
    </div>
  )
}

function GoalPanel({ goal, steps, health, openMs, onToggleMsOpen, onUpdate, onClose, onRemove, onToggleStep, onRemoveStep, onAddStep, ai, onRunAI, onAcceptAI, onDismissAI, labRecord, onRecruit, stage }) {
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
          <button onClick={onClose} aria-label="Close" className="mt-1 text-stone-400 hover:text-stone-900"><CloseIcon size={20} /></button>
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

          {/* tags */}
          <TagEditor tags={goal.tags || []} onChange={(tags) => onUpdate({ tags })} />

          <GoalSignals goal={goal} steps={steps} labRecord={labRecord} onUpdate={onUpdate} onRecruit={onRecruit} stage={stage} />

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
                      {m.done ? <LoggedIcon size={13} strokeWidth={2.5} /> : mi + 1}
                    </button>
                    <button onClick={() => onToggleMsOpen(mi)} className="flex flex-1 items-center gap-2 text-left">
                      <span className={`flex-1 font-serif text-lg ${m.done ? 'text-stone-400' : 'text-stone-800'}`}>{m.title || 'Milestone'}</span>
                      <span className="text-[11px] tabular-nums text-stone-400">{mSteps.length ? `${sdone}/${mSteps.length}` : ''}</span>
                      <NextIcon size={15} className={`text-stone-300 transition-transform ${open ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                  {open && (
                    <div className="mb-2 ml-3 border-l border-stone-200 pl-5">
                      <div className="flex items-center gap-2 pb-1.5 text-[11px] text-stone-400">
                        <Calendar size={11} className="opacity-70" />
                        <input type="date" value={m.target || ''} onChange={(e) => setMilestone(m.id, { target: e.target.value })} className="bg-transparent text-[11px] text-stone-500 outline-none" aria-label="Milestone target date" />
                        <button onClick={() => removeMilestone(m.id)} className="ml-auto text-stone-300 hover:text-stone-600">remove</button>
                      </div>
                      {mSteps.map((a) => {
                        const P = pillarMeta(a.details?.pillarId)
                        return (
                          <div key={a.id} className="group flex items-center gap-3 py-1.5">
                            <Checkbox checked={isDoneOn(a, todayKey())} onClick={() => onToggleStep(a.id)} />
                            <span className={`flex-1 text-sm ${isDoneOn(a, todayKey()) ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{a.title}</span>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-stone-400" title={`${P.label} · ${a.details?.section || ''}`}><span className="h-2 w-2 rounded-full" style={{ background: P.tint }} />{a.details?.section || P.label}</span>
                            <button onClick={() => onRemoveStep(a.id)} aria-label="Remove step" className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><CloseIcon size={13} /></button>
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

          {/* links — attachments, the light way */}
          <LinksSection links={goal.links || []} onChange={(links) => onUpdate({ links })} />

          {/* the log — comments to your future self */}
          <NotesLog notes={goal.notes || []} onChange={(notes) => onUpdate({ notes })} />

          <div className="mt-7 flex items-center justify-between border-t border-stone-200 pt-4">
            <button onClick={onRemove} className="text-xs text-stone-400 hover:text-phase-menstrual">Delete goal</button>
            <button onClick={() => onUpdate(goal.status === 'achieved' ? { status: 'active', achievedOn: '' } : { status: 'achieved', achievedOn: todayKey() })}
              className={`rounded-full px-5 py-2 text-sm transition-colors ${goal.status === 'achieved' ? 'border border-stone-300 text-stone-600 hover:border-stone-500' : 'bg-stone-900 text-cream hover:bg-stone-700'}`}>
              {goal.status === 'achieved' ? 'Reopen' : 'Mark achieved'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

// ── The two indicators, and the machinery behind them ───────────────
// Recruiting is the join between intention and behaviour: a goal with no
// practices is a wish, and this is the one control that turns it into work the
// planner will actually ask for. Evidence is the other end — the number in the
// body the whole thing was for.
function GoalSignals({ goal, steps, labRecord, onUpdate, onRecruit, stage }) {
  const [proposing, setProposing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [keep, setKeep] = useState([])

  const adh = adherenceOf(steps)
  const ev = evidenceOf(goal, labRecord)
  const suggestions = recruitsFor(goal.pillar).filter((r) => !steps.some((a) => (a.title || '').toLowerCase() === r.title.toLowerCase()))

  const startProposing = () => { setKeep(suggestions.map((r) => r.title)); setProposing(true) }
  const accept = () => { onRecruit(suggestions.filter((r) => keep.includes(r.title))); setProposing(false) }

  const watched = Object.keys((labRecord && labRecord.markers) || {})

  return (
    <div className="mt-7 border-t border-stone-200 pt-5">
      <div className="flex items-baseline gap-3">
        <span className="kicker text-stone-400">Adherence</span>
        <span className="font-serif text-2xl text-stone-900 tabular-nums">{adh ? `${adh.pct}%` : '—'}</span>
        {adh && <span className="text-[11px] text-stone-400 tabular-nums">{adh.met} of {adh.due}, last 30 days</span>}
      </div>

      {steps.length === 0 && !proposing && (
        <button onClick={startProposing} className="mt-2 text-xs tracking-[0.12em] text-stone-900 underline underline-offset-4">
          RECRUIT PRACTICES
        </button>
      )}

      {proposing && (
        <div className="mt-3 rounded-xl border border-stone-300 p-3.5">
          <p className="mb-2 text-[12px] text-stone-500">These land in {pillarMeta(goal.pillar).label} and on your day, like any other protocol.</p>
          {suggestions.map((r) => {
            const on = keep.includes(r.title)
            return (
              <label key={r.title} className="flex cursor-pointer items-center gap-2.5 py-1">
                <input type="checkbox" checked={on} onChange={() => setKeep((k) => (on ? k.filter((x) => x !== r.title) : [...k, r.title]))} className="h-3.5 w-3.5 shrink-0 accent-stone-900" />
                <span className="flex-1 text-sm text-stone-800">{r.title}</span>
                <span className="text-[10px] tracking-[0.1em] text-stone-400">{r.cadence.toUpperCase()}</span>
              </label>
            )
          })}
          <div className="mt-3 flex items-center gap-3">
            <button onClick={accept} disabled={!keep.length} className="rounded-full bg-stone-900 px-4 py-1.5 text-xs text-cream disabled:opacity-30">Add {keep.length}</button>
            <button onClick={() => setProposing(false)} className="text-xs text-stone-400 hover:text-stone-700">Not now</button>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-baseline gap-3">
        <span className="kicker text-stone-400">Evidence</span>
        {ev ? (
          <span className="font-serif text-lg text-stone-900 tabular-nums">
            {ev.label} {ev.first} → {ev.last} <span className="text-xs text-stone-400">{ev.unit}</span>
          </span>
        ) : (
          <button onClick={() => setPicking((v) => !v)} className="text-xs tracking-[0.12em] text-stone-900 underline underline-offset-4">
            {picking ? 'CANCEL' : 'ATTACH A MARKER'}
          </button>
        )}
        {ev && <button onClick={() => onUpdate({ evidence: {} })} className="ml-auto text-[11px] text-stone-400 hover:text-stone-700">change</button>}
      </div>

      {picking && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(watched.length ? watched : ['ferritin', 'vitamin_d', 'hba1c', 'estradiol', 'tsh']).map((id) => (
            <button
              key={id}
              onClick={() => { onUpdate({ evidence: { marker: id } }); setPicking(false) }}
              className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream"
            >
              {(BY_ID[id] || {}).label || id}
            </button>
          ))}
          {!watched.length && <span className="w-full text-[11px] text-stone-400">Readings you keep in Testing → Results will appear here.</span>}
        </div>
      )}

      {/* A goal can belong to a stage of life and step aside when that stage
          passes, rather than being deleted or nagging from the wrong season. */}
      <div className="mt-5">
        <p className="kicker mb-1.5 text-stone-400">Belongs to</p>
        <div className="flex flex-wrap gap-1.5">
          {LIFE_STAGES.map((ls) => {
            const on = goal.stages.includes(ls.id)
            return (
              <button
                key={ls.id}
                onClick={() => onUpdate({ stages: on ? goal.stages.filter((x) => x !== ls.id) : [...goal.stages, ls.id] })}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500'}`}
              >
                {ls.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-stone-400">
          {goal.stages.length ? `Hidden outside these stages. You are ${stage}.` : 'Every stage.'}
        </p>
      </div>
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
                <LoggedIcon size={14} className="mt-0.5 shrink-0" style={{ color: HEALTH.on.c }} />
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

// ── The header ──
// Today already owns the date and the greeting; repeating them here made this
// read as a second homepage rather than the workspace it is. So: the section's
// name, and under it a state line — not prose, and not encouragement. Just the
// readings, including the zeroes.
function Header({ goalCount, projectCount, phase, cycleLength, fertile, adherence }) {
  const now = new Date()
  const mon = addDays(now, -((now.getDay() + 6) % 7))
  const sun = addDays(mon, 6)
  const span = mon.getMonth() === sun.getMonth()
    ? `${MONTHS_SHORT[mon.getMonth()].toUpperCase()} ${mon.getDate()}–${sun.getDate()}`
    : `${MONTHS_SHORT[mon.getMonth()].toUpperCase()} ${mon.getDate()}–${MONTHS_SHORT[sun.getMonth()].toUpperCase()} ${sun.getDate()}`

  const day = phase ? phase.cycleDay : null
  // The most-checked number in a woman's life, and absent from every planner
  // header ever built.
  const untilPeriod = day != null && cycleLength ? (cycleLength - day + 1) % cycleLength : null
  // The fertile window is roughly the five days before ovulation and the day of
  // it. Shown only where the life stage actually asks the question.
  const inFertile = fertile && day != null && day >= 10 && day <= 16

  const body = [
    day != null ? `DAY ${day}` : null,
    phase ? phase.name.toUpperCase() : null,
    inFertile ? 'FERTILE' : null,
    untilPeriod != null ? (untilPeriod === 0 ? 'PERIOD TODAY' : `PERIOD IN ${untilPeriod}`) : null,
  ].filter(Boolean)

  const work = [
    adherence != null ? `PROTOCOLS ${adherence}%` : null,
    `${projectCount} PROJECT${projectCount === 1 ? '' : 'S'}`,
    `${goalCount} GOAL${goalCount === 1 ? '' : 'S'}`,
  ].filter(Boolean)

  const Zone = ({ parts, className = '' }) => (
    <span className={`whitespace-nowrap text-[11px] tracking-[0.18em] text-stone-400 ${className}`}>{parts.join(' · ')}</span>
  )

  return (
    <div className="mb-9">
      <h1 className="text-center font-serif text-4xl text-stone-900 md:text-5xl">Becoming</h1>
      {/* Three readings, spread — the week, the body, the work. */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-1.5 sm:justify-between">
        <Zone parts={[`WEEK ${isoWeek(now)}`, span]} />
        {body.length > 0 && <Zone parts={body} className="text-stone-500" />}
        <Zone parts={work} />
      </div>
    </div>
  )
}

// ── Tags — light labels for filtering the mind, not bureaucracy ──
function TagEditor({ tags, onChange }) {
  const [v, setV] = useState('')
  const commit = () => { const t = v.trim().toLowerCase(); if (t && !tags.includes(t)) onChange([...tags, t]); setV('') }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="group inline-flex items-center gap-1 rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-600">
          {t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-stone-300 hover:text-stone-600"><CloseIcon size={10} /></button>
        </span>
      ))}
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() } }}
        onBlur={commit}
        placeholder={tags.length ? '+ tag' : '+ add a tag'}
        className="w-20 bg-transparent text-[11px] italic text-stone-400 outline-none placeholder:text-stone-300"
      />
    </div>
  )
}

// ── Links — reference material pinned to the goal (a URL is the lightest file) ──
function LinksSection({ links, onChange }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const add = () => {
    const u = url.trim()
    if (!u) return
    const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`
    onChange([...links, { id: uid(), label: label.trim() || u.replace(/^https?:\/\//i, '').slice(0, 40), url: withProto }])
    setLabel(''); setUrl('')
  }
  return (
    <div className="mt-7">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="kicker text-stone-400">Attached</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      {links.length > 0 && (
        <div className="space-y-1 pt-1">
          {links.map((l) => (
            <div key={l.id} className="group flex items-center gap-2.5 py-1">
              <span className="text-stone-300">↗</span>
              <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm text-stone-700 underline-offset-2 hover:underline">{l.label}</a>
              <button onClick={() => onChange(links.filter((x) => x.id !== l.id))} aria-label="Remove link" className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><CloseIcon size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Paste a link…" className="flex-1 bg-transparent border-b border-stone-200 pb-1 text-sm text-stone-700 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-400" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="name (optional)" className="w-28 bg-transparent border-b border-stone-200 pb-1 text-xs text-stone-500 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-400" />
      </div>
    </div>
  )
}

// ── The log — dated notes on the goal, newest first ──
function NotesLog({ notes, onChange }) {
  const [v, setV] = useState('')
  const add = () => {
    const t = v.trim()
    if (!t) return
    onChange([{ id: uid(), text: t, date: todayKey() }, ...notes])
    setV('')
  }
  return (
    <div className="mt-7">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="kicker text-stone-400">The log</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Leave a note on this goal…" className="mt-1 w-full bg-transparent border-b border-stone-200 pb-1.5 text-sm text-stone-800 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-400" />
      {notes.length > 0 && (
        <div className="mt-3 space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="group flex items-baseline gap-3">
              <span className="shrink-0 text-[11px] tabular-nums text-stone-400">{fmtShort(n.date)}</span>
              <p className="flex-1 text-sm leading-relaxed text-stone-700">{n.text}</p>
              <button onClick={() => onChange(notes.filter((x) => x.id !== n.id))} aria-label="Remove note" className="text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100"><CloseIcon size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Timeline — every dated goal and milestone on one horizon ──
function GoalTimeline({ goals, onOpen }) {
  const dated = goals
    .map((g) => ({ g, dates: [g.target, ...g.milestones.map((m) => m.target)].filter(Boolean) }))
    .filter((x) => x.dates.length)
  if (!dated.length) {
    return <p className="rounded-2xl border border-dashed border-stone-200 py-14 text-center font-serif italic text-lg text-stone-400">No target dates yet.<br /><span className="text-sm not-italic text-stone-400">Give a goal or milestone a date and it appears on the horizon.</span></p>
  }
  const all = dated.flatMap((x) => x.dates)
  const t0 = Math.min(parseKey(todayKey()).getTime(), ...all.map((d) => parseKey(d).getTime()))
  const t1 = Math.max(...all.map((d) => parseKey(d).getTime()), parseKey(todayKey()).getTime() + 86400000 * 14)
  const span = Math.max(1, t1 - t0)
  const xOf = (d) => ((parseKey(d).getTime() - t0) / span) * 100
  const todayX = ((parseKey(todayKey()).getTime() - t0) / span) * 100
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/40 p-6">
      <div className="relative">
        {/* today line */}
        <div className="absolute bottom-0 top-0 w-px bg-stone-900/60" style={{ left: `${todayX}%` }}>
          <span className="absolute -top-1 left-1.5 text-[10px] tracking-[0.12em] text-stone-500">TODAY</span>
        </div>
        <div className="space-y-5 pt-5">
          {dated.map(({ g }) => {
            const p = pct(g)
            const pl = pillarMeta(g.pillar)
            return (
              <button key={g.id} onClick={() => onOpen(g.id)} className="block w-full text-left">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="font-serif text-base text-stone-900">{g.title || 'Untitled'}</span>
                  <span className="text-[11px] tabular-nums text-stone-400">{p}%</span>
                </div>
                <div className="relative h-5">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-stone-200" />
                  {g.milestones.filter((m) => m.target).map((m) => (
                    <span key={m.id} title={`${m.title} · ${m.target}`} className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream" style={{ left: `${xOf(m.target)}%`, background: m.done ? '#1C1C1A' : '#C9C2B2' }} />
                  ))}
                  {g.target && (
                    <span title={`Target · ${g.target}`} className="absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center border-2 border-cream" style={{ left: `${xOf(g.target)}%`, background: pl.tint }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-5 border-t border-stone-100 pt-3 text-[11px] text-stone-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-stone-300" /> milestone</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-stone-900" /> reached</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45" style={{ background: '#A0654C' }} /> goal target</span>
      </div>
    </div>
  )
}

