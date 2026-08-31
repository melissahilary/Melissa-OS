import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Wand2, Check } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { isDoneOn, activityOccursOn, blankActivity } from '../lib/activities'
import { dateKey, parseKey, addDays, MONTHS_SHORT, DOW } from '../lib/date'
import { phaseForConfig } from '../lib/cycle'
import { isoWeek } from '../lib/week'
import Checkbox from './shared/Checkbox'

const uid = () => Math.random().toString(36).slice(2, 10)

// ── This Week — a week, drawn as a week.
//
// A list of days is a list. Seven columns is a week: you can see the shape of
// it, where the load sits, and — because the cycle phase runs as a band beneath
// the columns — whether you have piled the heavy work onto the days your body
// will least want it.

const MON_START = (d) => addDays(d, -((d.getDay() + 6) % 7))

// Only a one-off can be dragged. Moving a recurring item would move the whole
// series, which is never what the gesture means.
const movable = (a) => a.frequency === 'once' || a.frequency === 'asneeded'

export default function DreamWeek({ activities, add, update, toggleComplete, onOpenItem, cycleConfig, goals, projects, phases }) {
  const today = new Date()
  const todayKeyStr = dateKey(today)
  const [offset, setOffset] = useState(0)
  const [focusMap, setFocus] = useLocalStorage('mos:dream:weekFocus', {})
  const [gratitude] = useLocalStorage('mos:gratitude', {})
  const [proposal, setProposal] = useState(null)
  const [dragging, setDragging] = useState(null)

  const monday = addDays(MON_START(today), offset * 7)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday.getTime()])
  const weekNo = isoWeek(monday)
  const weekKey = `${monday.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
  const focus = (focusMap && typeof focusMap === 'object' ? focusMap : {})[weekKey] || ''
  const setWeekFocus = (v) => setFocus((p) => ({ ...(p && typeof p === 'object' ? p : {}), [weekKey]: v }))

  const first = days[0]
  const last = days[6]
  const span = first.getMonth() === last.getMonth()
    ? `${MONTHS_SHORT[first.getMonth()].toUpperCase()} ${first.getDate()}–${last.getDate()}`
    : `${MONTHS_SHORT[first.getMonth()].toUpperCase()} ${first.getDate()} – ${MONTHS_SHORT[last.getMonth()].toUpperCase()} ${last.getDate()}`

  const isWeekTask = (a) => a.status !== 'archived' && a.type !== 'meal_item' && a.type !== 'supplement'
    && (a.type === 'event' || (a.details && a.details.goalId) || a.frequency === 'once' || a.frequency === 'asneeded')

  // What sits on each day. Undone one-offs from before today are carried onto
  // today rather than left behind — no red, no "overdue", no strikethrough. The
  // day they were meant for is simply no longer the point.
  const carried = useMemo(() => {
    if (offset !== 0) return []
    return activities.filter((a) => isWeekTask(a) && movable(a) && a.seriesStart && a.seriesStart < todayKeyStr && !isDoneOn(a, a.seriesStart))
  }, [activities, todayKeyStr, offset])

  const columns = days.map((d) => {
    const dk = dateKey(d)
    const own = activities.filter((a) => isWeekTask(a) && activityOccursOn(a, dk))
    const items = dk === todayKeyStr ? [...carried.filter((c) => !own.some((o) => o.id === c.id)), ...own] : own
    return { d, dk, items, phase: phases ? phaseForConfig(cycleConfig, d) : null }
  })

  const total = columns.reduce((n, c) => n + c.items.length, 0)
  const done = columns.reduce((n, c) => n + c.items.filter((a) => isDoneOn(a, c.dk)).length, 0)

  // The cup she chose that morning. The week shows what she actually had, not
  // only what she meant to do.
  const capacityOf = (dk) => {
    const g = (gratitude && typeof gratitude === 'object' ? gratitude : {})[dk]
    if (!g || Array.isArray(g)) return null
    return g.mode === 'low' ? 'half' : g.mode === 'high' ? 'full' : null
  }

  const drop = (dk) => {
    if (!dragging) return
    update(dragging, { seriesStart: dk, seriesEnd: '' })
    setDragging(null)
  }

  const acceptPlan = (rows) => {
    rows.forEach((r) => add(blankActivity(r.kind === 'event' ? 'event' : 'protocol', {
      title: r.title,
      category: r.category || 'mindset',
      frequency: 'once',
      seriesStart: r.date,
      details: { ...(r.goalId ? { goalId: r.goalId } : {}), ...(r.projectId ? { projectId: r.projectId } : {}), section: r.section || '', block: 'morning', categoryFields: {} },
    })))
    setProposal(null)
  }

  const isSunday = todayKeyStr === dateKey(days[6]) && offset === 0

  return (
    <div>
      {/* The week, named and numbered, with one line that holds it. */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous week" className="shrink-0 text-stone-300 hover:text-stone-900"><ChevronLeft size={17} /></button>
        <span className="shrink-0 text-[11px] tracking-[0.2em] text-stone-400">WEEK {weekNo} · {span}</span>
        <button onClick={() => setOffset((o) => o + 1)} aria-label="Next week" className="shrink-0 text-stone-300 hover:text-stone-900"><ChevronRight size={17} /></button>
        <span className="ml-auto shrink-0 text-[11px] tracking-[0.14em] text-stone-400 tabular-nums">{done}/{total}</span>
        <button onClick={() => setProposal(propose(days, goals, projects, activities, cycleConfig, phases))} className="flex shrink-0 items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">
          <Wand2 size={12} strokeWidth={1.7} /> Plan the week
        </button>
      </div>

      <input
        value={focus}
        onChange={(e) => setWeekFocus(e.target.value)}
        placeholder="The one thing this week is for…"
        className="mb-6 w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-xl text-stone-800 outline-none transition-colors placeholder:text-stone-300 focus:border-stone-900"
      />

      {/* Seven columns. On a phone they stack, because seven columns on a phone
          is a row of slivers — but the phase band survives either way. */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 sm:grid-cols-7">
        {columns.map(({ d, dk, items, phase }) => {
          const isToday = dk === todayKeyStr
          const cap = capacityOf(dk)
          return (
            <div
              key={dk}
              onDragOver={(e) => { if (dragging) e.preventDefault() }}
              onDrop={() => drop(dk)}
              className="min-h-[9rem] p-2.5 transition-colors"
              style={{ background: isToday ? '#F3F1EA' : '#FDFCF9' }}
            >
              <div className="mb-2 flex items-baseline gap-1.5">
                <span className={`text-[10px] tracking-[0.14em] ${isToday ? 'text-stone-900' : 'text-stone-400'}`}>{DOW[d.getDay()]}</span>
                <span className={`text-[11px] tabular-nums ${isToday ? 'text-stone-900' : 'text-stone-400'}`}>{d.getDate()}</span>
                {cap && <Capacity level={cap} />}
              </div>

              <div className="space-y-1">
                {items.map((a) => {
                  const isDone = isDoneOn(a, dk)
                  return (
                    <div
                      key={a.id}
                      draggable={movable(a)}
                      onDragStart={() => setDragging(a.id)}
                      onDragEnd={() => setDragging(null)}
                      className={`group flex items-start gap-1.5 rounded-lg px-1 py-1 ${movable(a) ? 'cursor-grab' : ''}`}
                    >
                      <span className="mt-[3px] shrink-0"><Checkbox checked={isDone} onClick={() => toggleComplete(a.id, dk)} /></span>
                      <button
                        onClick={() => onOpenItem && onOpenItem(a)}
                        className={`min-w-0 flex-1 text-left text-[12px] leading-snug ${isDone ? 'text-stone-300' : 'text-stone-700'}`}
                      >
                        {a.title || 'Untitled'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* The phase band — the week's other axis, drawn under the days it
          belongs to rather than described in a sentence somewhere else. */}
      {phases && columns.some((c) => c.phase) && (
        <div className="mt-px hidden grid-cols-7 gap-px overflow-hidden rounded-b-2xl border-x border-b border-stone-200 bg-stone-200 sm:grid">
          {columns.map(({ dk, phase }) => (
            <div key={dk} className="px-2 py-1.5 text-center" style={{ background: phase ? `${phase.color}1F` : '#FDFCF9' }}>
              <span className="text-[9px] tracking-[0.12em]" style={{ color: phase ? phase.color : '#C4BFB6' }}>
                {phase ? phase.abbr : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {isSunday && <WeekClose columns={columns} carriedCount={carried.length} />}

      {proposal && <Proposal rows={proposal} onAccept={acceptPlan} onDismiss={() => setProposal(null)} />}
    </div>
  )
}

// Full cup or half — drawn, not spelled.
function Capacity({ level }) {
  return (
    <span className="ml-auto shrink-0" title={level === 'full' ? 'Full' : 'Half'}>
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
        <circle cx="5" cy="5" r="4" fill="none" stroke="#C4BFB6" strokeWidth="1" />
        {level === 'full'
          ? <circle cx="5" cy="5" r="4" fill="#A3A093" />
          : <path d="M5 1 A4 4 0 0 1 5 9 Z" fill="#A3A093" />}
      </svg>
    </span>
  )
}

// ── Plan the week ───────────────────────────────────────────────────
// Deterministic, and deliberately so: it reads the goals and projects that are
// already there and lays them across the days, heavy work into follicular, light
// into luteal. It proposes; she edits. Nothing is created until she says so.
const HEAVY = ['follicular', 'ovulation']

function propose(days, goals, projects, activities, cycleConfig, phases) {
  const rows = []
  const busy = {}
  days.forEach((d) => { busy[dateKey(d)] = activities.filter((a) => a.status !== 'archived' && activityOccursOn(a, dateKey(d))).length })

  const dayScore = (d) => {
    const dk = dateKey(d)
    const ph = phases ? phaseForConfig(cycleConfig, d) : null
    // Fewest items first; among equals, the phase that suits the work.
    return { dk, d, load: busy[dk] || 0, heavy: ph ? HEAVY.includes(ph.id) : true }
  }
  const slots = days.map(dayScore)
  const pickDay = (wantsHeavy) => {
    const pool = [...slots].sort((a, b) => (a.load - b.load) || (wantsHeavy === a.heavy ? -1 : 1))
    const best = pool.find((s) => (wantsHeavy ? s.heavy : true)) || pool[0]
    if (best) best.load += 1
    return best ? best.dk : dateKey(days[0])
  }

  // A goal with no step anywhere this week gets one.
  ;(goals || []).filter((g) => g.status !== 'achieved').forEach((g) => {
    const has = activities.some((a) => a.details && a.details.goalId === g.id
      && days.some((d) => activityOccursOn(a, dateKey(d))))
    if (has) return
    const nextMs = (g.milestones || []).find((m) => !m.done)
    rows.push({
      id: uid(),
      title: nextMs ? nextMs.title : `Move ${g.title || 'this goal'} forward`,
      date: pickDay(true),
      goalId: g.id,
      category: g.pillar || 'mindset',
      from: g.title || 'Goal',
    })
  })

  // Every project's next action, if it isn't already on the week.
  ;(projects || []).filter((p) => p.status !== 'done' && p.status !== 'dormant').forEach((p) => {
    const next = (Array.isArray(p.tasks) ? p.tasks : []).find((t) => !t.done)
    const title = p.nextAction || (next && next.title)
    if (!title) return
    const already = activities.some((a) => (a.title || '').trim().toLowerCase() === title.trim().toLowerCase()
      && days.some((d) => activityOccursOn(a, dateKey(d))))
    if (already) return
    rows.push({ id: uid(), title, date: pickDay(false), projectId: p.id, category: 'mindset', from: p.name || p.title || 'Project' })
  })

  return rows
}

function Proposal({ rows, onAccept, onDismiss }) {
  const [keep, setKeep] = useState(() => new Set(rows.map((r) => r.id)))
  const taken = rows.filter((r) => keep.has(r.id))
  const toggle = (id) => setKeep((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="mt-5 rounded-2xl border border-stone-900 bg-white/60 p-5">
      <p className="kicker mb-1 text-stone-400">A proposed week</p>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">Every active goal and project already has something on this week.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-stone-500">Heavier work lands in the follicular half, lighter in the luteal. Move anything after you accept.</p>
          <div className="divide-y divide-stone-100">
            {rows.map((r) => {
              const d = parseKey(r.date)
              const off = !keep.has(r.id)
              return (
                <label key={r.id} className={`flex cursor-pointer items-center gap-3 py-2 ${off ? 'opacity-40' : ''}`}>
                  <input type="checkbox" checked={!off} onChange={() => toggle(r.id)} className="h-3.5 w-3.5 shrink-0 accent-stone-900" />
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{r.title}</span>
                  <span className="shrink-0 text-[11px] text-stone-400">{r.from}</span>
                  <span className="w-16 shrink-0 text-right text-[11px] tracking-[0.1em] text-stone-500">{DOW[d.getDay()]} {d.getDate()}</span>
                </label>
              )
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => onAccept(taken)} disabled={!taken.length} className="rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-30">
              Put {taken.length} on the week
            </button>
            <button onClick={onDismiss} className="text-xs text-stone-400 hover:text-stone-700">Not now</button>
          </div>
        </>
      )}
      {rows.length === 0 && <button onClick={onDismiss} className="mt-3 text-xs text-stone-400 hover:text-stone-700">Close</button>}
    </div>
  )
}

// ── The week, closed ────────────────────────────────────────────────
// Sunday, and only Sunday. Weekly is the cadence people actually review at, so
// this is where the old daily Recap's job now lives.
function WeekClose({ columns, carriedCount }) {
  const all = columns.flatMap((c) => c.items.map((a) => ({ a, dk: c.dk })))
  const moved = all.filter(({ a, dk }) => isDoneOn(a, dk))
  const stayed = all.filter(({ a, dk }) => !isDoneOn(a, dk))
  return (
    <div className="mt-6 rounded-2xl border border-stone-300 p-5" style={{ background: '#F3F1EA' }}>
      <p className="kicker mb-3 text-stone-500">The week, closed</p>
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <p className="font-serif text-3xl text-stone-900">{moved.length}</p>
          <p className="text-[11px] tracking-[0.14em] text-stone-400">MOVED</p>
        </div>
        <div>
          <p className="font-serif text-3xl text-stone-900">{stayed.length}</p>
          <p className="text-[11px] tracking-[0.14em] text-stone-400">DIDN’T</p>
        </div>
        <div>
          <p className="font-serif text-3xl text-stone-900">{carriedCount}</p>
          <p className="text-[11px] tracking-[0.14em] text-stone-400">CARRIES</p>
        </div>
      </div>
      {moved.length > 0 && (
        <div className="mt-4 border-t border-stone-300/60 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {moved.slice(0, 8).map(({ a }) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[11px] text-stone-600">
                <Check size={10} style={{ color: '#7C8B6B' }} />{a.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
