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
import { useLifeStage } from '../lib/lifeStage'
import { isoWeek } from '../lib/week'
import DreamWeek from './DreamWeek'
import DreamProjects from './DreamProjects'
import DreamCollections from './DreamCollections'
import AddInline from './shared/AddInline'
import EmptyState from './shared/EmptyState'
import * as store from '../lib/dataStore'
import { adherenceOf, trajectoryOf } from '../lib/goalSignals'

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

// ── The readings.
//
// The same goals, looked at four ways, because how she needs to see them
// changes with what she is doing. Columns to decide what belongs where; the
// wall to remember why; the list to scan; the timeline to see what is coming.
const VIEWS = [
  { id: 'columns', label: 'Columns', note: 'The three horizons, side by side' },
  { id: 'wall', label: 'Wall', note: 'Every goal as its picture' },
  { id: 'list', label: 'List', note: 'All of them, close together' },
  { id: 'timeline', label: 'Timeline', note: 'Everything with a date on it' },
]

// A horizon says roughly when. A date says exactly when. This filter is for the
// second question, and it never pretends an undated goal has an answer to it —
// "No date set" is a choice on the list rather than a silent exclusion.
const PERIODS = [
  { id: 'any', label: 'Any time' },
  { id: 'd30', label: '30 days' },
  { id: 'd90', label: '3 months' },
  { id: 'year', label: 'This year' },
  { id: 'none', label: 'No date' },
]

