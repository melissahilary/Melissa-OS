// ── The joining layer.
//
// Every silo holds numbers that cannot meet: a PDF from the lab, a number in a
// cycle app, a reading typed into a notes app. They cannot meet because nothing
// agrees on what a marker *is*. "Vit D", "Vitamin D", "25-OH vitamin D" and
// "25(OH)D" are one substance and four strings, measured in two units that
// differ by 2.5×, against a range that the printing lab chose.
//
// So this file is the vocabulary everything else joins on: one canonical id per
// marker, the units it legitimately arrives in and the arithmetic between them,
// and — the part no general health app gets right — reference ranges that know
// a woman's body is not the same on day 3 as on day 21.
//
// A word on the numbers below. They are typical adult-female reference
// intervals for common serum assays. Real ranges vary by laboratory, by assay,
// and by age, which is why every reading can carry the range its own lab
// printed, and that range always wins over these. These are the fallback for a
// number that arrived without one — a sense of where you sit, not a diagnosis.

// ── Panels ──────────────────────────────────────────────────────────
export const PANELS = [
  { id: 'hormones', label: 'Sex hormones', blurb: 'Only legible against the day of your cycle they were drawn on.' },
  { id: 'thyroid', label: 'Thyroid', blurb: 'The metabolism dial — and the most commonly missed cause of exhaustion in women.' },
  { id: 'iron', label: 'Iron & blood', blurb: 'What monthly bleeding quietly costs.' },
  { id: 'metabolic', label: 'Metabolic', blurb: 'How your body is handling fuel.' },
  { id: 'lipids', label: 'Lipids', blurb: 'Cardiovascular risk — which rises sharply after menopause.' },
  { id: 'inflammation', label: 'Inflammation', blurb: 'The background hum.' },
  { id: 'vitamins', label: 'Vitamins & minerals', blurb: 'The inputs everything else depends on.' },
]

// Range shorthand: [low, high], where null is open-ended.
const under = (n) => [null, n]
const over = (n) => [n, null]

