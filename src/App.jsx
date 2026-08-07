import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  UtensilsCrossed, Activity, Dumbbell, Brain, Scissors, Droplets, Heart, Briefcase, Code2, Home, Building2, Users,
  ChevronLeft, Sparkles, PanelLeftClose, PanelLeftOpen, CalendarDays, ClipboardList, Flower2, Gem, FlaskConical, Sun,
  Settings as SettingsIcon, X,
} from 'lucide-react'
import { useLocalStorage } from './hooks/useLocalStorage'
import { phaseFor } from './lib/cycle'
import { dateKey } from './lib/date'
import { migrateWeekPlan, normMeal } from './lib/meals'
import { migrateToActivities } from './lib/activities'
import { AddProvider } from './components/shared/AddButton'

// Titles that were mistakenly stored as checkbox events but are really meal items.
const RECLASSIFY = {
  'olive oil shot': 'empty',
  '2l of water': 'drink',
  '2 l of water': 'drink',
  '2l water': 'drink',
  '2 liters of water': 'drink',
  '2l': 'drink',
}
const reclassSlot = (title) => RECLASSIFY[(title || '').trim().toLowerCase()]

import Footer from './components/shared/Footer'
import Today from './components/Today'
import MealPlanning from './components/MealPlanning'
import Fitness from './components/Fitness'
import Workout from './components/Workout'
import Mindset from './components/Mindset'
import BrainHealth from './components/BrainHealth'
import Haircare from './components/Haircare'
import Bodycare from './components/Bodycare'
import Skincare from './components/Skincare'
import Aesthetics from './components/Aesthetics'
import Spirituality from './components/Spirituality'
import Diagnostics from './components/Diagnostics'
import Relationship from './components/Relationship'
import Settings from './components/Settings'
import DreamWorld, { DREAM_PAGES, DREAM_FIXED, DREAM_REORDER } from './components/DreamWorld'

const PILLARS = [
  { id: 'mindset', label: 'Mindset', icon: Sparkles },
  { id: 'brainhealth', label: 'Brain Health', icon: Brain },
  { id: 'skincare', label: 'Skincare', icon: Flower2 },
  { id: 'haircare', label: 'Haircare', icon: Scissors },
  { id: 'aesthetics', label: 'Aesthetics', icon: Gem },
  { id: 'bodycare', label: 'Bodycare', icon: Droplets },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'menu', label: 'Nutrition', icon: UtensilsCrossed },
  { id: 'workout', label: 'Hormones', icon: Activity },
  { id: 'diagnostics', label: 'Diagnostics', icon: FlaskConical },
  { id: 'relationship', label: 'Relationships', icon: Heart },
  { id: 'spirituality', label: 'Spirituality', icon: Sun },
]

const PILLAR_COMPONENTS = {
  mindset: Mindset,
  brainhealth: BrainHealth,
  skincare: Skincare,
  haircare: Haircare,
  aesthetics: Aesthetics,
  bodycare: Bodycare,
  fitness: Fitness,
  menu: MealPlanning,
  workout: Workout,
  diagnostics: Diagnostics,
  relationship: Relationship,
  spirituality: Spirituality,
}

// Category sub-navigation shown when inside a section.
const SUBNAV = {
  skincare: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  haircare: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  aesthetics: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  bodycare: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  spirituality: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  menu: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'grocery', label: "What's In My Fridge" },
  ],
  fitness: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  workout: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'cycle', label: 'Cycle' },
    { id: 'settings', label: 'Settings' },
  ],
  diagnostics: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'log', label: 'Log' },
  ],
  mindset: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'influences', label: 'Influences' },
    { id: 'journal', label: 'Journal' },
  ],
  brainhealth: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  relationship: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'overview', label: 'Relationships' },
  ],
}

