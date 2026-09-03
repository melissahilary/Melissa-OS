import React, { useState, useEffect, useRef } from 'react'
import { Target, Sparkles, Calendar, ListChecks, FolderKanban, Image as ImageIcon } from 'lucide-react'
import { AddIcon, CloseIcon, LoggedIcon, NextIcon, ColumnsIcon, WallIcon, ListIcon, TimelineIcon, FilterIcon } from './shared/marks'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useActivities } from '../hooks/useActivities'
import { blankActivity, isDoneOn, activityOccursOn } from '../lib/activities'
import { dateKey, parseKey, addDays, MONTHS, MONTHS_SHORT, DOW_LONG } from '../lib/date'
import Checkbox from './shared/Checkbox'
import ActivityForm from './shared/ActivityForm'
import DreamBoard, { processImage, normVision } from './DreamBoard'
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
  { id: 'now', label: 'Now', note: 'Next 6 months', months: 6 },
  { id: 'next', label: 'Next', note: '6–12 months', months: 12 },
  { id: 'later', label: 'Later', note: 'Beyond a year', months: 18 },
]
const phaseMeta = (id) => PHASES.find((p) => p.id === id) || PHASES[0]

// The day she enters a goal the clock starts: its horizon sets a due date from
// that day, and moving it to another horizon restarts the clock from today. She
// can then set the date to anything — the horizon is the default, not the rule.
const addMonths = (key, n) => { const d = parseKey(key); const out = new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); return dateKey(out) }
const dueFromHorizon = (phase, from) => addMonths(from || dateKey(new Date()), phaseMeta(phase).months)
const daysBetween = (a, b) => (a && b ? Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000) : null)
const HEALTH = { on: { c: '#7C8B6B', label: 'On track' }, risk: { c: '#B0873F', label: 'At risk' }, stall: { c: '#A0654C', label: 'Stalled' } }