// ── The catalogue ───────────────────────────────────────────────────
// `units` maps a foreign unit to the factor that converts it to the canonical
// one. `ranges.byPhase` is the reproductive-cycle case; `ranges.byStage` covers
// the life stages where the whole picture changes.
export const BIOMARKERS = [
  // ── Sex hormones ──────────────────────────────────────────────────
  {
    id: 'estradiol',
    label: 'Estradiol',
    short: 'E2',
    panel: 'hormones',
    unit: 'pg/mL',
    units: { 'pmol/L': 1 / 3.671, 'ng/L': 1 },
    aliases: ['e2', 'oestradiol', 'estradiol serum', '17 beta estradiol', 'estradiol e2'],
    phaseAware: true,
    ranges: {
      byPhase: { menstrual: [20, 80], follicular: [27, 123], ovulation: [100, 400], luteal: [50, 250] },
      byStage: { menopause: under(30), perimenopause: [15, 350] },
    },
    note: 'Swings roughly fivefold across a cycle. A result without its cycle day cannot be read.',
    pregnancyShifts: true,
  },
  {
    id: 'progesterone',
    label: 'Progesterone',
    short: 'P4',
    panel: 'hormones',
    unit: 'ng/mL',
    units: { 'nmol/L': 1 / 3.18 },
    aliases: ['p4', 'progesterone serum'],
    phaseAware: true,
    ranges: {
      byPhase: { menstrual: under(1), follicular: under(1), ovulation: [0.5, 3], luteal: [5, 20] },
      byStage: { menopause: under(0.5) },
    },
    note: 'Drawn seven days after ovulation — roughly day 21 of a 28-day cycle. Above 3 ng/mL says you ovulated; the rest of the luteal band says how strongly.',
    pregnancyShifts: true,
  },
  {
    id: 'lh',
    label: 'Luteinising hormone',
    short: 'LH',
    panel: 'hormones',
    unit: 'mIU/mL',
    units: { 'IU/L': 1 },
    aliases: ['lh', 'luteinizing hormone', 'luteinising hormone'],
    phaseAware: true,
    ranges: {
      byPhase: { menstrual: [2, 12], follicular: [2, 12], ovulation: [20, 100], luteal: [1, 12] },
      byStage: { menopause: [15, 60] },
    },
  },
  {
    id: 'fsh',
    label: 'Follicle-stimulating hormone',
    short: 'FSH',
    panel: 'hormones',
    unit: 'mIU/mL',
    units: { 'IU/L': 1 },
    aliases: ['fsh', 'follicle stimulating hormone'],
    phaseAware: true,
    ranges: {
      byPhase: { menstrual: [3, 10], follicular: [3, 10], ovulation: [4, 25], luteal: [1.5, 7] },
      byStage: { menopause: over(25), perimenopause: [3, 25] },
    },
    note: 'Drawn on day 3. Persistently above ~10–12 is the first quiet signal of falling ovarian reserve; above 25 with a year of no periods is the menopausal picture.',
  },
  {
    id: 'amh',
    label: 'Anti-Müllerian hormone',
    short: 'AMH',
    panel: 'hormones',
    unit: 'ng/mL',
    units: { 'pmol/L': 1 / 7.14 },
    aliases: ['amh', 'anti mullerian hormone', 'anti-mullerian hormone'],
    ranges: { default: [1.0, 4.0] },
    note: 'Ovarian reserve, and steady across the cycle — the one hormone here you can draw on any day. Falls with age, so read it against your age, not the band alone.',
  },
  {
    id: 'testosterone_total',
    label: 'Testosterone, total',
    panel: 'hormones',
    unit: 'ng/dL',
    units: { 'nmol/L': 28.84, 'ng/mL': 100 },
    aliases: ['testosterone', 'total testosterone', 'testosterone total'],
    ranges: { default: [15, 70] },
  },
  {
    id: 'testosterone_free',
    label: 'Testosterone, free',
    panel: 'hormones',
    unit: 'pg/mL',
    units: { 'pmol/L': 1 / 3.47 },
    aliases: ['free testosterone', 'testosterone free'],
    ranges: { default: [0.3, 1.9] },
  },
  {
    id: 'shbg',
    label: 'Sex hormone binding globulin',
    short: 'SHBG',
    panel: 'hormones',
    unit: 'nmol/L',
    units: {},
    aliases: ['shbg', 'sex hormone binding globulin'],
    ranges: { default: [20, 130] },
    note: 'Decides how much of your testosterone and estrogen is actually free to act. The pill raises it substantially.',
  },
  {
    id: 'dheas',
    label: 'DHEA-S',
    panel: 'hormones',
    unit: 'µg/dL',
    units: { 'µmol/L': 36.85, 'umol/L': 36.85 },
    aliases: ['dhea s', 'dhea sulfate', 'dheas', 'dhea-sulfate'],
    ranges: { default: [35, 430] },
    note: 'Falls steadily with age; read against your decade.',
  },
  {
    id: 'prolactin',
    label: 'Prolactin',
    panel: 'hormones',
    unit: 'ng/mL',
    units: { 'µg/L': 1, 'mIU/L': 1 / 21.2 },
    aliases: ['prolactin', 'prl'],
    ranges: { default: [4, 23] },
    note: 'Raised prolactin suppresses ovulation, and stress or a recent breast exam can lift it on the day.',
    pregnancyShifts: true,
  },
  {
    id: 'cortisol_am',
    label: 'Cortisol (morning)',
    panel: 'hormones',
    unit: 'µg/dL',
    units: { 'nmol/L': 1 / 27.59 },
    aliases: ['cortisol', 'cortisol am', 'cortisol morning', 'serum cortisol'],
    ranges: { default: [6, 18] },
    note: 'Only meaningful drawn between 7 and 9am, when it should be at its peak.',
  },

  // ── Thyroid ───────────────────────────────────────────────────────
  {
    id: 'tsh',
    label: 'TSH',
    panel: 'thyroid',
    unit: 'mIU/L',
    units: { 'µIU/mL': 1, 'uIU/mL': 1, 'mU/L': 1 },
    aliases: ['tsh', 'thyroid stimulating hormone', 'thyrotropin'],
    ranges: {
      default: [0.4, 4.0],
      optimal: [0.5, 2.5],
      pregnancy: { 1: [0.1, 2.5], 2: [0.2, 3.0], 3: [0.3, 3.0] },
    },
    note: 'The lab band is wide. Symptoms often sit in its upper third, which is why many clinicians work to a tighter target.',
  },
  {
    id: 'free_t4',
    label: 'Free T4',
    panel: 'thyroid',
    unit: 'ng/dL',
    units: { 'pmol/L': 1 / 12.87 },
    aliases: ['free t4', 'ft4', 't4 free', 'free thyroxine'],
    ranges: { default: [0.8, 1.8] },
  },
  {
    id: 'free_t3',
    label: 'Free T3',
    panel: 'thyroid',
    unit: 'pg/mL',
    units: { 'pmol/L': 1 / 1.536 },
    aliases: ['free t3', 'ft3', 't3 free', 'free triiodothyronine'],
    ranges: { default: [2.3, 4.2] },
    note: 'The active hormone. TSH alone can look ordinary while this sits low.',
  },
  {
    id: 'tpo_ab',
    label: 'TPO antibodies',
    panel: 'thyroid',
    unit: 'IU/mL',
    units: {},
    aliases: ['tpo', 'tpo ab', 'thyroid peroxidase antibodies', 'anti tpo'],
    ranges: { default: under(35) },
    note: 'Raised antibodies are the autoimmune picture — worth knowing years before the numbers move.',
  },

  // ── Iron & blood ──────────────────────────────────────────────────
  {
    id: 'ferritin',
    label: 'Ferritin',
    panel: 'iron',
    unit: 'ng/mL',
    units: { 'µg/L': 1, 'ug/L': 1 },
    aliases: ['ferritin', 'serum ferritin'],
    ranges: { default: [15, 150], optimal: [50, 100] },
    note: 'Iron stores. The lab floor of 15 is a threshold for anaemia, not for feeling well — exhaustion, hair shedding and breathlessness are common below 30 with a perfectly normal blood count. Monthly bleeding is the reason this is the most frequently low marker in women.',
    pregnancyShifts: true,
  },
  {
    id: 'hemoglobin',
    label: 'Haemoglobin',
    panel: 'iron',
    unit: 'g/dL',
    units: { 'g/L': 0.1 },
    aliases: ['hemoglobin', 'haemoglobin', 'hgb', 'hb'],
    ranges: {
      default: [12.0, 15.5],
      pregnancy: { 1: over(11), 2: over(10.5), 3: over(11) },
    },
  },
  {
    id: 'hematocrit',
    label: 'Haematocrit',
    panel: 'iron',
    unit: '%',
    units: {},
    aliases: ['hematocrit', 'haematocrit', 'hct'],
    ranges: { default: [36, 46] },
  },
  {
    id: 'iron_serum',
    label: 'Iron, serum',
    panel: 'iron',
    unit: 'µg/dL',
    units: { 'µmol/L': 5.587, 'umol/L': 5.587 },
    aliases: ['iron', 'serum iron'],
    ranges: { default: [50, 170] },
  },
  {
    id: 'transferrin_sat',
    label: 'Transferrin saturation',
    panel: 'iron',
    unit: '%',
    units: {},
    aliases: ['transferrin saturation', 'tsat', 'iron saturation', 'sat'],
    ranges: { default: [20, 50] },
  },

  // ── Metabolic ─────────────────────────────────────────────────────
  {
    id: 'glucose_fasting',
    label: 'Fasting glucose',
    panel: 'metabolic',
    unit: 'mg/dL',
    units: { 'mmol/L': 18.016 },
    aliases: ['glucose', 'fasting glucose', 'glucose fasting', 'blood glucose'],
    ranges: { default: [70, 99], optimal: [70, 85] },
  },
  {
    id: 'hba1c',
    label: 'HbA1c',
    panel: 'metabolic',
    unit: '%',
    units: { 'mmol/mol': 0 }, // handled by formula below
    convert: { 'mmol/mol': (v) => v / 10.929 + 2.15 },
    aliases: ['hba1c', 'a1c', 'hemoglobin a1c', 'glycated hemoglobin'],
    ranges: { default: under(5.7), optimal: under(5.3) },
    note: 'Roughly three months of average blood sugar — the one number here that cannot be gamed by fasting the day before.',
  },
  {
    id: 'insulin_fasting',
    label: 'Fasting insulin',
    panel: 'metabolic',
    unit: 'µIU/mL',
    units: { 'pmol/L': 1 / 6.945 },
    aliases: ['insulin', 'fasting insulin', 'insulin fasting'],
    ranges: { default: [2, 19], optimal: under(7) },
    note: 'Rises years before glucose does, which makes it the earliest warning in the panel — and one of the most commonly raised markers in PCOS.',
  },

  // ── Lipids ────────────────────────────────────────────────────────
  {
    id: 'apob',
    label: 'ApoB',
    panel: 'lipids',
    unit: 'mg/dL',
    units: { 'g/L': 100 },
    aliases: ['apob', 'apo b', 'apolipoprotein b'],
    ranges: { default: under(90), optimal: under(80) },
    note: 'Counts the particles that actually carry risk. A better predictor than LDL, and rarely ordered unless you ask.',
  },
  {
    id: 'ldl',
    label: 'LDL cholesterol',
    panel: 'lipids',
    unit: 'mg/dL',
    units: { 'mmol/L': 38.67 },
    aliases: ['ldl', 'ldl cholesterol', 'ldl c', 'ldl-c'],
    ranges: { default: under(100) },
  },
  {
    id: 'hdl',
    label: 'HDL cholesterol',
    panel: 'lipids',
    unit: 'mg/dL',
    units: { 'mmol/L': 38.67 },
    aliases: ['hdl', 'hdl cholesterol', 'hdl c', 'hdl-c'],
    ranges: { default: over(50) },
  },
  {
    id: 'triglycerides',
    label: 'Triglycerides',
    panel: 'lipids',
    unit: 'mg/dL',
    units: { 'mmol/L': 88.57 },
    aliases: ['triglycerides', 'trigs', 'tg'],
    ranges: { default: under(150), optimal: under(100) },
  },
  {
    id: 'cholesterol_total',
    label: 'Total cholesterol',
    panel: 'lipids',
    unit: 'mg/dL',
    units: { 'mmol/L': 38.67 },
    aliases: ['cholesterol', 'total cholesterol', 'cholesterol total'],
    ranges: { default: under(200) },
  },
  {
    id: 'lpa',
    label: 'Lp(a)',
    panel: 'lipids',
    unit: 'nmol/L',
    units: {},
    aliases: ['lp a', 'lpa', 'lipoprotein a'],
    ranges: { default: under(75) },
    note: 'Genetic, and essentially fixed for life — so it is worth measuring exactly once.',
  },

  // ── Inflammation ──────────────────────────────────────────────────
  {
    id: 'hscrp',
    label: 'hs-CRP',
    panel: 'inflammation',
    unit: 'mg/L',
    units: { 'mg/dL': 10 },
    aliases: ['crp', 'hs crp', 'hscrp', 'c reactive protein', 'high sensitivity crp'],
    ranges: { default: under(3), optimal: under(1) },
    note: 'A recent cold or a hard training week will lift this. One high reading is weather; a run of them is climate.',
  },
  {
    id: 'homocysteine',
    label: 'Homocysteine',
    panel: 'inflammation',
    unit: 'µmol/L',
    units: {},
    aliases: ['homocysteine'],
    ranges: { default: [5, 15], optimal: under(9) },
  },

  // ── Vitamins & minerals ───────────────────────────────────────────
  {
    id: 'vitamin_d',
    label: 'Vitamin D (25-OH)',
    panel: 'vitamins',
    unit: 'ng/mL',
    units: { 'nmol/L': 1 / 2.496 },
    aliases: ['vitamin d', 'vit d', '25 oh vitamin d', '25 hydroxyvitamin d', '25 oh d', 'vitamin d 25 hydroxy', 'vitamin d3'],
    ranges: { default: [30, 100], optimal: [40, 60] },
    note: 'Reported in two units that differ by two and a half times — the single most common place a good number is read as a frightening one.',
  },
  {
    id: 'b12',
    label: 'Vitamin B12',
    panel: 'vitamins',
    unit: 'pg/mL',
    units: { 'pmol/L': 1 / 0.7378, 'ng/L': 1 },
    aliases: ['b12', 'vitamin b12', 'cobalamin'],
    ranges: { default: [200, 900], optimal: over(500) },
    note: 'The lab floor is low enough that neurological symptoms appear well inside the "normal" band.',
  },
  {
    id: 'folate',
    label: 'Folate',
    panel: 'vitamins',
    unit: 'ng/mL',
    units: { 'nmol/L': 1 / 2.266 },
    aliases: ['folate', 'folic acid', 'serum folate'],
    ranges: { default: over(4) },
  },
  {
    id: 'magnesium_rbc',
    label: 'Magnesium (RBC)',
    panel: 'vitamins',
    unit: 'mg/dL',
    units: { 'mmol/L': 2.43 },
    aliases: ['magnesium', 'rbc magnesium', 'magnesium rbc', 'red blood cell magnesium'],
    ranges: { default: [4.2, 6.8] },
    note: 'Serum magnesium is held steady at the expense of the tissues, so it looks normal almost always. The red-cell measure is the one that tells you anything.',
  },
  {
    id: 'zinc',
    label: 'Zinc',
    panel: 'vitamins',
    unit: 'µg/dL',
    units: { 'µmol/L': 6.538, 'umol/L': 6.538 },
    aliases: ['zinc'],
    ranges: { default: [60, 120] },
  },
]