export default function App() {
  const [active, setActive] = useLocalStorage('mos:active', 'today')
  // Sections the user has hidden in Settings (data is kept; nav is just tidied).
  const [hiddenRaw] = useLocalStorage('mos:settings:hidden', [])
  const hidden = Array.isArray(hiddenRaw) ? hiddenRaw : []
  const visiblePillars = PILLARS.filter((p) => !hidden.includes(p.id))
  // Redirect away from any removed or hidden section.
  useEffect(() => {
    const valid = new Set(['today', 'dream', 'settings', ...PILLARS.map((p) => p.id)])
    if (!valid.has(active) || hidden.includes(active)) setActive('today')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, setActive, hiddenRaw])
  const [dreamPage, setDreamPage] = useLocalStorage('mos:dream:active', 'goals')
  // One store for every section's active subpage; validated against SUBNAV below.
  const [subsRaw, setSubs] = useLocalStorage('mos:subpages', {})
  const subs = subsRaw && typeof subsRaw === 'object' ? subsRaw : {}
  const setSub = (pillar, id) => setSubs((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [pillar]: id }))

  // One-time migration: fold the old per-day meal plan into the unified meal store.
  const [meals, setMeals] = useLocalStorage('mos:meals', [])
  const [weekPlanForMigrate] = useLocalStorage('mos:menu:weekplan', {})
  const migratedRef = useRef(false)
  useEffect(() => {
    if (migratedRef.current) return
    if (Array.isArray(meals) && meals.length > 0) { migratedRef.current = true; return }
    if (weekPlanForMigrate && Object.keys(weekPlanForMigrate).length) {
      migratedRef.current = true
      setMeals(migrateWeekPlan(weekPlanForMigrate))
    }
  }, [meals, weekPlanForMigrate, setMeals])

  // One-time fix: reclassify mis-typed checkbox events (olive oil shot, water) as
  // meal items in the right slot, and drop them from the event lists.
  const [eventsForFix, setEventsFix] = useLocalStorage('mos:today:events', {})
  const [reclassDone, setReclassDone] = useLocalStorage('mos:flags:reclassifyV2', false)
  useEffect(() => {
    if (reclassDone) return
    const matches = []
    Object.keys(eventsForFix || {}).forEach((k) => {
      ;(eventsForFix[k] || []).forEach((e) => {
        const slot = reclassSlot(e.title)
        if (slot) matches.push({ title: (e.title || '').trim(), slot })
      })
    })
    if (!matches.length) return
    setEventsFix((prev) => {
      const next = {}
      Object.keys(prev || {}).forEach((k) => { next[k] = (prev[k] || []).filter((e) => !reclassSlot(e.title)) })
      return next
    })
    setMeals((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const additions = []
      matches.forEach((m) => {
        const key = m.title.toLowerCase()
        const exists = list.some((x) => (x.name || '').trim().toLowerCase() === key) || additions.some((a) => a.name.toLowerCase() === key)
        if (!exists) additions.push(normMeal({ name: m.title, kind: 'food', slot: m.slot, frequency: 'daily', startDate: '' }))
      })
      return additions.length ? [...list, ...additions] : list
    })
    setReclassDone(true)
  }, [reclassDone, eventsForFix, setEventsFix, setMeals, setReclassDone])

  // One-time migration into the unified Activity store (originals are kept).
  const [activitiesRaw, setActivitiesRaw] = useLocalStorage('mos:activities', [])
  const [protocolsForMigrate] = useLocalStorage('mos:menu:recipes', [])
  const actMigRef = useRef(false)
  useEffect(() => {
    if (actMigRef.current) return
    if (Array.isArray(activitiesRaw) && activitiesRaw.length > 0) { actMigRef.current = true; return }
    const hasLegacy =
      (eventsForFix && Object.keys(eventsForFix).length) ||
      (Array.isArray(meals) && meals.length) ||
      (weekPlanForMigrate && Object.keys(weekPlanForMigrate).length) ||
      (Array.isArray(protocolsForMigrate) && protocolsForMigrate.length)
    if (!hasLegacy) return
    actMigRef.current = true
    const mealsSource = Array.isArray(meals) && meals.length ? meals : migrateWeekPlan(weekPlanForMigrate)
    setActivitiesRaw(migrateToActivities({ events: eventsForFix, meals: mealsSource, protocols: protocolsForMigrate }))
  }, [activitiesRaw, eventsForFix, meals, protocolsForMigrate, setActivitiesRaw])
  const [collapsed, setCollapsed] = useLocalStorage('mos:sidebar:collapsed', false)
  const [location, setLocation] = useLocalStorage('mos:settings:location', 'Alameda')
  const [cycleConfig, setCycleConfig] = useLocalStorage('mos:settings:cycle', {
    lastPeriodStart: '',
    cycleLength: 28,
  })

  const today = new Date()
  // eslint-disable-next-line no-unused-vars
  const todayPhase = useMemo(
    () => phaseFor(today, cycleConfig.lastPeriodStart, cycleConfig.cycleLength),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cycleConfig.lastPeriodStart, cycleConfig.cycleLength, dateKey(today)],
  )

  // Cross-page nav: jump to a specific day in the home TODAY view.
  const [pendingDay, setPendingDay] = useState(null)
  const goToDay = (k) => { setPendingDay(k); setActive('today') }
  const [menuOpen, setMenuOpen] = useState(false)

  const isToday = active === 'today'
  const isDream = active === 'dream'
  const isSettings = active === 'settings'
  const isPillar = !isToday && !isDream && !isSettings

  const goToday = () => setActive('today')
  const ActivePillar = isPillar ? PILLAR_COMPONENTS[active] : null
  const activePillarMeta = PILLARS.find((p) => p.id === active)
  const activeLabel = isToday ? 'Today' : isDream ? 'Dream Planning' : isSettings ? 'Settings' : (activePillarMeta ? activePillarMeta.label : 'Menu')

  // The sub-page value + setter for whichever pillar is active.
  const activeSub = SUBNAV[active]
    ? (SUBNAV[active].some((s) => s.id === subs[active]) ? subs[active] : SUBNAV[active][0].id)
    : null
  const setActiveSub = (id) => setSub(active, id)

  return (
    <AddProvider>
    <div className="min-h-screen bg-cream text-stone-900">
      <TopNav activeLabel={activeLabel} onOpenMenu={() => setMenuOpen(true)} />
      <NavMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        active={active}
        pillars={visiblePillars}
        onGoToday={goToday}
        onGoPillar={(id) => setActive(id)}
        onGoSettings={() => setActive('settings')}
      />

      {/* Contextual second row — the active section's sub-pages. Mindset also
          carries Dream Planning, which opens into its own page set below. */}
      {isPillar && SUBNAV[active] && (
        <SubNav
          items={active === 'mindset' ? [...SUBNAV.mindset, { id: '__manifest', label: 'Dream Planning' }] : SUBNAV[active]}
          activeId={activeSub}
          onPick={(id) => { if (id === '__manifest') { setActive('dream'); setDreamPage('goals') } else setActiveSub(id) }}
        />
      )}
      {isDream && <DreamSubNav dreamPage={dreamPage} setDreamPage={setDreamPage} onExit={() => setActive('mindset')} />}

      {/* ── Main content ────────────────────────────────────── */}
      <main className="overflow-x-hidden px-6 py-10 md:px-10 lg:px-12">
        <div className="mx-auto max-w-5xl">
          {isToday && <Today cycleConfig={cycleConfig} location={location} setLocation={setLocation} pendingDay={pendingDay} clearPendingDay={() => setPendingDay(null)} goToCycle={() => { setActive('workout'); setSub('workout', 'cycle') }} />}
          {isDream && <DreamWorld page={dreamPage} cycleConfig={cycleConfig} />}
          {isPillar && ActivePillar && (
            <ActivePillar cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} subPage={activeSub || undefined} goToDay={goToDay} />
          )}
          {isSettings && <Settings />}
          <Footer />
        </div>
      </main>

      {/* Floating Settings — bottom-left, opposite the Add button */}
      <button
        onClick={() => setActive('settings')}
        title="Settings"
        aria-label="Settings"
        className="fixed bottom-6 left-6 z-40 flex h-11 w-11 items-center justify-center shadow-lg transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#1C1C1A', color: '#FAFAF7', borderRadius: '9999px' }}
      >
        <SettingsIcon size={18} />
      </button>
    </div>
    </AddProvider>
  )
}

