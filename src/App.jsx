import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  UtensilsCrossed, Activity, Dumbbell, Heart, Briefcase, Code2, Home, Building2, Users,
  ChevronLeft, Sparkles, PanelLeftClose, PanelLeftOpen, CalendarDays,
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
import Relationship from './components/Relationship'
import Career from './components/Career'
import DesigningApp from './components/DesigningApp'
import Household from './components/Household'
import Housing from './components/Housing'
import Parents from './components/Parents'
import DreamWorld, { DREAM_PAGES, DREAM_FIXED, DREAM_REORDER } from './components/DreamWorld'
import { AccountDot } from './components/shared/AccountPanel'

const PILLARS = [
  { id: 'menu', label: 'Nutrition', icon: UtensilsCrossed },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'workout', label: 'Health & Wellness', icon: Activity },
  { id: 'relationship', label: 'Relationship', icon: Heart },
  { id: 'career', label: 'Landing an EA Offer', icon: Briefcase },
  { id: 'app', label: 'Designing An App', icon: Code2 },
  { id: 'household', label: 'Household', icon: Home },
  { id: 'apartments', label: 'Housing', icon: Building2 },
  { id: 'parents', label: 'Parents', icon: Users, ready: false },
]

const PILLAR_COMPONENTS = {
  menu: MealPlanning,
  fitness: Fitness,
  workout: Workout,
  relationship: Relationship,
  career: Career,
  app: DesigningApp,
  household: Household,
  apartments: Housing,
  parents: Parents,
}

// Category sub-navigation shown when inside a section.
const SUBNAV = {
  menu: [
    { id: 'diet', label: 'Diet' },
    { id: 'grocery', label: "What's In My Fridge" },
  ],
  fitness: [
    { id: 'workouts', label: 'Workouts' },
  ],
  workout: [
    { id: 'protocols', label: 'Protocols' },
    { id: 'cycle', label: 'Cycle' },
  ],
}

export default function App() {
  const [active, setActive] = useLocalStorage('mos:active', 'today')
  const [dreamPage, setDreamPage] = useLocalStorage('mos:dream:active', 'goals')
  const [menuSubRaw, setMenuSub] = useLocalStorage('mos:menu:subpage', 'diet')
  // 'Schedule' was renamed to 'Diet'; coerce any stale stored value.
  const menuSub = menuSubRaw === 'grocery' ? 'grocery' : 'diet'
  const [workoutSubRaw, setWorkoutSub] = useLocalStorage('mos:workout:subpage', 'protocols')
  // Schedule/Practices were removed; coerce any stale value to Protocols.
  const workoutSub = workoutSubRaw === 'cycle' ? 'cycle' : 'protocols'
  const [fitnessSub, setFitnessSub] = useLocalStorage('mos:fitness:subpage', 'workouts')

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
  const isPillar = !isToday && !isDream

  const goToday = () => setActive('today')
  const ActivePillar = isPillar ? PILLAR_COMPONENTS[active] : null
  const activePillarMeta = PILLARS.find((p) => p.id === active)

  // The sub-page value + setter for whichever pillar is active.
  const activeSub = active === 'menu' ? menuSub : active === 'fitness' ? fitnessSub : active === 'workout' ? workoutSub : null
  const setActiveSub = active === 'menu' ? setMenuSub : active === 'fitness' ? setFitnessSub : active === 'workout' ? setWorkoutSub : () => {}

  return (
    <AddProvider>
    <div className="min-h-screen bg-cream text-stone-900">
      <div className="mx-auto flex max-w-[1400px] flex-col lg:flex-row">
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside
          className={`lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-stone-200 py-8 transition-all ${
            collapsed ? 'lg:w-[76px] px-3' : 'lg:w-[320px] px-7'
          }`}
        >
          {collapsed ? (
            <CollapsedRail
              setCollapsed={setCollapsed}
              setActive={setActive}
              setDreamPage={setDreamPage}
              pillars={PILLARS}
              active={active}
            />
          ) : (
            <>
              {isToday && (
                <div className="mb-6 flex justify-end">
                  <button
                    onClick={() => setCollapsed(true)}
                    className="text-stone-400 hover:text-stone-900"
                    title="Collapse sidebar"
                  >
                    <PanelLeftClose size={18} />
                  </button>
                </div>
              )}

              {isToday && (
                <SidebarToday setActive={setActive} setDreamPage={setDreamPage} pillars={PILLARS} />
              )}

              {isDream && (
                <SidebarDream goToday={goToday} dreamPage={dreamPage} setDreamPage={setDreamPage} />
              )}

              {isPillar && (
                <div className="space-y-6">
                  <button
                    type="button"
                    onClick={goToday}
                    className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    <ChevronLeft size={16} /> Back to Today
                  </button>
                  {SUBNAV[active] && (
                    <nav className="space-y-1 border-t border-stone-200 pt-5">
                      <p className="kicker text-stone-400 mb-2">{activePillarMeta?.label}</p>
                      {SUBNAV[active].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setActiveSub(s.id)}
                          className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                            activeSub === s.id ? 'bg-stone-900 text-cream' : 'text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </nav>
                  )}
                </div>
              )}
            </>
          )}
        </aside>

        {/* ── Main content ────────────────────────────────────── */}
        <main className="flex-1 overflow-x-hidden px-6 py-8 md:px-10 lg:px-12">
          <div className="mx-auto max-w-5xl">
            {isToday && <Today cycleConfig={cycleConfig} location={location} setLocation={setLocation} pendingDay={pendingDay} clearPendingDay={() => setPendingDay(null)} />}
            {isDream && <DreamWorld page={dreamPage} cycleConfig={cycleConfig} />}
            {isPillar && ActivePillar && (
              <ActivePillar cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} subPage={activeSub || undefined} goToDay={goToDay} />
            )}
            <Footer />
          </div>
        </main>
      </div>
    </div>
    </AddProvider>
  )
}

