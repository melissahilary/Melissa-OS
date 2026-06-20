import React, { useMemo } from 'react'
import {
  UtensilsCrossed, Activity, Heart, Briefcase, Code2, Home, Building2, Users,
  ChevronLeft, Sparkles,
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
import DreamWorld, { DREAM_PAGES } from './components/DreamWorld'

const PILLARS = [
  { id: 'menu', label: 'Meal Planning', icon: UtensilsCrossed },
  { id: 'workout', label: 'Health & Fitness', icon: Activity },
  { id: 'relationship', label: 'Relationship', icon: Heart },
  { id: 'career', label: 'Landing an EA Offer', icon: Briefcase },
  { id: 'glow', label: 'Designing An App', icon: Code2 },
  { id: 'household', label: 'Household', icon: Home },
  { id: 'apartments', label: 'Housing', icon: Building2 },
  { id: 'parents', label: 'Parents', icon: Users, ready: false },
]

const PILLAR_COMPONENTS = {
  menu: MealPlanning,
  workout: Workout,
  relationship: Relationship,
  career: Career,
  glow: DesigningApp,
  household: Household,
  apartments: Housing,
  parents: Parents,
}

const CursiveTitle = ({ className = '', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`block text-left leading-none ${onClick ? 'cursor-pointer' : 'cursor-default'} ${className}`}
    style={{ fontFamily: "'Pinyon Script', cursive" }}
  >
    Melissa's Digital Planner
  </button>
)

export default function App() {
  const [active, setActive] = useLocalStorage('mos:active', 'today')
  const [dreamPage, setDreamPage] = useLocalStorage('mos:dream:active', 'overview')
  const [location, setLocation] = useLocalStorage('mos:settings:location', 'Alameda')
  const [cycleConfig, setCycleConfig] = useLocalStorage('mos:settings:cycle', {
    lastPeriodStart: '',
    cycleLength: 28,
  })

  const today = new Date()
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

  return (
    <div className="min-h-screen bg-cream text-stone-900">
      <div className="mx-auto flex max-w-[1400px] flex-col lg:flex-row">
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-[320px] lg:shrink-0 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-stone-200 px-7 py-8">
          {isToday && (
            <SidebarToday
              today={today}
              location={location}
              setLocation={setLocation}
              setActive={setActive}
              setDreamPage={setDreamPage}
              pillars={PILLARS}
              active={active}
            />
          )}

          {isDream && (
            <SidebarDream
              goToday={goToday}
              dreamPage={dreamPage}
              setDreamPage={setDreamPage}
            />
          )}

          {isPillar && (
            <div className="space-y-6">
              <CursiveTitle className="text-3xl text-stone-900" onClick={goToday} />
            </div>
          )}
        </aside>

        {/* ── Main content ────────────────────────────────────── */}
        <main className="flex-1 overflow-x-hidden px-6 py-8 md:px-10 lg:px-12">
          <div className="mx-auto max-w-5xl">
            {isToday && (
              <Today cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} />
            )}
            {isDream && (
              <DreamWorld page={dreamPage} cycleConfig={cycleConfig} />
            )}
            {isPillar && ActivePillar && <ActivePillar cycleConfig={cycleConfig} />}
            <Footer />
          </div>
        </main>
      </div>
    </div>
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

      {/* Dream World card */}
      <button
        type="button"
        onClick={() => {
          setActive('dream')
          setDreamPage('overview')
        }}
        className="group block w-full overflow-hidden rounded-sm border border-stone-300 bg-stone-900 px-5 py-5 text-left text-cream transition-colors hover:bg-stone-800"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-sand" />
          <span className="font-serif italic text-2xl leading-none">Dream World</span>
        </div>
        <p className="mt-2 text-xs leading-snug text-stone-300">
          Lifestyle design, moodboard, asset planning, habit tracker, and more!
        </p>
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
                  ready
                    ? 'text-stone-700 hover:bg-stone-100'
                    : 'cursor-not-allowed text-stone-300'
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

// ── Sidebar: Dream World focused mode ──────────────────────────────
function SidebarDream({ goToday, dreamPage, setDreamPage }) {
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
          <span className="font-serif italic text-2xl leading-none">Dream World</span>
        </div>
        <p className="mt-2 text-xs leading-snug text-stone-300">
          Lifestyle design, moodboard, asset planning, habit tracker, and more!
        </p>
      </div>

      <nav className="space-y-1">
        {DREAM_PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setDreamPage(p.id)}
            className={`block w-full px-3 py-2.5 text-left text-sm transition-colors ${
              dreamPage === p.id ? 'bg-stone-900 text-cream' : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
