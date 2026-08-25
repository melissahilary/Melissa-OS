import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  UtensilsCrossed, Activity, Dumbbell, Brain, Scissors, Droplets, Heart, Briefcase, Code2, Home, Building2, Users,
  ChevronLeft, ChevronDown, Compass, PanelLeftClose, PanelLeftOpen, CalendarDays, CalendarRange, ClipboardList, Flower2, Gem, FlaskConical, Sun,
  Target, UserRound, MapPin, Shirt, Car, TrendingUp, Sparkles, MessageCircle,
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
import AskConcierge from './components/AskConcierge'

const PILLARS = [
  { id: 'mindset', label: 'Mindset', icon: Compass },
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
    { id: 'morning', label: 'Morning Routine' },
    { id: 'evening', label: 'Evening Routine' },
    { id: 'products', label: 'Products Used' },
  ],
  haircare: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ],
  aesthetics: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'treatments', label: 'Treatments' },
    { id: 'services', label: 'Services' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'devices', label: 'Devices' },
    { id: 'prescribed', label: 'Prescribed' },
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
    { id: 'diet', label: 'Diet' },
    { id: 'recipes', label: 'Recipes' },
    { id: 'grocery', label: "What's In My Fridge" },
  ],
  fitness: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'training', label: 'Training' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'products', label: 'Products' },
    { id: 'devices', label: 'Devices' },
  ],
  workout: [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'cycle', label: 'Cycle' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'labs', label: 'Labs' },
    { id: 'products', label: 'Products' },
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
    { id: 'mood', label: 'Mood' },
    { id: 'gratitude', label: 'Gratitude' },
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
  const [askOpen, setAskOpen] = useState(false)
  // The chosen wardrobe palette re-skins the whole app via CSS variables.
  const [themeRaw] = useLocalStorage('mos:settings:theme', 'porcelain')
  useEffect(() => {
    const t = typeof themeRaw === 'string' ? themeRaw : 'porcelain'
    document.documentElement.setAttribute('data-mos-theme', t)
  }, [themeRaw])

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

  // Every sub-page carries a serif title at the top. Generic calendar views
  // (Weekly/Monthly) title with the pillar name; named views (Influences,
  // Journal, Recipes, a Dream chapter…) title with their own name.
  const genericSub = activeSub === 'weekly' || activeSub === 'monthly'
  const pillarSubLabel = SUBNAV[active] && SUBNAV[active].find((s) => s.id === activeSub)?.label
  const pageTitle = isDream
    ? null
    : isPillar
      ? (genericSub ? activePillarMeta?.label : (pillarSubLabel || activePillarMeta?.label))
      : null

  return (
    <AddProvider>
    <div className="min-h-screen bg-cream text-stone-900">
      <TopNav onOpenMenu={() => setMenuOpen(true)} onGoHome={goToday} showWordmark={!isToday} onAsk={() => setAskOpen(true)} />
      <NavMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        active={active}
        pillars={visiblePillars}
        onGoToday={goToday}
        onGoPillar={(id) => setActive(id)}
        onGoDream={() => { setActive('dream'); setDreamPage('goals') }}
        onGoSettings={() => setActive('settings')}
      />

      {/* Contextual second row — the active section's sub-pages. Mindset also
          carries Dream Planning, which opens into its own page set below. */}
      {isPillar && SUBNAV[active] && (
        <SubNav
          items={SUBNAV[active]}
          activeId={activeSub}
          onPick={setActiveSub}
        />
      )}

      {/* ── Main content ────────────────────────────────────── */}
      <main className="overflow-x-hidden px-6 py-10 md:px-10 lg:px-12">
        <div className="mx-auto max-w-5xl">
          {pageTitle && <h1 className="mb-9 text-center font-serif text-4xl text-stone-900 md:text-5xl">{pageTitle}</h1>}
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

      <AskConcierge open={askOpen} onClose={() => setAskOpen(false)} />
    </div>
    </AddProvider>
  )
}