export const BY_ID = BIOMARKERS.reduce((m, b) => { m[b.id] = b; return m }, {})
export const byPanel = (panelId) => BIOMARKERS.filter((b) => b.panel === panelId)

// ── Matching a name from anywhere to a marker here ───────────────────
const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/\(.*?\)/g, ' ')      // "vitamin d (25-oh)" → "vitamin d"
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(serum|plasma|blood|level|levels|test|total)\b/g, ' ')
  .trim()
  .replace(/\s+/g, ' ')

const LOOKUP = (() => {
  const m = new Map()
  BIOMARKERS.forEach((b) => {
    const keys = [b.label, b.short, ...(b.aliases || [])].filter(Boolean)
    keys.forEach((k) => { const n = norm(k); if (n && !m.has(n)) m.set(n, b.id) })
  })
  return m
})()

// A lab report says "Vitamin D, 25-Hydroxy". This is what makes that the same
// thing as the number already in the record.
export function resolveMarker(name) {
  const n = norm(name)
  if (!n) return null
  if (LOOKUP.has(n)) return BY_ID[LOOKUP.get(n)]
  // Longest alias contained in the reported name — "estradiol e2 serum" finds
  // estradiol, and the longest match wins so "free t4" beats "t4".
  let best = null
  let bestLen = 0
  LOOKUP.forEach((id, key) => {
    if (key.length > bestLen && key.length >= 3 && (n === key || n.includes(` ${key} `) || n.startsWith(`${key} `) || n.endsWith(` ${key}`))) {
      best = id
      bestLen = key.length
    }
  })
  return best ? BY_ID[best] : null
}