// ── The readings.
//
// The same goals, looked at four ways, because how she needs to see them
// changes with what she is doing. Columns to decide what belongs where; the
// wall to remember why; the list to scan; the timeline to see what is coming.
const VIEWS = [
  { id: 'wall', label: 'Wall', note: 'Every goal as its picture', icon: WallIcon },
  { id: 'list', label: 'List', note: 'All of them, close together', icon: ListIcon },
  { id: 'timeline', label: 'Timeline', note: 'Everything with a date on it', icon: TimelineIcon },
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
const fmtLong = (key) => { if (!key) return ''; const d = parseKey(key); return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '' }
// A note's moment, as a stamp: the day, then the time.
const fmtStamp = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0')
  return `${MONTHS_SHORT[d.getMonth()].toUpperCase()} ${d.getDate()}, ${d.getFullYear()} · ${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

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

const normMilestone = (m) => ({
  id: (m && m.id) || uid(),
  title: (m && m.title) || '',
  done: !!(m && m.done),
  target: (m && m.target) || '',
  description: (m && m.description) || '',
  doneOn: (m && m.doneOn) || '',
})
const normNote = (n) => (n && typeof n === 'object'
  ? { id: n.id || uid(), text: n.text || '', at: n.at || (n.date ? `${n.date}T12:00:00` : new Date().toISOString()), editedAt: n.editedAt || '' }
  : null)

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
    notes: Array.isArray(g.notes) ? g.notes.map(normNote).filter(Boolean) : [], // to herself, timestamped
    links: Array.isArray(g.links) ? g.links : [], // { id, label, url } — attachments-lite
    achievedOn: g.achievedOn || '',
    createdOn: g.createdOn || '', // backfilled once on load for goals that predate it
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
  const [filterOpen, setFilterOpen] = useState(false)
  const [dropAt, setDropAt] = useState(null) // { phase, index } while a card is over a column
  const [boardFilter, setBoardFilter] = useState(null) // a pillar id, from tapping a metrics bar
  const [editItem, setEditItem] = useState(null) // a week item opened from This Week

  const setGoals = (updater) => setRawGoals((prev) => {
    const cur = (Array.isArray(prev) ? prev : []).map(normGoal)
    return typeof updater === 'function' ? updater(cur) : updater
  })
  const updateGoal = (id, patch) => setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  // Changing the horizon restarts the clock from today. Changing the date does
  // not change the horizon — the horizon is how she filed it, the date is when.
  const moveGoal = (id, phase) => updateGoal(id, { phase, target: dueFromHorizon(phase) })
  // Drop a goal at a position in a column. Order is the order of the array, so
  // the goal is lifted out and set down before whichever card is at the slot.
  const placeGoal = (id, phase, index) => setGoals((prev) => {
    const g = prev.find((x) => x.id === id)
    if (!g) return prev
    const rest = prev.filter((x) => x.id !== id)
    const moved = g.phase === phase ? g : { ...g, phase, target: dueFromHorizon(phase) }
    const column = rest.filter((x) => x.phase === phase && x.status !== 'achieved')
    const anchor = column[index]
    if (!anchor) return [...rest, moved]
    const at = rest.indexOf(anchor)
    return [...rest.slice(0, at), moved, ...rest.slice(at)]
  })
  const fresh = (phase, title = '') => {
    const today = todayKey()
    return { id: uid(), title, vision: '', pillar: 'mindset', phase, status: 'active', milestones: [], notes: [], createdOn: today, target: dueFromHorizon(phase, today) }
  }
  const addGoalIn = (phase, title) => {
    const t = (title || '').trim()
    if (!t) return
    setGoals((p) => [...p, fresh(phase, t)])
  }
  const addGoal = () => { const g = fresh('now'); setGoals((p) => [...p, g]); openGoal(g.id) }

  // Goals written before the clock existed get one, once. Their start is the
  // day this ran, which is the honest answer to "when did the count begin".
  useEffect(() => {
    if (!Array.isArray(rawGoals) || !rawGoals.length) return
    const needs = goals.some((g) => !g.createdOn || !g.target)
    if (!needs) return
    const today = todayKey()
    setGoals((prev) => prev.map((g) => ({
      ...g,
      createdOn: g.createdOn || today,
      target: g.target || dueFromHorizon(g.phase, g.createdOn || today),
    })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals.length])
  const removeGoal = (id) => { setGoals((p) => p.filter((g) => g.id !== id)); activities.filter((a) => a.details && a.details.goalId === id).forEach((a) => remove(a.id)); setOpenId(null) }

  const stepsOf = (goalId) => activities.filter((a) => a.details && a.details.goalId === goalId && a.status !== 'archived')
  // A proposed plan becomes steps on the path. What each step involves goes in
  // its description, where she can read it and change it.
  const acceptPlan = (g, plan) => {
    const newMs = plan.map((m) => normMilestone({
      id: uid(),
      title: m.title,
      description: Array.isArray(m.steps) ? m.steps.map((x) => (x && x.title) || '').filter(Boolean).join('\n') : '',
    }))
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
  const boardAll = (boardRaw && Array.isArray(boardRaw.items) ? boardRaw.items : []).filter((it) => it && it.id)
  const boardItems = boardAll.filter((it) => it.goalId)

  // The board's pictures live in private storage, so a goal card showing what
  // she pinned needs them signed first.
  const [boardUrls, setBoardUrls] = useState({})
  useEffect(() => {
    let alive = true
    const missing = boardAll.filter((it) => it.path && !boardUrls[it.path]).map((it) => it.path)
    if (!missing.length) return undefined
    ;(async () => {
      const pairs = await Promise.all([...new Set(missing)].map(async (pth) => [pth, await store.signedPhotoUrl(pth)]))
      if (alive) setBoardUrls((prev) => ({ ...prev, ...Object.fromEntries(pairs.filter(([, u]) => u)) }))
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardAll.map((it) => it.path).join(',')])

  const pictureOf = (it) => ({ id: it.id, url: it.dataUrl || it.remote || boardUrls[it.path] || '', title: it.caption || it.title || '', goalId: it.goalId || '' })
  const boardPictures = boardAll.map(pictureOf).filter((x) => x.url)
  const imagesForGoal = (gid) => boardItems
    .filter((it) => it.goalId === gid)
    .map((it) => ({ id: it.id, url: it.dataUrl || it.remote || boardUrls[it.path] || '', title: it.caption || it.title || '' }))
    .filter((x) => x.url)

  // Unpairing is the picture's business, so it writes the board, not the goal.
  // The photograph itself is never touched — it stays on the board, it simply
  // stops standing for this.
  const setPictureGoal = (imageId, goalId) => setBoardRaw((prev) => {
    const cur = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : { template: 'scrapbook', items: [] }
    const items = (Array.isArray(cur.items) ? cur.items : []).map((it) => (it && it.id === imageId ? { ...it, goalId } : it))
    return { ...cur, items }
  })
  const unpairImage = (imageId) => setPictureGoal(imageId, '')
  const pairImage = (imageId, goalId) => setPictureGoal(imageId, goalId)

  // A photo uploaded from the goal goes to the board like any other — same
  // pipeline, same bucket, same reading — and lands already paired.
  const uploadForGoal = (file, goalId) => {
    if (!file || !String(file.type || '').startsWith('image/')) return
    processImage(file, 1400, async (out) => {
      if (!out) return
      let path = ''
      if (out.blob) path = (await store.uploadPhoto(out.blob)) || ''
      setBoardRaw((prev) => {
        const cur = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : { template: 'scrapbook', items: [] }
        const items = (Array.isArray(cur.items) ? cur.items : []).map(normVision)
        return { ...cur, items: [...items, normVision({
          id: uid(), path, dataUrl: path ? '' : (out.dataUrl || ''), w: out.w, h: out.h, hash: out.hash, goalId,
          x: 6 + (items.length % 3) * 30, y: 24 + Math.floor(items.length / 3) * 250, rot: 0,
        })] }
      })
      store.flush('mos:dream:board')
    })
  }


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
            const g = fresh('now', title)
            setGoals((p) => [...p, g])
            return g
          }}
        />
      )}
      {tab === 'collections' && <DreamCollections goals={active} projects={Array.isArray(projectsRaw) ? projectsRaw : []} />}
      {tab === 'goals' && (
        <>
          <div className="relative mb-7 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* The columns are where she lands. The other readings are on
                  the nav; pressing the one she is in returns her to the
                  columns, so there is no fourth button for the ground. */}
              <div className="inline-flex rounded-full border border-stone-200 bg-cream p-0.5">
                {VIEWS.map((v) => {
                  const on = goalView === v.id
                  const Icon = v.icon
                  return (
                    <button key={v.id} onClick={() => setGoalView(on ? 'columns' : v.id)} title={v.note} aria-pressed={on}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-colors ${on ? 'bg-stone-900 text-cream' : 'text-stone-900 hover:bg-stone-500/5'}`}>
                      <Icon size={16} />{v.label}
                    </button>
                  )
                })}
              </div>

              {/* One button. Open it and every choice says how many it holds. */}
              <div className="relative">
                <button onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${period !== 'any' || filterOpen ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-900 hover:border-stone-900'}`}>
                  <FilterIcon size={16} />{period === 'any' ? 'Filter' : PERIODS.find((x) => x.id === period).label}
                  {period !== 'any' && <span className="tabular-nums opacity-70">· {inView.length}</span>}
                </button>
                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} />
                    <div className="absolute left-0 top-full z-30 mt-2 w-56 border border-stone-200 bg-cream p-1.5">
                      <p className="px-2.5 pb-1.5 pt-1 text-[10px] tracking-[0.16em] text-stone-500">BY WHEN</p>
                      {PERIODS.map((pd) => {
                        const n = active.filter((g) => (!boardFilter || g.pillar === boardFilter) && inPeriod(g, pd.id)).length
                        const on = period === pd.id
                        return (
                          <button key={pd.id} onClick={() => { setPeriod(pd.id); setFilterOpen(false) }}
                            className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[12px] transition-colors ${on ? 'bg-stone-900 text-cream' : 'text-stone-900 hover:bg-stone-500/5'}`}>
                            <span>{pd.label}</span>
                            <span className={`tabular-nums ${on ? 'text-cream/80' : 'text-stone-500'}`}>{n}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <button onClick={addGoal} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-colors hover:bg-stone-700"><AddIcon size={15} strokeWidth={1.75} /> New goal</button>
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
              const here = dropAt && dropAt.phase === ph.id ? dropAt.index : null
              const Line = () => <div aria-hidden className="h-0.5 bg-stone-900" />
              return (
                <div
                  key={ph.id}
                  onDragOver={(e) => {
                    if (!dragId) return
                    e.preventDefault()
                    // Where it will land: before the first card whose middle is
                    // below the pointer, else at the end of the column.
                    const cards = [...e.currentTarget.querySelectorAll('[data-goal]')].filter((c) => c.dataset.goal !== dragId)
                    let index = cards.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 })
                    if (index === -1) index = cards.length
                    if (!dropAt || dropAt.phase !== ph.id || dropAt.index !== index) setDropAt({ phase: ph.id, index })
                  }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null) }}
                  onDrop={(e) => { e.preventDefault(); if (dragId && dropAt && dropAt.phase === ph.id) placeGoal(dragId, ph.id, dropAt.index); setDragId(null); setDropAt(null) }}
                >
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
                    {(() => {
                      // The dragged card stays where it was, dimmed; the line
                      // is placed among the others.
                      const others = inp.filter((x) => x.id !== dragId)
                      return inp.map((g) => (
                        <React.Fragment key={g.id}>
                          {g.id !== dragId && here === others.indexOf(g) && <Line />}
                          <div className={`transition-opacity duration-150 ${dragId === g.id ? 'opacity-30' : ''}`}>
                            {cardFor(g, { dragging: true })}
                          </div>
                        </React.Fragment>
                      )).concat(here != null && here >= others.length ? [<Line key="end" />] : [])
                    })()}
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
                        <span className="block text-[11px] tabular-nums text-stone-500">
                          {g.achievedOn ? fmtShort(g.achievedOn) : ''}
                          {(() => { const t = daysBetween(g.createdOn, g.achievedOn); return t != null ? ` · took ${t} day${t === 1 ? '' : 's'}` : '' })()}
                        </span>
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
          openMs={openMs}
          onToggleMsOpen={toggleMsOpen}
          onUpdate={(patch) => updateGoal(openGoalObj.id, patch)}
          onClose={() => setOpenId(null)}
          onRemove={() => removeGoal(openGoalObj.id)}
          ai={ai && ai.goalId === openGoalObj.id ? ai : null}
          onRunAI={() => runAI(openGoalObj)}
          onAcceptAI={(plan) => acceptPlan(openGoalObj, plan)}
          onDismissAI={() => setAi(null)}
          images={imagesForGoal(openGoalObj.id)}
          boardPictures={boardPictures}
          onUnpair={unpairImage}
          onPair={(imageId) => pairImage(imageId, openGoalObj.id)}
          onUpload={(file) => uploadForGoal(file, openGoalObj.id)}
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
    'data-goal': goal.id,
    draggable: !!onDragStart,
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

function GoalPanel({ goal, openMs, onToggleMsOpen, onUpdate, onClose, onRemove, ai, onRunAI, onAcceptAI, onDismissAI, images = [], boardPictures = [], onUnpair, onPair, onUpload }) {
  const [mounted, setMounted] = useState(false)
  const [picking, setPicking] = useState(false)
  const fileRef = useRef(null)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 10); return () => clearTimeout(t) }, [])
  useEffect(() => { const onEsc = (e) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc) }, [onClose])

  const achieved = goal.status === 'achieved'
  const left = daysUntil(goal.target)
  const took = achieved ? daysBetween(goal.createdOn, goal.achievedOn) : null
  const paired = new Set(images.map((im) => im.id))
  const unpaired = boardPictures.filter((pc) => !paired.has(pc.id))

  const setStep = (id, patch) => onUpdate({ milestones: goal.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const addStep = (title, target) => onUpdate({ milestones: [...goal.milestones, normMilestone({ id: uid(), title, target })] })
  const removeStep = (id) => onUpdate({ milestones: goal.milestones.filter((m) => m.id !== id) })
  const tickStep = (m) => setStep(m.id, { done: !m.done, doneOn: m.done ? '' : todayKey() })

  const addNote = (text) => onUpdate({ notes: [{ id: uid(), text, at: new Date().toISOString(), editedAt: '' }, ...goal.notes] })
  const editNote = (id, text) => onUpdate({ notes: goal.notes.map((n) => (n.id === id ? { ...n, text, editedAt: new Date().toISOString() } : n)) })
  const removeNote = (id) => onUpdate({ notes: goal.notes.filter((n) => n.id !== id) })

  const Label = ({ children }) => <span className="w-[4.6rem] shrink-0 text-[10px] tracking-[0.16em] text-stone-500">{children}</span>

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity ${mounted ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside className={`relative flex h-full w-full max-w-[470px] flex-col border-l border-stone-200 bg-cream shadow-2xl transition-transform duration-300 ${mounted ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-start gap-3 border-b border-stone-200 px-6 py-5">
          <input value={goal.title} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Name the goal" autoFocus className="flex-1 bg-transparent font-serif text-2xl text-stone-900 placeholder-stone-300 outline-none" />
          <button onClick={onClose} aria-label="Close" className="mt-1 text-stone-400 hover:text-stone-900"><CloseIcon size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── When. The clock started the day she wrote it; the horizon set
              the date, and either can be moved. The count and the date are one
              fact read two ways, so editing one rewrites the other. */}
          <div className="space-y-2.5">
            {achieved ? (
              <div className="flex items-baseline gap-3">
                <Label>ACHIEVED</Label>
                <span className="text-[13px] text-stone-900">{fmtLong(goal.achievedOn)}</span>
                {took != null && <span className="text-[13px] tabular-nums text-stone-500">· took {took} day{took === 1 ? '' : 's'}</span>}
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                <Label>DUE</Label>
                <input type="date" value={goal.target || ''} onChange={(e) => onUpdate({ target: e.target.value })}
                  aria-label="Due date" className="cursor-pointer bg-transparent text-[13px] text-stone-900 outline-none" />
                <span className="text-stone-300">·</span>
                <span className="inline-flex items-baseline gap-1 text-[13px] tabular-nums text-stone-900">
                  <input
                    type="number"
                    value={left == null ? '' : left}
                    onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) onUpdate({ target: dateKey(addDays(new Date(), n)) }) }}
                    aria-label="Days until due"
                    className="w-14 bg-transparent text-right outline-none"
                  />
                  <span className="text-stone-500">{left != null && left < 0 ? 'days over' : left === 0 ? 'days — today' : 'days left'}</span>
                </span>
              </div>
            )}
            <div className="flex items-baseline gap-3">
              <Label>HORIZON</Label>
              <div className="inline-flex flex-wrap gap-1">
                {PHASES.map((ph) => (
                  <button key={ph.id} onClick={() => onUpdate({ phase: ph.id, target: dueFromHorizon(ph.id) })}
                    title={`Sets the due date ${ph.months} months from today`}
                    className={`rounded-full px-3 py-1 text-[11px] transition-colors ${goal.phase === ph.id ? 'bg-stone-900 text-cream' : 'border border-stone-300 text-stone-900 hover:border-stone-900'}`}>
                    {ph.note}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <Label>ENTERED</Label>
              <span className="text-[13px] text-stone-500">{goal.createdOn ? fmtLong(goal.createdOn) : '—'}</span>
            </div>
          </div>

          {/* ── What it looks like. */}
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="kicker text-stone-400">The picture</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>
            <div className="flex flex-wrap gap-2">
              {images.map((im) => (
                <span key={im.id} className="group relative block h-20 w-20 overflow-hidden bg-stone-100">
                  <img src={im.url} alt={im.title} title={im.title || undefined} className="h-full w-full object-cover" />
                  <button onClick={() => onUnpair(im.id)} aria-label="Unpair this picture" title="Unpair — the picture stays on the board"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-stone-900/70 text-cream opacity-0 transition-opacity hover:bg-stone-900 group-hover:opacity-100"><CloseIcon size={11} /></button>
                </span>
              ))}
              <button onClick={() => setPicking((v) => !v)} aria-expanded={picking}
                className={`flex h-20 w-20 flex-col items-center justify-center gap-1 border text-[10px] tracking-[0.12em] transition-colors ${picking ? 'border-stone-900 text-stone-900' : 'border-dashed border-stone-300 text-stone-500 hover:border-stone-900 hover:text-stone-900'}`}>
                <AddIcon size={16} />ADD
              </button>
            </div>
            {picking && (
              <div className="mt-3 border border-stone-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.16em] text-stone-500">FROM THE MOOD BOARD</span>
                  <button onClick={() => fileRef.current && fileRef.current.click()} className="text-[11px] text-stone-900 underline underline-offset-4 hover:text-stone-600">Upload a photo</button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { const files = [...(e.target.files || [])]; e.target.value = ''; files.forEach((f) => onUpload(f)); setPicking(false) }} />
                </div>
                {unpaired.length === 0
                  ? <p className="py-3 text-center text-[12px] italic text-stone-500">Nothing on the board yet — upload one.</p>
                  : (
                    <div className="grid grid-cols-5 gap-1.5">
                      {unpaired.map((pc) => (
                        <button key={pc.id} onClick={() => { onPair(pc.id); setPicking(false) }} title={pc.title || undefined}
                          className="aspect-square overflow-hidden bg-stone-100 transition-opacity hover:opacity-80">
                          {pc.url && <img src={pc.url} alt="" className="h-full w-full object-cover" />}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* ── The path. Steps with a date, each a tick, each opening to say
              more. No count of milestones, no scolding about a missing plan. */}
          <div className="mt-7">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="kicker text-stone-400">The path</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>
            <StepAdd onAdd={addStep} />
            <div>
              {goal.milestones.map((m, mi) => {
                const open = openMs.has(mi)
                const md = daysUntil(m.target)
                return (
                  <div key={m.id} className="border-b border-stone-100 last:border-b-0">
                    <div className="flex items-center gap-3 py-2.5">
                      <Checkbox checked={m.done} onClick={() => tickStep(m)} />
                      <button onClick={() => onToggleMsOpen(mi)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className={`min-w-0 flex-1 truncate text-[15px] ${m.done ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{m.title || 'Step'}</span>
                        {m.target && (
                          <span className={`shrink-0 text-[11px] tabular-nums ${!m.done && md != null && md < 0 ? 'text-oxblood' : 'text-stone-500'}`}>
                            {fmtShort(m.target)}{!m.done && md != null && md < 0 ? ` · ${Math.abs(md)}d over` : ''}
                          </span>
                        )}
                        <NextIcon size={14} className={`shrink-0 text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                    {open && (
                      <div className="mb-3 ml-8 border-l border-stone-200 pl-4">
                        <textarea
                          value={m.description}
                          onChange={(e) => setStep(m.id, { description: e.target.value })}
                          placeholder="What this step involves"
                          rows={3}
                          className="w-full resize-y bg-transparent text-[13px] leading-relaxed text-stone-800 outline-none placeholder:italic placeholder:text-stone-400"
                        />
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-stone-500">
                          <span className="tracking-[0.14em]">DUE</span>
                          <input type="date" value={m.target || ''} onChange={(e) => setStep(m.id, { target: e.target.value })} aria-label="Step due date" className="bg-transparent text-[11px] text-stone-900 outline-none" />
                          {m.done && m.doneOn && <span>· done {fmtShort(m.doneOn)}</span>}
                          <button onClick={() => removeStep(m.id)} className="ml-auto text-stone-500 hover:text-oxblood">Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {ai ? (
              <AIPlan ai={ai} onAccept={onAcceptAI} onDismiss={onDismissAI} onRetry={onRunAI} />
            ) : (
              <button onClick={onRunAI} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white/40 px-4 py-3 text-sm text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900">
                <Sparkles size={15} /> {goal.milestones.length ? 'Extend the plan with AI' : 'Build the plan with AI'}
              </button>
            )}
          </div>

          {/* ── Notes to herself. Timestamped, and hers to change or take back. */}
          <div className="mt-7">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="kicker text-stone-400">Notes</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>
            <NoteAdd onAdd={addNote} />
            {goal.notes.length > 0 && (
              <div className="mt-2 divide-y divide-stone-100">
                {goal.notes.map((n) => <Note key={n.id} note={n} onEdit={(t) => editNote(n.id, t)} onRemove={() => removeNote(n.id)} />)}
              </div>
            )}
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-stone-200 pt-4">
            <button onClick={onRemove} className="text-xs text-stone-500 hover:text-oxblood">Delete goal</button>
            <button onClick={() => onUpdate(achieved ? { status: 'active', achievedOn: '' } : { status: 'achieved', achievedOn: todayKey() })}
              className={`rounded-full px-5 py-2 text-sm transition-colors ${achieved ? 'border border-stone-300 text-stone-600 hover:border-stone-500' : 'bg-stone-900 text-cream hover:bg-stone-700'}`}>
              {achieved ? 'Reopen' : 'Mark achieved'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

// A step is a line and a date. Enter commits both.
function StepAdd({ onAdd }) {
  const [v, setV] = useState('')
  const [d, setD] = useState('')
  const commit = () => { const t = v.trim(); if (t) { onAdd(t, d); setV(''); setD('') } }
  return (
    <div className="flex items-center gap-3 border-b border-stone-200 py-2 transition-colors focus-within:border-stone-900">
      <AddIcon size={14} className="shrink-0 text-stone-400" />
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()}
        placeholder="Add a step" className="min-w-0 flex-1 bg-transparent py-0.5 text-[15px] text-stone-900 outline-none placeholder:text-stone-400" />
      <input type="date" value={d} onChange={(e) => setD(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()}
        aria-label="Step due date" title="Due" className="shrink-0 bg-transparent text-[11px] text-stone-500 outline-none" />
    </div>
  )
}

function NoteAdd({ onAdd }) {
  const [v, setV] = useState('')
  const commit = () => { const t = v.trim(); if (t) { onAdd(t); setV('') } }
  return (
    <div className="border border-stone-200 transition-colors focus-within:border-stone-900">
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit() }}
        placeholder="A note to yourself" className="block w-full resize-y bg-transparent px-3 py-2 text-[13px] leading-relaxed text-stone-900 outline-none placeholder:italic placeholder:text-stone-400" />
      <div className="flex items-center justify-between border-t border-stone-100 px-3 py-1.5">
        <span className="text-[10px] tracking-[0.12em] text-stone-500">⌘↵ TO SAVE</span>
        <button onClick={commit} disabled={!v.trim()} className="text-[11px] text-stone-900 underline underline-offset-4 hover:text-stone-600 disabled:text-stone-400 disabled:no-underline">Save</button>
      </div>
    </div>
  )
}

function Note({ note, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(note.text)
  const commit = () => { const t = v.trim(); if (t && t !== note.text) onEdit(t); setEditing(false) }
  return (
    <div className="group py-3">
      {editing ? (
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={3} autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit(); if (e.key === 'Escape') { setV(note.text); setEditing(false) } }}
          className="block w-full resize-y border border-stone-900 bg-transparent px-3 py-2 text-[13px] leading-relaxed text-stone-900 outline-none" />
      ) : (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-stone-900">{note.text}</p>
      )}
      <div className="mt-1 flex items-center gap-3 text-[10px] tracking-[0.12em] text-stone-500">
        <span className="tabular-nums">{fmtStamp(note.at)}{note.editedAt ? ' · EDITED' : ''}</span>
        {editing ? (
          <>
            <button onClick={commit} className="ml-auto text-stone-900 hover:text-stone-600">SAVE</button>
            <button onClick={() => { setV(note.text); setEditing(false) }} className="hover:text-stone-900">CANCEL</button>
          </>
        ) : (
          <>
            <button onClick={() => { setV(note.text); setEditing(true) }} className="ml-auto opacity-0 transition-opacity hover:text-stone-900 group-hover:opacity-100">EDIT</button>
            <button onClick={onRemove} className="opacity-0 transition-opacity hover:text-oxblood group-hover:opacity-100">DELETE</button>
          </>
        )}
      </div>
    </div>
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
            <span className="hidden w-28 shrink-0 text-[11px] text-stone-500 sm:block">{ph.note}</span>
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