// ── Top navigation bar ──────────────────────────────────────────────
// A slim, calm bar: the hairline "index" mark on the left opens the full index
// (NavMenu); the centered cursive wordmark is a persistent masthead that taps
// home to Today, so home is always one tap away from any pillar page.
function TopNav({ onOpenMenu, onGoHome, showWordmark = true, onAsk }) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="relative mx-auto flex max-w-[1400px] items-center px-6 py-3.5 md:px-10">
        <button onClick={onOpenMenu} aria-label="Open the index" className="group relative z-10 flex items-center gap-2 py-1">
          <span className="flex flex-col items-start gap-[4px]" aria-hidden>
            <span className="block h-px w-6 bg-stone-800 transition-all duration-300 group-hover:w-7" />
            <span className="block h-px w-7 bg-stone-800" />
            <span className="block h-px w-5 bg-stone-800 transition-all duration-300 group-hover:w-7" />
          </span>
        </button>
        {onAsk && (
          <button onClick={onAsk} aria-label="Esmé, your concierge" title="Esmé, your concierge" className="relative z-10 ml-auto flex items-center gap-2 rounded-full border border-stone-300 py-1.5 pl-2 pr-3.5 text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 font-serif italic text-[11px] leading-none">E</span>
            <span className="text-xs tracking-wide" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '14px' }}>Esmé</span>
          </button>
        )}
        {/* On the home (Today) page the big cursive masthead already carries the
            name, so the bar wordmark is hidden there to avoid showing it twice. */}
        {showWordmark && (
          <button
            onClick={onGoHome}
            title="Home — Today"
            style={{ fontFamily: "'Pinyon Script', cursive" }}
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl leading-none text-stone-800 transition-opacity hover:opacity-70 md:text-2xl"
          >
            Melissa's Digital Planner
          </button>
        )}
      </div>
    </header>
  )
}