// ── Units ───────────────────────────────────────────────────────────
export const unitsFor = (marker) => (marker ? [marker.unit, ...Object.keys(marker.units || {})] : [])

const unitNorm = (u) => String(u || '').toLowerCase().replace(/μ/g, 'µ').replace(/\s+/g, '')

// A value as it was reported, in whatever unit, expressed in the marker's own.
export function toCanonical(marker, value, unit) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n)) return null
  if (!marker || !unit) return n
  const u = unitNorm(unit)
  if (u === unitNorm(marker.unit)) return n
  if (marker.convert) {
    const key = Object.keys(marker.convert).find((k) => unitNorm(k) === u)
    if (key) return marker.convert[key](n)
  }
  const key = Object.keys(marker.units || {}).find((k) => unitNorm(k) === u)
  if (key) return n * marker.units[key]
  return n // an unrecognised unit is taken at face value rather than mangled
}

// ── The range that actually applies to her, today ───────────────────
// This is the whole point of the file. A static band is wrong for half the
// markers a woman measures, and wrong in the direction that causes alarm.
export function rangeFor(marker, { stage = 'cycling', phase = null, trimester = null } = {}) {
  if (!marker || !marker.ranges) return null
  const R = marker.ranges

  if (stage === 'pregnant') {
    if (R.pregnancy && trimester && R.pregnancy[trimester]) {
      return { band: R.pregnancy[trimester], basis: `Pregnancy · trimester ${trimester}` }
    }
    if (marker.pregnancyShifts || R.pregnancy) {
      return { band: null, basis: 'Shifts in pregnancy — your clinic’s range governs' }
    }
  }

  if (R.byStage && R.byStage[stage]) {
    const label = stage === 'menopause' ? 'Postmenopausal' : 'Perimenopausal'
    return { band: R.byStage[stage], basis: label }
  }

  if (R.byPhase) {
    if (!phase) return { band: null, basis: 'Needs the cycle day it was drawn on' }
    if (R.byPhase[phase]) {
      const name = phase.charAt(0).toUpperCase() + phase.slice(1)
      return { band: R.byPhase[phase], basis: `${name} phase` }
    }
  }

  if (R.default) return { band: R.default, basis: 'Adult female' }
  return null
}

