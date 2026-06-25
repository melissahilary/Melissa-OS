// Cycle phase logic + the locked nutrition data.

export const PHASES = {
  menstrual: { id: 'menstrual', name: 'Menstrual', abbr: 'MEN', color: '#8B3A3A', ink: '#FAFAF7', range: 'Days 1–5' },
  follicular: { id: 'follicular', name: 'Follicular', abbr: 'FOL', color: '#7B8B5F', ink: '#FAFAF7', range: 'Days 6–13' },
  ovulation: { id: 'ovulation', name: 'Ovulation', abbr: 'OVU', color: '#C9A961', ink: '#1C1C1A', range: 'Days 14–16' },
  luteal: { id: 'luteal', name: 'Luteal', abbr: 'LUT', color: '#5A6B7B', ink: '#FAFAF7', range: 'Days 17–28' },
}

// Locked phase nutrition lists — do not change.
export const PHASE_FOODS = {
  menstrual: [
    'Grass-fed beef', 'lamb', 'bison', 'beef liver', 'chicken liver', 'bone broth', 'oysters', 'mussels',
    'sardines', 'anchovies', 'spinach', 'swiss chard', 'kale', 'collards', 'beets', 'pomegranate',
    'dark cherries', 'blackberries', 'dark chocolate', 'cacao', 'ginger', 'cinnamon', 'turmeric',
    'black pepper', 'sea salt', 'butter', 'ghee', 'olive oil', 'miso', 'bone marrow',
  ],
  follicular: [
    'Kimchi', 'sauerkraut', 'kefir', 'miso', 'yogurt', 'sprouted flax', 'sprouted pumpkin seeds',
    'wild salmon', 'trout', 'eggs', 'avocado', 'broccoli', 'zucchini', 'asparagus', 'artichoke',
    'snap peas', 'fennel', 'cucumber', 'lemon', 'lime', 'grapefruit', 'orange', 'strawberries',
    'blueberries', 'raspberries', 'parsley', 'dill', 'basil', 'mint', 'cilantro', 'sourdough', 'oats',
    'quinoa', 'lentils', 'chickpeas', 'sweet potato', 'sheep feta', 'goat cheese',
  ],
  ovulation: [
    'Broccoli sprouts', 'broccoli', 'cauliflower', 'brussels sprouts', 'kale', 'arugula', 'watercress',
    'raw carrots', 'beets', 'radishes', 'blueberries', 'raspberries', 'blackberries', 'strawberries',
    'pomegranate', 'wild salmon', 'sardines', 'halibut', 'cod', 'eggs', 'extra virgin olive oil',
    'spinach', 'romaine', 'asparagus', 'artichoke', 'fennel', 'lemon', 'parsley', 'cilantro', 'basil',
    'almonds', 'brazil nuts',
  ],
  luteal: [
    'Sweet potato', 'butternut squash', 'kabocha squash', 'carrots', 'parsnips', 'beets', 'turnips',
    'pasture-raised chicken', 'turkey', 'grass-fed beef', 'lamb', 'wild salmon', 'cod', 'halibut',
    'eggs', 'sesame seeds', 'sunflower seeds', 'pumpkin seeds', 'pistachios', 'walnuts', 'almonds',
    'dark chocolate', 'cacao', 'spinach', 'swiss chard', 'brown rice', 'wild rice', 'oats', 'quinoa',
    'lentils', 'chickpeas', 'black beans', 'avocado', 'olive oil', 'butter', 'ghee', 'bananas', 'dates',
    'figs', 'salmon roe', 'cinnamon', 'cardamom', 'ginger', 'sea salt',
  ],
}

const MS_DAY = 86400000

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Days since last period start (1-indexed cycle day) for a given date.
export function cycleDayFor(date, lastPeriodStart, cycleLength = 28) {
  if (!lastPeriodStart) return null
  const len = Number(cycleLength) > 0 ? Number(cycleLength) : 28
  const start = startOfDay(lastPeriodStart)
  const target = startOfDay(date)
  const diff = Math.floor((target - start) / MS_DAY)
  // Modulo into the cycle window, 1-indexed.
  const day = ((diff % len) + len) % len
  return day + 1
}

export function phaseForDay(cycleDay) {
  if (cycleDay == null) return null
  if (cycleDay <= 5) return PHASES.menstrual
  if (cycleDay <= 13) return PHASES.follicular
  if (cycleDay <= 16) return PHASES.ovulation
  return PHASES.luteal
}

export function phaseFor(date, lastPeriodStart, cycleLength = 28) {
  const day = cycleDayFor(date, lastPeriodStart, cycleLength)
  const phase = phaseForDay(day)
  if (!phase) return null
  return { ...phase, cycleDay: day }
}

// Average gap (in days) across a list of period-start dates.
export function averageCycleLength(dates) {
  const ds = (dates || []).filter(Boolean).map((d) => startOfDay(d).getTime()).sort((a, b) => a - b)
  if (ds.length < 2) return null
  let total = 0
  for (let i = 1; i < ds.length; i++) total += Math.round((ds[i] - ds[i - 1]) / MS_DAY)
  return Math.round(total / (ds.length - 1))
}

// Current phase honouring a manual override on the cycle config.
export function phaseForConfig(cfg, date) {
  if (cfg && cfg.manualPhase && PHASES[cfg.manualPhase]) {
    return { ...PHASES[cfg.manualPhase], cycleDay: cycleDayFor(date, cfg.lastPeriodStart, cfg.cycleLength), manual: true }
  }
  return phaseFor(date, cfg && cfg.lastPeriodStart, cfg && cfg.cycleLength)
}

// ── Frequency codes ──────────────────────────────────────────────
export const FREQ_OPTIONS = [
  { value: 'once', label: 'Once', code: '1x' },
  { value: 'daily', label: 'Daily', code: '∞' },
  { value: '2week', label: '2x / week', code: '2x' },
  { value: '3week', label: '3x / week', code: '3x' },
  { value: '4week', label: '4x / week', code: '4x' },
  { value: '5week', label: '5x / week', code: '5x' },
  { value: 'weekdays', label: 'Weekdays', code: 'M–F' },
  { value: 'weekends', label: 'Weekends', code: 'S/S' },
]

export function freqCode(freq) {
  const f = FREQ_OPTIONS.find((o) => o.value === freq)
  return f ? f.code : '∞'
}

// Intentions frequency options (Section A)
export const INTENTION_FREQ = [
  'daily', '6x', '5x', '4x', '3x', '2x a week', 'weekdays', 'weekends', 'as needed',
]

// ── Hydration unit conversion ────────────────────────────────────
export const UNIT_TO_L = { oz: 0.0295735, L: 1, ml: 0.001 }

export function toLiters(amount, unit) {
  const n = Number(amount)
  if (!n || Number.isNaN(n)) return 0
  return n * (UNIT_TO_L[unit] ?? 0)
}