// ── The Index — a full-screen contents menu for the eleven pillars ──
// Opens from the top bar. A Pinyon wordmark, Today as the anchor, then the
// pillars as a numbered serif index (two columns on wide screens), the current
// one inked. One tap goes anywhere and closes. Editorial, calm, and fast.
function NavMenu({ open, onClose, active, pillars, onGoToday, onGoPillar, onGoDream, onGoSettings }) {
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
        <div className="mx-auto w-full max-w-xl pb-16 pt-14 md:pt-20">
          {/* The index hero — the cursive wordmark now reads "Pillars of Health";
              tapping it still returns home to Today. */}
          <button onClick={() => go(onGoToday)} title="Home — Today" style={{ fontFamily: "'Pinyon Script', cursive" }} className="block w-full text-center text-4xl leading-tight text-stone-800 transition-opacity hover:opacity-70 md:text-6xl">Pillars of Health</button>

          <div className="mx-auto mt-12 grid w-fit grid-cols-1 gap-x-16 sm:grid-cols-2">
            {pillars.map((p) => {
              const on = active === p.id
              const Icon = p.icon
              return (
                <button key={p.id} onClick={() => go(() => onGoPillar(p.id))} className="group flex w-full items-center gap-4 py-3.5 text-left">
                  <Icon size={19} strokeWidth={1.5} className={`shrink-0 transition-colors ${on ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-700'}`} />
                  <span className="relative inline-block font-serif text-2xl leading-tight">
                    <span className={`transition-colors ${on ? 'text-stone-900' : 'text-stone-700 group-hover:text-stone-900'}`}>{p.label}</span>
                    <span className={`absolute -bottom-1 left-0 h-px bg-stone-900 transition-all duration-300 ${on ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                  </span>
                </button>
              )
            })}
          </div>

          {/* Dream Planning lives apart from the pillars — a small indulgence you
              step into. A soft inked capsule with a sparkle, centred below. */}
          <div className="mt-14 flex justify-center">
            <button
              onClick={() => go(onGoDream)}
              className={`group inline-flex items-center gap-2.5 rounded-full px-7 py-3 font-serif text-lg tracking-wide transition-all duration-300 hover:scale-[1.03] hover:shadow-lg ${
                active === 'dream' ? 'bg-stone-900 text-cream' : 'bg-stone-900 text-cream/95 shadow-md'
              }`}
            >
              <Sparkles size={17} strokeWidth={1.5} className="transition-transform duration-500 group-hover:rotate-12" />
              Dream Planning
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Contextual sub-navigation (a section's sub-pages) ───────────────
// Sub-page nav for the pillars — a quiet row of serif tabs where the active one
// inks into a stone pill, echoing the app's dark Add/settings buttons.
function SubNav({ items, activeId, onPick }) {
  return (
    <div className="border-b border-stone-200 bg-cream">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <nav className="no-scrollbar flex items-center justify-center gap-1 overflow-x-auto py-2.5">
          {items.map((s) => {
            const on = activeId === s.id
            return (
              <button
                key={s.id}
                onClick={() => onPick(s.id)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 font-serif text-[15px] transition-colors ${
                  on ? 'bg-stone-900 text-cream' : 'text-stone-400 hover:text-stone-800'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

// An icon per Dream chapter, so the index reads as a set of distinct places
// rather than a wall of similar serif words.
const DREAM_ICON = {
  goals: Target,
  week: CalendarRange,
  calendar: CalendarDays,
  self: UserRound,
  outings: MapPin,
  skincare: Flower2,
  wardrobe: Shirt,
  devices: Car,
  home: Home,
  investments: TrendingUp,
  haircare: Scissors,
}

// Dream Planning has too many chapters for a strip, so its nav is a "chapter
// index": the current chapter reads as a heading you tap to reveal a paneled
// table of contents (icons + drag-to-reorder). Fixed pages first, then the set.
function DreamSubNav({ dreamPage, setDreamPage, onExit }) {
  const [order, setOrder] = useLocalStorage('mos:dream:order', DREAM_REORDER)
  const [open, setOpen] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [pos, setPos] = useState(null)
  const boxRef = useRef(null)
  const triggerRef = useRef(null)
  const reorderIds = [
    ...order.filter((id) => DREAM_REORDER.includes(id)),
    ...DREAM_REORDER.filter((id) => !order.includes(id)),
  ]
  const allIds = [...DREAM_FIXED, ...reorderIds]
  const labelOf = (id) => DREAM_PAGES.find((p) => p.id === id)?.label || id
  const CurrentIcon = DREAM_ICON[dreamPage] || Compass

  // Fixed-position the panel from the trigger's rect, clamped into the viewport
  // so it never runs off the right edge on a phone.
  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const w = Math.min(288, window.innerWidth - 24)
      const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12))
      setPos({ top: Math.round(r.bottom + 8), left: Math.round(left), width: w })
    }
    place()
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId || DREAM_FIXED.includes(targetId)) return
    const next = reorderIds.filter((id) => id !== dragId)
    const at = next.indexOf(targetId)
    next.splice(at, 0, dragId)
    setOrder(next); setDragId(null)
  }

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

        <div ref={boxRef} className="py-2">
          <button
            ref={triggerRef}
            onClick={() => setOpen((o) => !o)}
            className="group flex items-center gap-2 py-1 text-stone-900"
            aria-expanded={open}
          >
            <CurrentIcon size={16} strokeWidth={1.75} className="text-stone-500" />
            <span className="font-serif text-[17px]">{labelOf(dreamPage)}</span>
            <ChevronDown size={15} className={`text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && pos && (
            <div
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
              className="z-30 overflow-hidden rounded-2xl border border-stone-200 bg-cream shadow-xl shadow-stone-900/10"
            >
              <div className="flex items-center justify-between px-4 pb-1.5 pt-3">
                <span className="kicker text-stone-400">Chapters</span>
                <span className="select-none text-base leading-none text-stone-300" style={{ fontFamily: "'Cormorant Garamond', serif" }}>❦</span>
              </div>
              <div className="max-h-[70vh] overflow-y-auto pb-2">
                {allIds.map((id) => {
                  const Icon = DREAM_ICON[id] || Compass
                  const on = dreamPage === id
                  const draggable = !DREAM_FIXED.includes(id)
                  return (
                    <button
                      key={id}
                      draggable={draggable}
                      onDragStart={draggable ? () => setDragId(id) : undefined}
                      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
                      onDrop={draggable ? () => onDrop(id) : undefined}
                      onDragEnd={draggable ? () => setDragId(null) : undefined}
                      onClick={() => { setDreamPage(id); setOpen(false) }}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                        on ? 'bg-stone-100/70 text-stone-900' : 'text-stone-500 hover:bg-stone-100/60 hover:text-stone-800'
                      } ${dragId === id ? 'opacity-40' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      <Icon size={15} strokeWidth={1.75} className={on ? 'text-stone-700' : 'text-stone-400'} />
                      <span className="flex-1 font-serif text-[15px]">{labelOf(id)}</span>
                      {on && <span className="select-none text-sm leading-none text-stone-400" style={{ fontFamily: "'Cormorant Garamond', serif" }}>❦</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