export const optimalFor = (marker) => (marker && marker.ranges && marker.ranges.optimal) || null

// ── Where a value sits ──────────────────────────────────────────────
// Four states, not two. "In range" and "where you'd want to be" are different
// questions, and collapsing them into one green dot is what makes a lab result
// feel either falsely reassuring or needlessly frightening.
export function placeValue(marker, canonicalValue, ctx = {}) {
  const n = typeof canonicalValue === 'number' ? canonicalValue : parseFloat(canonicalValue)
  if (!Number.isFinite(n) || !marker) return null
  const r = rangeFor(marker, ctx)
  if (!r || !r.band) return { state: 'unknown', basis: r ? r.basis : null }
  const [lo, hi] = r.band
  if (lo != null && n < lo) return { state: 'low', basis: r.basis, band: r.band }
  if (hi != null && n > hi) return { state: 'high', basis: r.basis, band: r.band }
  const opt = optimalFor(marker)
  if (opt) {
    const [ol, oh] = opt
    const inOptimal = (ol == null || n >= ol) && (oh == null || n <= oh)
    if (inOptimal) return { state: 'optimal', basis: r.basis, band: r.band, optimal: opt }
    return { state: 'in', basis: r.basis, band: r.band, optimal: opt }
  }
  return { state: 'in', basis: r.basis, band: r.band }
}

export const STATE_COLOR = {
  optimal: '#7C8B6B',
  in: '#A3A093',
  low: '#A0654C',
  high: '#A0654C',
  unknown: '#C4BFB6',
}
export const STATE_LABEL = {
  optimal: 'Where you’d want it',
  in: 'In range',
  low: 'Below range',
  high: 'Above range',
  unknown: 'No range to read it against',
}

// Where a value falls inside its band, 0–1, for drawing it on a line.
export function positionIn(band, n) {
  if (!band) return null
  let [lo, hi] = band
  if (lo == null) lo = Math.min(0, n)
  if (hi == null) hi = Math.max(n * 1.4, lo + Math.abs(lo || 1))
  const span = hi - lo
  if (!span) return 0.5
  return Math.max(0, Math.min(1, (n - lo) / span))
}
