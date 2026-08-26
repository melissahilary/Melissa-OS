import { useLocalStorage } from '../hooks/useLocalStorage'

// ── Life stages — the whole arc of a woman's body, not three checkboxes.
// One choice in Settings reshapes the planner: each stage declares what it
// turns on and what it lets rest. A woman can start here cycling and stay
// through trying, carrying, recovering, and beyond — nothing is ever lost
// when she moves; her history travels with her.

export const LIFE_STAGES = [
  {
    id: 'cycling',
    label: 'Cycling',
    blurb: 'Tracking a monthly cycle — phases, period days, cycle-aware planning.',
    on: [
      'Cycle calendar with all four phases',
      'Phase wash under every schedule',
      'Period forecasting from your anchor date',
      'Cycle reminders before your period',
    ],
    off: ['Fertile-window forecast', 'Pregnancy week counter', 'Symptom intensity journal'],
  },
  {
    id: 'ttc',
    label: 'Trying to conceive',
    blurb: 'Fertility first — your fertile window forecast, front and center.',
    on: [
      'Fertile window & ovulation forecast on My Body',
      'Cycle calendar with all four phases',
      'Phase wash under every schedule',
      'Basal-temp & fertility wearables in Connected',
    ],
    off: ['Pregnancy week counter', 'Symptom intensity journal'],
  },
  {
    id: 'pregnant',
    label: 'Expecting',
    blurb: 'Pregnancy first — weeks, trimester, and gentle planning.',
    on: [
      'Week & trimester counter from your due date',
      'Weekly notes for your provider',
      'Appointments woven through every pillar',
    ],
    off: ['Cycle calendar & phase wash', 'Fertile-window forecast', 'Period forecasting'],
  },
  {
    id: 'postpartum',
    label: 'Postpartum',
    blurb: 'The fourth trimester — recovery, rest, and how you are really doing.',
    on: [
      'Weeks-since-birth counter',
      'Recovery journal — bleeding, sleep, mood, feeding',
      'A fortnight strip of how loud the days have been',
    ],
    off: ['Cycle calendar & phase wash — until your cycle returns', 'Fertile-window forecast'],
  },
  {
    id: 'perimenopause',
    label: 'Perimenopause',
    blurb: 'The in-between — irregular cycles tracked gently, symptoms taken seriously.',
    on: [
      'Symptom journal & fortnight intensity strip',
      'Cycle calendar — irregular is welcome',
      'Protocols & HRT tracking under Hormones',
    ],
    off: ['Fertile-window forecast', 'Period forecasting — cycles too irregular to promise'],
  },
  {
    id: 'menopause',
    label: 'Beyond cycles',
    blurb: 'Peri/menopause behind you — symptoms, therapies, and steady rhythms.',
    on: [
      'Symptom journal & fortnight intensity strip',
      'Protocols & HRT tracking under Hormones',
      'Steady rhythms — no cycle math anywhere',
    ],
    off: ['Cycle calendar & phase wash', 'Fertile-window forecast', 'Period forecasting'],
  },
]

export const stageMeta = (id) => LIFE_STAGES.find((s) => s.id === id) || LIFE_STAGES[0]
export const normalizeStage = (raw) =>
  typeof raw === 'string' && LIFE_STAGES.some((s) => s.id === raw) ? raw : 'cycling'

// Behavior flags — what the rest of the planner checks before showing a feature.
export const stageFlags = (id) => ({
  phases: id === 'cycling' || id === 'ttc' || id === 'perimenopause', // phase wash + cycle calendar
  forecast: id === 'cycling' || id === 'ttc', // period forecasting is a promise; peri can't keep it
  fertile: id === 'ttc',
  pregnancy: id === 'pregnant',
  symptoms: id === 'postpartum' || id === 'perimenopause' || id === 'menopause',
})

// The journey — every stage change is remembered, so the planner that met her
// cycling still knows it when she is beyond cycles.
export function useLifeStage() {
  const [raw, setRaw] = useLocalStorage('mos:settings:lifeStage', 'cycling')
  const [journeyRaw, setJourney] = useLocalStorage('mos:settings:lifeStageJourney', [])
  const stage = normalizeStage(raw)
  const journey = Array.isArray(journeyRaw) ? journeyRaw : []
  const setStage = (next) => {
    if (next === stage) return
    setRaw(next)
    const today = new Date().toISOString().slice(0, 10)
    setJourney((prev) => {
      const arr = Array.isArray(prev) ? prev : []
      const base = arr.length === 0 ? [{ stage, date: today }] : arr
      return [...base, { stage: next, date: today }]
    })
  }
  return { stage, setStage, journey, flags: stageFlags(stage), meta: stageMeta(stage) }
}