// ── Top navigation bar ──────────────────────────────────────────────
// A slim, calm bar: a hairline "index" mark + the current section's name on the
// left, the account dot on the right. Tapping the mark opens the full index
// (NavMenu) — so eleven pillars no longer fight for room in a scroll strip.
function TopNav({ activeLabel, onOpenMenu }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3.5 md:px-10">
        <button onClick={onOpenMenu} aria-label="Open the index" className="group flex items-center gap-2 py-1">
          <span className="flex flex-col items-start gap-[4px]" aria-hidden>
            <span className="block h-px w-6 bg-stone-800 transition-all duration-300 group-hover:w-7" />
            <span className="block h-px w-7 bg-stone-800" />
            <span className="block h-px w-5 bg-stone-800 transition-all duration-300 group-hover:w-7" />
          </span>
        </button>
      </div>
    </header>
  )
}

// ── The Index — a full-screen contents menu for the eleven pillars ──
// Opens from the top bar. A Pinyon wordmark, Today as the anchor, then the
// pillars as a numbered serif index (two columns on wide screens), the current
// one inked. One tap goes anywhere and closes. Editorial, calm, and fast.
function NavMenu({ open, onClose, active, pillars, onGoToday, onGoPillar, onGoSettings }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  const go = (fn) => { fn(); onClose() }
  return (
    <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!open}>
      <div className="absolute inset-0 bg-cream" onClick={onClose} />

      {/* Close floats in the corner so the composition below can breathe */}
      <button onClick={onClose} aria-label="Close the index" className="absolute right-6 top-6 z-10 text-stone-400 transition-colors hover:text-stone-900 md:right-10 md:top-8"><X size={24} /></button>

      <div className={`no-scrollbar relative flex h-full w-full flex-col overflow-y-auto px-8 transition-all duration-300 md:px-12 ${open ? 'translate-y-0' : '-translate-y-3'}`}>
        <div className="mx-auto w-full max-w-lg pb-16 pt-16 md:pt-20">
          {/* Masthead — anchored at the top; the wordmark returns home */}
          <button onClick={() => go(onGoToday)} title="Home — Today" style={{ fontFamily: "'Pinyon Script', cursive" }} className="block text-3xl leading-none text-stone-800 transition-opacity hover:opacity-70 md:text-4xl">Melissa's Digital Planner</button>
          <div className="mt-5 h-px w-full bg-stone-200/80" />

          <h2 className="mt-9 font-serif text-4xl leading-none text-stone-900 md:text-5xl">Pillars of Health</h2>

          <div className="mt-7 grid grid-cols-1 gap-x-14 sm:grid-cols-2">
            {pillars.map((p) => {
              const on = active === p.id || (p.id === 'mindset' && active === 'dream')
              const Icon = p.icon
              return (
                <button key={p.id} onClick={() => go(() => onGoPillar(p.id))} className="group flex w-full items-center gap-4 py-3 text-left">
                  <Icon size={18} strokeWidth={1.5} className={`shrink-0 transition-colors ${on ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-700'}`} />
                  <span className={`font-serif text-2xl leading-tight transition-colors ${on ? 'font-medium text-stone-900' : 'text-stone-700 group-hover:text-stone-900'}`}>{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Contextual sub-navigation (a section's sub-pages) ───────────────
function SubNav({ items, activeId, onPick }) {
  return (
    <div className="border-b border-stone-200 bg-cream">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <nav className="no-scrollbar flex items-center gap-7 overflow-x-auto">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className={`relative whitespace-nowrap py-3 font-serif text-[15px] transition-colors ${
                activeId === s.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              {s.label}
              {activeId === s.id && <span className="absolute inset-x-0 -bottom-px h-px bg-stone-900" />}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

// Dream Planning sub-pages — fixed pages first, then the drag-reorderable set.
// Dream Planning sits inside Mindset, so a quiet label anchors the context.
function DreamSubNav({ dreamPage, setDreamPage, onExit }) {
  const [order, setOrder] = useLocalStorage('mos:dream:order', DREAM_REORDER)
  const [dragId, setDragId] = useState(null)
  const reorderIds = [
    ...order.filter((id) => DREAM_REORDER.includes(id)),
    ...DREAM_REORDER.filter((id) => !order.includes(id)),
  ]
  const labelOf = (id) => DREAM_PAGES.find((p) => p.id === id)?.label || id
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) return
    const next = reorderIds.filter((id) => id !== dragId)
    const at = next.indexOf(targetId)
    next.splice(at, 0, dragId)
    setOrder(next); setDragId(null)
  }
  const Tab = ({ id, draggable }) => (
    <button
      draggable={draggable}
      onDragStart={draggable ? () => setDragId(id) : undefined}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={draggable ? () => onDrop(id) : undefined}
      onDragEnd={draggable ? () => setDragId(null) : undefined}
      onClick={() => setDreamPage(id)}
      className={`relative whitespace-nowrap py-3 font-serif text-[15px] transition-colors ${
        dreamPage === id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === id ? 'opacity-40' : ''}`}
    >
      {labelOf(id)}
      {dreamPage === id && <span className="absolute inset-x-0 -bottom-px h-px bg-stone-900" />}
    </button>
  )
  return (
    <div className="border-b border-stone-200 bg-cream">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 md:px-10">
        <button
          onClick={onExit}
          className="flex shrink-0 items-center gap-1 text-stone-400 transition-colors hover:text-stone-900"
          title="Back to Mindset"
        >
          <ChevronLeft size={14} />
          <span className="kicker">Mindset</span>
        </button>
        <span className="h-4 w-px shrink-0 bg-stone-200" />
        <nav className="no-scrollbar flex flex-1 items-center gap-7 overflow-x-auto">
          {DREAM_FIXED.map((id) => <Tab key={id} id={id} draggable={false} />)}
          {reorderIds.map((id) => <Tab key={id} id={id} draggable />)}
        </nav>
      </div>
    </div>
  )
}
