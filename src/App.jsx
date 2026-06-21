import React, { useMemo } from 'react'
import {
  UtensilsCrossed, Activity, Heart, Briefcase, Code2, Home, Building2, Users,
  ChevronLeft, Sparkles, PanelLeftClose, PanelLeftOpen, CalendarDays,
} from 'lucide-react'
import { useLocalStorage } from './hooks/useLocalStorage'
import { phaseFor } from './lib/cycle'
import { longDate, dateKey } from './lib/date'

import Footer from './components/shared/Footer'
import Today from './components/Today'
import MealPlanning from './components/MealPlanning'
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
  { id: 'menu', label: 'Meal Planning', icon: UtensilsCrossed },
  { id: 'workout', label: 'Health & Fitness', icon: Activity },
  { id: 'relationship', label: 'Relationship', icon: Heart },
  { id: 'career', label: 'Landing an EA Offer', icon: Briefcase },
  { id: 'app', label: 'Designing An App', icon: Code2 },
  { id: 'household', label: 'Household', icon: Home },
  { id: 'apartments', label: 'Housing', icon: Building2 },
  { id: 'parents', label: 'Parents', icon: Users, ready: false },
]

const PILLAR_COMPONENTS = {
  menu: MealPlanning,
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
    { id: 'planner', label: 'Schedule' },
    { id: 'grocery', label: "What's In My Fridge" },
    { id: 'recipes', label: 'Recipes' },
  ],
}

const CursiveTitle = ({ className = '', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`block w-full text-center leading-none ${onClick ? 'cursor-pointer' : 'cursor-default'} ${className}`}
    style={{ fontFamily: "'Pinyon Script', cursive" }}
  >
    Melissa's Digital Planner
  </button>
)

export default function App() {
  const [active, setActive] = useLocalStorage('mos:active', 'today')
  const [dreamPage, setDreamPage] = useLocalStorage('mos:dream:active', 'goals')
  const [menuSub, setMenuSub] = useLocalStorage('mos:menu:subpage', 'planner')
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

  const isToday = active === 'today'
  const isDream = active === 'dream'
  const isPillar = !isToday && !isDream

  const goToday = () => setActive('today')
  const ActivePillar = isPillar ? PILLAR_COMPONENTS[active] : null
  const activePillarMeta = PILLARS.find((p) => p.id === active)

  return (
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
              <div className="mb-6 flex justify-end">
                <button
                  onClick={() => setCollapsed(true)}
                  className="text-stone-400 hover:text-stone-900"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>

              {isToday && (
                <SidebarToday
                  today={today}
                  location={location}
                  setLocation={setLocation}
                  setActive={setActive}
                  setDreamPage={setDreamPage}
                  pillars={PILLARS}
                />
              )}

              {isDream && (
                <SidebarDream goToday={goToday} dreamPage={dreamPage} setDreamPage={setDreamPage} />
              )}

              {isPillar && (
                <div className="space-y-6">
                  <CursiveTitle className="text-3xl text-stone-900" onClick={goToday} />
                  {SUBNAV[active] && (
                    <nav className="space-y-1 border-t border-stone-200 pt-5">
                      <p className="kicker text-stone-400 mb-2">{activePillarMeta?.label}</p>
                      {SUBNAV[active].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setMenuSub(s.id)}
                          className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                            menuSub === s.id ? 'bg-stone-900 text-cream' : 'text-stone-700 hover:bg-stone-100'
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
            {isToday && <Today cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} />}
            {isDream && <DreamWorld page={dreamPage} cycleConfig={cycleConfig} />}
            {isPillar && ActivePillar && (
              <ActivePillar cycleConfig={cycleConfig} subPage={active === 'menu' ? menuSub : undefined} />
            )}
            <Footer />
          </div>
        </main>
      </div>
    </div>
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
function SidebarToday({ today, location, setLocation, setActive, setDreamPage, pillars }) {
  return (
    <div className="space-y-7">
      <div>
        <p className="kicker text-stone-400 mb-2">{longDate(today)}</p>
        <CursiveTitle className="text-[2.6rem] text-stone-900" onClick={null} />
      </div>

      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Alameda"
        className="w-full bg-transparent border-b border-stone-200 pb-1 text-sm text-stone-600 outline-none focus:border-stone-900 transition-colors"
      />

      <button
        type="button"
        onClick={() => {
          setActive('dream')
          setDreamPage('goals')
        }}
        className="group block w-full overflow-hidden rounded-sm border border-stone-300 bg-stone-900 px-5 py-5 text-left text-cream transition-colors hover:bg-stone-800"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-sand" />
          <span className="font-serif italic text-2xl leading-none">Manifestations</span>
        </div>
      </button>

      <div>
        <p className="kicker text-stone-400 mb-3">What I'm focused on.</p>
        <nav className="space-y-1">
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

      <div className="overflow-hidden rounded-sm border border-stone-300 bg-stone-900 px-5 py-5 text-cream">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-sand" />
          <span className="font-serif italic text-2xl leading-none">Manifestations</span>
        </div>
      </div>

      <nav className="space-y-1">
        {DREAM_FIXED.map((id) => (
          <NavButton key={id} id={id} draggable={false} />
        ))}
        {reorderIds.map((id) => (
          <NavButton key={id} id={id} draggable />
        ))}
      </nav>
    </div>
  )
}