// ── Collapsed icon rail ─────────────────────────────────────────────
function CollapsedRail({ setCollapsed, setActive, setDreamPage, pillars, active }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={() => setCollapsed(false)} className="mb-1 text-stone-400 hover:text-stone-900" title="Expand sidebar">
        <PanelLeftOpen size={18} />
      </button>
      <div className="mb-3"><AccountDot /></div>

      <RailButton icon={CalendarDays} label="Today" active={active === 'today'} onClick={() => setActive('today')} />
      <RailButton
        icon={Sparkles}
        label="Manifestations"
        active={active === 'dream'}
        onClick={() => {
          setActive('dream')
          setDreamPage('goals')
        }}
      />

      <div className="my-2 h-px w-6 bg-stone-200" />

      {pillars.map((p) => {
        const ready = p.ready !== false
        return (
          <RailButton
            key={p.id}
            icon={p.icon}
            label={p.label}
            active={active === p.id}
            disabled={!ready}
            onClick={() => ready && setActive(p.id)}
          />
        )
      })}
    </div>
  )
}

function RailButton({ icon: Icon, label, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-10 w-10 items-center justify-center transition-colors ${
        active ? 'bg-stone-900 text-cream' : disabled ? 'text-stone-300' : 'text-stone-600 hover:bg-stone-100'
      }`}
    >
      <Icon size={18} />
    </button>
  )
}

// ── Sidebar: default (Today selected) ──────────────────────────────
function SidebarToday({ setActive, setDreamPage, pillars }) {
  return (
    <div className="space-y-7">
      <div>
        <p className="kicker text-stone-400 mb-3">What I'm focused on.</p>
        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setActive('dream')
              setDreamPage('goals')
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <span className="w-4 shrink-0" />
            <span>Manifestations</span>
          </button>
          {pillars.map((p) => {
            const Icon = p.icon
            const ready = p.ready !== false
            return (
              <button
                key={p.id}
                type="button"
                disabled={!ready}
                onClick={() => ready && setActive(p.id)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                  ready ? 'text-stone-700 hover:bg-stone-100' : 'cursor-not-allowed text-stone-300'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span>{p.label}</span>
                {!ready && <span className="kicker ml-auto text-stone-300">soon</span>}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

// ── Sidebar: Manifestations focused mode ───────────────────────────
function SidebarDream({ goToday, dreamPage, setDreamPage }) {
  const [order, setOrder] = useLocalStorage('mos:dream:order', DREAM_REORDER)
  const [dragId, setDragId] = React.useState(null)

  // Reconcile saved order with the canonical reorderable set (handles added/removed pages).
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
    setOrder(next)
    setDragId(null)
  }

  const NavButton = ({ id, draggable }) => (
    <button
      type="button"
      draggable={draggable}
      onDragStart={draggable ? () => setDragId(id) : undefined}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={draggable ? () => onDrop(id) : undefined}
      onDragEnd={draggable ? () => setDragId(null) : undefined}
      onClick={() => setDreamPage(id)}
      className={`block w-full px-3 py-2.5 text-left text-sm transition-colors ${
        dreamPage === id ? 'bg-stone-900 text-cream' : 'text-stone-700 hover:bg-stone-100'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === id ? 'opacity-40' : ''}`}
    >
      {labelOf(id)}
    </button>
  )

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={goToday}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors"
      >
        <ChevronLeft size={16} /> Back to Today
      </button>

      <h2 className="font-serif italic text-2xl leading-none text-stone-900">Manifestations</h2>

      <nav className="space-y-1">
        {DREAM_FIXED.map((id) => (
          <NavButton key={id} id={id} draggable={false} />
        ))}
        {reorderIds.map((id) => (
          <React.Fragment key={id}>
            <NavButton id={id} draggable />
            {id === 'haircare' && (
              <button
                type="button"
                onClick={() => setDreamPage('haircare-recipes')}
                className={`block w-full py-2 pl-9 pr-3 text-left text-sm transition-colors ${
                  dreamPage === 'haircare-recipes' ? 'bg-stone-900 text-cream' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                Recipes
              </button>
            )}
          </React.Fragment>
        ))}
      </nav>
    </div>
  )
}
