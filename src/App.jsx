import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  UtensilsCrossed, Activity, Dumbbell, Brain, Scissors, Droplets, Heart, Briefcase, Code2, Home, Building2, Users,
  ChevronLeft, Sparkles, PanelLeftClose, PanelLeftOpen, CalendarDays, ClipboardList, Flower2, Gem, FlaskConical, Sun,
  Settings as SettingsIcon,
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
import Haircare from './components/Haircare'
import Bodycare from './components/Bodycare'
import Skincare from './components/Skincare'
import Aesthetics from './components/Aesthetics'
import Spirituality from './components/Spirituality'
import Diagnostics from './components/Diagnostics'
import Relationship from './components/Relationship'
import Settings from './components/Settings'
import DreamWorld, { DREAM_PAGES, DREAM_FIXED, DREAM_REORDER } from './components/DreamWorld'
import { AccountDot } from './components/shared/AccountPanel'

const PILLARS = [
  { id: 'mindset', label: 'Mindset', icon: Brain },
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
    { id: 'ingredients', label: "Today's Ingredients" },
    { id: 'recipes', label: 'Recipes' },
    { id: 'grocery', label: "What's In My Fridge" },
    { id: 'monthly', label: 'Monthly' },
  ],
  fitness: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  workout: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'cycle', label: 'Cycle' },
    { id: 'settings', label: 'Settings' },
    { id: 'monthly', label: 'Monthly' },
  ],
  diagnostics: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'log', label: 'Log' },
    { id: 'monthly', label: 'Monthly' },
  ],
  mindset: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'influences', label: 'Influences' },
    { id: 'journal', label: 'Journal' },
    { id: 'monthly', label: 'Monthly' },
  ],
  relationship: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'overview', label: 'Relationships' },
    { id: 'monthly', label: 'Monthly' },
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

  const isToday = active === 'today'
  const isDream = active === 'dream'
  const isSettings = active === 'settings'
  const isPillar = !isToday && !isDream && !isSettings

  const goToday = () => setActive('today')
  const ActivePillar = isPillar ? PILLAR_COMPONENTS[active] : null
  const activePillarMeta = PILLARS.find((p) => p.id === active)

  // The sub-page value + setter for whichever pillar is active.
  const activeSub = SUBNAV[active]
    ? (SUBNAV[active].some((s) => s.id === subs[active]) ? subs[active] : SUBNAV[active][0].id)
    : null
  const setActiveSub = (id) => setSub(active, id)

  return (
    <AddProvider>
    <div className="min-h-screen bg-cream text-stone-900">
      <TopNav
        active={active}
        pillars={visiblePillars}
        onGoToday={goToday}
        onGoDream={() => { setActive('dream'); setDreamPage('goals') }}
        onGoPillar={(id) => setActive(id)}
        onGoSettings={() => setActive('settings')}
      />

      {/* Contextual second row — the active section's sub-pages */}
      {isPillar && SUBNAV[active] && (
        <SubNav items={SUBNAV[active]} activeId={activeSub} onPick={setActiveSub} />
      )}
      {isDream && <DreamSubNav dreamPage={dreamPage} setDreamPage={setDreamPage} />}

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
    </div>
    </AddProvider>
  )
}

// ── Top navigation bar ──────────────────────────────────────────────
// A slim wordmark row over a horizontally-scrollable strip of sections. The
// active section is inked with a hairline underline; the rest stay quiet.
function TopNav({ active, pillars, onGoToday, onGoDream, onGoPillar, onGoSettings }) {
  const links = [
    { id: 'today', label: 'Today', onClick: onGoToday, on: active === 'today' },
    { id: 'dream', label: 'Manifestations', onClick: onGoDream, on: active === 'dream' },
    ...pillars.map((p) => ({ id: p.id, label: p.label, onClick: () => onGoPillar(p.id), on: active === p.id })),
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="flex items-center justify-between pt-3.5 pb-2">
          <button onClick={onGoToday} className="leading-none text-stone-900" style={{ fontFamily: "'Pinyon Script', cursive" }}>
            <span className="text-[26px]">Melissa</span>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={onGoSettings}
              title="Settings"
              className={`transition-colors ${active === 'settings' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-900'}`}
            >
              <SettingsIcon size={17} />
            </button>
            <AccountDot />
          </div>
        </div>

        <nav className="no-scrollbar -mb-px flex items-center gap-x-4 overflow-x-auto lg:gap-x-5 xl:justify-between">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={l.onClick}
              className={`whitespace-nowrap border-b-2 pb-2.5 pt-0.5 text-[10px] uppercase tracking-[0.14em] transition-colors ${
                l.on ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
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
              className={`relative whitespace-nowrap py-3 font-serif text-[15px] italic transition-colors ${
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

// Manifestations sub-pages — fixed pages first, then the drag-reorderable set.
function DreamSubNav({ dreamPage, setDreamPage }) {
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
      className={`relative whitespace-nowrap py-3 font-serif text-[15px] italic transition-colors ${
        dreamPage === id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === id ? 'opacity-40' : ''}`}
    >
      {labelOf(id)}
      {dreamPage === id && <span className="absolute inset-x-0 -bottom-px h-px bg-stone-900" />}
    </button>
  )
  return (
    <div className="border-b border-stone-200 bg-cream">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <nav className="no-scrollbar flex items-center gap-7 overflow-x-auto">
          {DREAM_FIXED.map((id) => <Tab key={id} id={id} draggable={false} />)}
          {reorderIds.map((id) => <Tab key={id} id={id} draggable />)}
        </nav>
      </div>
    </div>
  )
}