const todayKey = () => dateKey(new Date())
const daysAgoKey = (n) => dateKey(addDays(new Date(), -n))
const daysUntil = (key) => (key ? Math.round((parseKey(key).getTime() - parseKey(todayKey()).getTime()) / 86400000) : null)
const fmtShort = (key) => { if (!key) return ''; const d = parseKey(key); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}` }

// Overdue counts as near, not as gone: something a month late is the most
// "next thirty days" thing she owns.
const inPeriod = (g, id) => {
  if (id === 'any') return true
  if (id === 'none') return !g.target
  if (!g.target) return false
  const d = daysUntil(g.target)
  if (id === 'd30') return d != null && d <= 30
  if (id === 'd90') return d != null && d <= 92
  if (id === 'year') return String(g.target).slice(0, 4) === String(new Date().getFullYear())
  return true
}

const normMilestone = (m) => ({ id: (m && m.id) || uid(), title: (m && m.title) || '', done: !!(m && m.done), target: (m && m.target) || '' })

// Every goal that has ever been written is read through here, and it must be
// impossible for one of them to take the page down. A goal was once a bare
// string, and the string branch used to build its own object by hand — one that
// was missing `stages`, so the very first filter after it read `.length` of
// undefined and the whole of Becoming went white. One shape in, one shape out.
const normGoal = (raw) => {
  const g = typeof raw === 'string' ? { title: raw } : (raw && typeof raw === 'object' ? raw : {})
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
    achievedOn: g.achievedOn || '',
    stages: Array.isArray(g.stages) ? g.stages : [], // empty = every stage
  }
}
const msDone = (m) => !!m.done

// How far along the ladder is. Only meaningful once there is a ladder — a goal
// with no milestones is not 0% of anything, and saying so reads as a rebuke.
const msPct = (g) => (g.milestones.length ? Math.round((g.milestones.filter(msDone).length / g.milestones.length) * 100) : null)

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
  const [goalView, setGoalView] = useState('columns') // see VIEWS
  const [period, setPeriod] = useState('any')
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
  const achieved = goals.filter((g) => g.status === 'achieved')
  const openGoalObj = goals.find((g) => g.id === openId) || null

  const now = new Date()

  // Projects live in their own store; the phase only belongs on the state line
  // for the stages that actually have one.
  const projectsRaw = useLocalStorage('mos:dream:projects', [])[0]
  const statePhase = lifeFlags.phases ? phaseForConfig(cycleConfig, now) : null
  const [boardRaw, setBoardRaw] = useLocalStorage('mos:dream:board', { template: 'scrapbook', items: [] })
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
    .map((it) => ({ id: it.id, url: it.dataUrl || it.remote || boardUrls[it.path] || '', title: it.caption || it.title || '' }))
    .filter((x) => x.url)

  // Unpairing is the picture's business, so it writes the board, not the goal.
  // The photograph itself is never touched — it stays on the board, it simply
  // stops standing for this.
  const unpairImage = (imageId) => setBoardRaw((prev) => {
    const cur = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : { template: 'scrapbook', items: [] }
    const items = (Array.isArray(cur.items) ? cur.items : []).map((it) => (it && it.id === imageId ? { ...it, goalId: '' } : it))
    return { ...cur, items }
  })


  // One working set, so every reading is looking at the same goals.
  const inView = active.filter((g) => (!boardFilter || g.pillar === boardFilter) && inPeriod(g, period))
  const byHorizon = (a, b) => PHASES.findIndex((x) => x.id === a.phase) - PHASES.findIndex((x) => x.id === b.phase)

  const cardFor = (g, { dragging = false, plate = false } = {}) => (
    <GoalCard
      key={g.id}
      goal={g}
      steps={stepsOf(g.id)}
      projects={Array.isArray(projectsRaw) ? projectsRaw : []}
      images={imagesForGoal(g.id)}
      plate={plate}
      onOpen={() => openGoal(g.id)}
      onDragStart={dragging ? () => setDragId(g.id) : undefined}
      onDragEnd={dragging ? () => setDragId(null) : undefined}
    />
  )

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
        phase={statePhase}
        cycleLength={Number(cycleConfig && cycleConfig.cycleLength) || 28}
        fertile={lifeFlags.fertile}
      />

      {/* section tabs */}
      <div className="no-scrollbar mb-8 flex items-center justify-center gap-1.5 overflow-x-auto">
        {TABS.map((t) => {
          const active2 = tab === t.id
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors ${active2 ? 'bg-stone-900 text-cream' : 'text-stone-900 hover:bg-stone-500/5'}`}>
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {/* The same goals, four readings. */}
            <div className="inline-flex rounded-full border border-stone-200 bg-cream p-0.5">
              {VIEWS.map((v) => (
                <button key={v.id} onClick={() => setGoalView(v.id)} title={v.note}
                  className={`rounded-full px-4 py-1.5 text-xs transition-colors ${goalView === v.id ? 'bg-stone-900 text-cream' : 'text-stone-900 hover:bg-stone-500/5'}`}>{v.label}</button>
              ))}
            </div>
            <button onClick={addGoal} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-colors hover:bg-stone-700"><AddIcon size={15} strokeWidth={1.75} /> New goal</button>
          </div>

          {/* By when. Cuts across whichever reading she is in, and says what it
              is holding back rather than quietly shortening the board. */}
          <div className="mb-7 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="mr-1 text-[10px] tracking-[0.16em] text-stone-500">BY WHEN</span>
            {PERIODS.map((pd) => (
              <button key={pd.id} onClick={() => setPeriod(pd.id)}
                className={`rounded-full px-3 py-1 text-[11px] transition-colors ${period === pd.id ? 'bg-stone-900 text-cream' : 'text-stone-900 hover:bg-stone-500/5'}`}>{pd.label}</button>
            ))}
            {period !== 'any' && (
              <span className="ml-1 text-[11px] tabular-nums text-stone-500">{inView.length} of {active.length}</span>
            )}
          </div>

          {goalView === 'timeline' && <GoalTimeline goals={inView} onOpen={openGoal} />}

          {/* The wall. Horizon order, no headings — one continuous run of the
              life she is building, which is the whole reason the pictures are
              on the goals in the first place. */}
          {goalView === 'wall' && (
            inView.length === 0
              ? <EmptyState mark={Target} line="Nothing in this period." />
              : (
                <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {[...inView].sort(byHorizon).map((g) => cardFor(g, { plate: true }))}
                </div>
              )
          )}

          {goalView === 'list' && (
            inView.length === 0
              ? <EmptyState mark={Target} line="Nothing in this period." />
              : <GoalList goals={[...inView].sort(byHorizon)} imagesOf={imagesForGoal} stepsOf={stepsOf} onOpen={openGoal} />
          )}

          {goalView !== 'timeline' && boardFilter && (
            <div className="mb-4 flex justify-center">
              <button onClick={() => setBoardFilter(null)} className="flex items-center gap-2 rounded-full border border-stone-900 bg-stone-900 px-4 py-1.5 text-xs text-cream transition-colors hover:bg-stone-700">
                {pillarMeta(boardFilter).label} only <CloseIcon size={12} />
              </button>
            </div>
          )}
          {goalView === 'columns' && (
          <div className="grid gap-6 md:grid-cols-3">
            {PHASES.map((ph) => {
              const inp = inView.filter((g) => g.phase === ph.id)
              return (
                <div key={ph.id} onDragOver={(e) => { e.preventDefault() }} onDrop={() => { if (dragId) { updateGoal(dragId, { phase: ph.id }); setDragId(null) } }}>
                  {/* The horizon names the column from the right; the way in is
                      the rule under it. One line does the work of three. */}
                  <div className="mb-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px] tracking-[0.18em] text-stone-900">{ph.label.toUpperCase()}</span>
                      <span className="text-[11px] text-stone-500">{ph.note}</span>
                    </div>
                    {/* Write it into the horizon it belongs to. Enter makes it a
                        card and stops — the details are behind the card, for
                        whenever she wants them, rather than a form in the way. */}
                    <AddInline onSubmit={(title) => addGoalIn(ph.id, title)} className="mt-1.5" />
                  </div>
                  <div className="min-h-[60px] space-y-3">
                    {inp.map((g) => cardFor(g, { dragging: true }))}
                  </div>
                </div>
              )
            })}
          </div>
          )}
          {goalView !== 'timeline' && achieved.length > 0 && (
            <div className="mt-10 border-t border-stone-200 pt-6">
              <p className="kicker mb-3 text-stone-400">Achieved · {achieved.length}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {achieved.map((g) => (
                    <button key={g.id} onClick={() => openGoal(g.id)} className="flex items-start gap-2.5 rounded-2xl border border-stone-200 p-3 text-left transition-colors hover:border-stone-400">
                      <LoggedIcon size={14} className="mt-0.5 shrink-0" style={{ color: HEALTH.on.c }} />
                      <span className="min-w-0">
                        <span className="block truncate font-serif text-base text-stone-700">{g.title || 'Untitled'}</span>
                        <span className="block text-[11px] tabular-nums text-stone-400">{g.achievedOn ? fmtShort(g.achievedOn) : ''}</span>
                      </span>
                    </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {openGoalObj && (
        <GoalPanel
          goal={openGoalObj}
          steps={stepsOf(openGoalObj.id)}
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
          images={imagesForGoal(openGoalObj.id)}
          onUnpair={unpairImage}
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

// ── The veil.
//
// A photograph she chose can be anything — a white kitchen, a snow road, a
// bleached beach — and the name has to be readable on all of them, not on the
// ones that happen to be dark. So the darkening is not a taste decision to be
// nudged until it looks right: ivory type needs its background at or under 112
// of grey to clear 4.5:1, and 62% ink over a *pure white* photograph lands at
// 4.80:1. That is the floor. Anything less passes on some of her pictures and
// fails on others, which is the same as failing.
const VEIL = 'rgba(22, 19, 15, 0.62)'
const VEIL_FOOT = 'linear-gradient(to bottom, rgba(22,19,15,0) 45%, rgba(22,19,15,0.42) 100%)'
const ON_VEIL = '#FAF6ED'
const ON_VEIL_QUIET = '#E2DACB'

function GoalCard({ goal, steps, projects = [], images = [], onOpen, onDragStart, onDragEnd, plate = false }) {
  const d = daysUntil(goal.target)
  const adh = adherenceOf(steps)
  const traj = trajectoryOf(steps)
  const project = projects.find((p) => p.goalId === goal.id)
  const face = images[0]

  const meta = [
    adh ? `${adh.pct}%` : '',
    project ? project.name : '',
    goal.target ? `${fmtShort(goal.target)}${d != null && d < 0 ? ` · ${Math.abs(d)}d over` : ''}` : '',
  ].filter(Boolean)

  const hold = {
    role: 'button',
    tabIndex: 0,
    draggable: true,
    onClick: onOpen,
    onKeyDown: (e) => e.key === 'Enter' && onOpen(),
    onDragStart,
    onDragEnd,
    title: goal.vision || undefined,
  }

  // A goal she has given a picture is shown as the picture. The board stops
  // being three columns of text and becomes the thing she is building.
  if (face) {
    return (
      <div {...hold} className="relative w-full cursor-pointer overflow-hidden border border-stone-200 text-left">
        <div className="relative aspect-[4/5] w-full">
          <img src={face.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0" style={{ backgroundColor: VEIL }} />
          <span aria-hidden className="absolute inset-0" style={{ background: VEIL_FOOT }} />
          <div className="absolute inset-0 flex flex-col justify-end p-4">
            <h3 className="font-serif text-[21px] leading-[1.15]" style={{ color: ON_VEIL }}>
              {goal.title || 'Untitled goal'}
            </h3>
            {meta.length > 0 && (
              <p className="mt-1.5 text-[11px] tabular-nums" style={{ color: ON_VEIL_QUIET }}>{meta.join(' · ')}</p>
            )}
          </div>
          {images.length > 1 && (
            <span
              aria-label={`${images.length} pictures`}
              className="absolute right-2.5 top-2.5 px-1.5 py-0.5 text-[10px] tabular-nums"
              style={{ color: ON_VEIL, backgroundColor: 'rgba(22,19,15,0.55)' }}
            >{images.length}</span>
          )}
        </div>
      </div>
    )
  }

  // On the wall, a goal without a picture still holds its place in the grid —
  // an empty plate rather than a short card, so the rows stay level and the gap
  // reads as one waiting for its photograph.
  if (plate) {
    return (
      <div {...hold} className="relative w-full cursor-pointer overflow-hidden border border-stone-200 bg-white/40 text-left transition-colors hover:border-stone-400">
        <div className="relative flex aspect-[4/5] w-full flex-col justify-end p-4">
          <h3 className="font-serif text-[21px] leading-[1.15] text-stone-900">{goal.title || 'Untitled goal'}</h3>
          {meta.length > 0 && <p className="mt-1.5 text-[11px] tabular-nums text-stone-500">{meta.join(' · ')}</p>}
        </div>
      </div>
    )
  }

  // Until it has one, it is still its own words.
  return (
    <div {...hold} className="w-full cursor-pointer rounded-2xl border border-stone-200 bg-white/50 p-4 text-left shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <h3 className="min-w-0 flex-1 font-serif text-lg leading-snug text-stone-900">{goal.title || 'Untitled goal'}</h3>
        <Trajectory points={traj} />
      </div>

      {/* The one indicator. Silent until there is something true to say — a
          goal she just wrote is only its own words. */}
      {adh && (
        <p className="mt-2 text-[12px] tabular-nums text-stone-500">Adherence {adh.pct}%</p>
      )}

      {/* Only what she put there herself: the project it belongs to, the date
          she set. The pillar lives in the panel, not on the face of the card. */}
      {(project || goal.target) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          {project && <span className="truncate rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-500">{project.name}</span>}
          {goal.target && <span className="rounded-full bg-stone-500/5 px-2.5 py-1 text-[11px] text-stone-500">◷ {fmtShort(goal.target)}{d != null && d < 0 ? ` · ${Math.abs(d)}d over` : ''}</span>}
        </div>
      )}
    </div>
  )
}

function GoalPanel({ goal, steps, openMs, onToggleMsOpen, onUpdate, onClose, onRemove, onToggleStep, onRemoveStep, onAddStep, ai, onRunAI, onAcceptAI, onDismissAI, images = [], onUnpair }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 10); return () => clearTimeout(t) }, [])
  useEffect(() => { const onEsc = (e) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc) }, [onClose])

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
          {/* The goal, and the ladder to it. Nothing between the two — the
              classification, the tags, the scores and the log were the planner
              asking her to file the thing rather than do it.

              The exception is what it looks like. A picture she pinned to this
              on the board belongs at the top of it, because that is the thing
              she is actually working towards. */}
          {images.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {images.map((im) => (
                <span key={im.id} className="group relative block h-20 w-20 overflow-hidden bg-stone-100">
                  <img src={im.url} alt={im.title} title={im.title || undefined} className="h-full w-full object-cover" />
                  {onUnpair && (
                    <button
                      onClick={() => onUnpair(im.id)}
                      aria-label="Unpair this picture"
                      title="Unpair — the picture stays on the board"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-stone-900/70 text-cream opacity-0 transition-opacity hover:bg-stone-900 group-hover:opacity-100"
                    ><CloseIcon size={11} /></button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* path */}
          <div className="mb-1 flex items-center gap-2.5">
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
function Header({ phase, cycleLength, fertile }) {
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

  const Zone = ({ parts, className = '' }) => (
    <span className={`whitespace-nowrap text-[11px] tracking-[0.18em] text-stone-400 ${className}`}>{parts.join(' · ')}</span>
  )

  return (
    <div className="mb-9">
      <h1 className="text-center font-serif text-4xl text-stone-900 md:text-5xl">Becoming</h1>
      {/* Two readings, spread — the week and the body. The tally of what she
          owes was the page grading her before she had read a word of it. */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-1.5 sm:justify-between">
        <Zone parts={[`WEEK ${isoWeek(now)}`, span]} />
        {body.length > 0 && <Zone parts={body} className="text-stone-500" />}
      </div>
    </div>
  )
}

// ── List — all of them close together, for the days when she wants to see
// everything at once rather than be shown anything. One row, one goal: what it
// looks like, what it is, when, and whether the practices behind it are being
// kept.
function GoalList({ goals, imagesOf, stepsOf, onOpen }) {
  return (
    <div className="border-t border-stone-200">
      {goals.map((g) => {
        const im = imagesOf(g.id)[0]
        const adh = adherenceOf(stepsOf(g.id))
        const d = daysUntil(g.target)
        const ph = PHASES.find((x) => x.id === g.phase) || PHASES[0]
        return (
          <button key={g.id} onClick={() => onOpen(g.id)}
            className="flex w-full items-center gap-4 border-b border-stone-100 px-1 py-3 text-left transition-colors hover:bg-stone-500/5">
            <span className="h-11 w-11 shrink-0 overflow-hidden bg-stone-100">
              {im && <img src={im.url} alt="" className="h-full w-full object-cover" />}
            </span>
            <span className="min-w-0 flex-1 truncate font-serif text-[17px] text-stone-900">{g.title || 'Untitled goal'}</span>
            <span className="hidden w-20 shrink-0 text-[10px] tracking-[0.16em] text-stone-500 sm:block">{ph.label.toUpperCase()}</span>
            <span className="w-32 shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-stone-500">
              {g.target ? `${fmtShort(g.target)}${d != null && d < 0 ? ` · ${Math.abs(d)}d over` : ''}` : '—'}
            </span>
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-stone-500">{adh ? `${adh.pct}%` : ''}</span>
          </button>
        )
      })}
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
            const p = msPct(g)
            const pl = pillarMeta(g.pillar)
            return (
              <button key={g.id} onClick={() => onOpen(g.id)} className="block w-full text-left">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="font-serif text-base text-stone-900">{g.title || 'Untitled'}</span>
                  {p != null && <span className="text-[11px] tabular-nums text-stone-400">{p}%</span>}
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

