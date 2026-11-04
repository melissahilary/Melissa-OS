// ── Markers, and what the numbers mean.
//
// Two ranges to every line. The lab range is what the printout calls normal,
// and most of them were drawn from populations that were not women. The
// second is the range commonly cited as optimal in functional and women's
// health practice.
//
// This is reference, not diagnosis. The page says so, every time it shows a
// range. It exists so she walks into an appointment with a specific question
// instead of a vague complaint — nothing here replaces the person reading it
// with her.
//
// Units are US conventional.

export const MARKERS = [
  // Iron and blood
  { id: 'ferritin', name: 'Ferritin', unit: 'ng/mL', lab: [15, 200], best: [50, 100], group: 'Iron' },
  { id: 'iron_sat', name: 'Iron saturation', unit: '%', lab: [15, 50], best: [25, 40], group: 'Iron' },
  { id: 'hgb', name: 'Haemoglobin', unit: 'g/dL', lab: [12, 15.5], best: [13, 14.5], group: 'Iron' },
  // Thyroid
  { id: 'tsh', name: 'TSH', unit: 'mIU/L', lab: [0.4, 4.5], best: [0.5, 2.0], group: 'Thyroid' },
  { id: 'ft3', name: 'Free T3', unit: 'pg/mL', lab: [2.3, 4.2], best: [3.2, 4.2], group: 'Thyroid' },
  { id: 'ft4', name: 'Free T4', unit: 'ng/dL', lab: [0.8, 1.8], best: [1.1, 1.6], group: 'Thyroid' },
  { id: 'tpo', name: 'TPO antibodies', unit: 'IU/mL', lab: [0, 34], best: [0, 9], group: 'Thyroid' },
  // Vitamins and minerals
  { id: 'vitd', name: 'Vitamin D (25-OH)', unit: 'ng/mL', lab: [30, 100], best: [50, 80], group: 'Vitamins' },
  { id: 'b12', name: 'Vitamin B12', unit: 'pg/mL', lab: [200, 900], best: [600, 900], group: 'Vitamins' },
  { id: 'folate', name: 'Folate', unit: 'ng/mL', lab: [3, 20], best: [10, 20], group: 'Vitamins' },
  { id: 'mag', name: 'Magnesium (RBC)', unit: 'mg/dL', lab: [4.2, 6.8], best: [5.6, 6.8], group: 'Vitamins' },
  { id: 'zinc', name: 'Zinc', unit: 'mcg/dL', lab: [60, 130], best: [90, 120], group: 'Vitamins' },
  // Metabolic
  { id: 'hba1c', name: 'HbA1c', unit: '%', lab: [4, 5.7], best: [4.6, 5.3], group: 'Metabolic' },
  { id: 'glucose', name: 'Fasting glucose', unit: 'mg/dL', lab: [70, 99], best: [75, 86], group: 'Metabolic' },
  { id: 'insulin', name: 'Fasting insulin', unit: 'uIU/mL', lab: [2, 20], best: [2, 5], group: 'Metabolic' },
  { id: 'crp', name: 'hs-CRP', unit: 'mg/L', lab: [0, 3], best: [0, 1], group: 'Metabolic' },
  // Lipids
  { id: 'hdl', name: 'HDL', unit: 'mg/dL', lab: [50, 100], best: [60, 90], group: 'Lipids' },
  { id: 'ldl', name: 'LDL', unit: 'mg/dL', lab: [0, 130], best: [0, 100], group: 'Lipids' },
  { id: 'trig', name: 'Triglycerides', unit: 'mg/dL', lab: [0, 150], best: [0, 80], group: 'Lipids' },
  { id: 'apob', name: 'ApoB', unit: 'mg/dL', lab: [0, 100], best: [0, 80], group: 'Lipids' },
  // Hormones
  { id: 'e2', name: 'Estradiol (follicular)', unit: 'pg/mL', lab: [20, 150], best: [50, 120], group: 'Hormones' },
  { id: 'prog', name: 'Progesterone (day 21)', unit: 'ng/mL', lab: [1.8, 24], best: [10, 20], group: 'Hormones' },
  { id: 'testo', name: 'Testosterone, total', unit: 'ng/dL', lab: [8, 60], best: [30, 50], group: 'Hormones' },
  { id: 'dheas', name: 'DHEA-S', unit: 'mcg/dL', lab: [35, 430], best: [150, 300], group: 'Hormones' },
  { id: 'shbg', name: 'SHBG', unit: 'nmol/L', lab: [18, 144], best: [40, 80], group: 'Hormones' },
  { id: 'lh', name: 'LH', unit: 'mIU/mL', lab: [1, 12], best: [3, 9], group: 'Hormones' },
  { id: 'fsh', name: 'FSH', unit: 'mIU/mL', lab: [1, 12], best: [3, 8], group: 'Hormones' },
  { id: 'amh', name: 'AMH', unit: 'ng/mL', lab: [0.5, 4], best: [1.5, 4], group: 'Hormones' },
  { id: 'prl', name: 'Prolactin', unit: 'ng/mL', lab: [4, 23], best: [4, 15], group: 'Hormones' },
  { id: 'cortisol', name: 'Cortisol (morning)', unit: 'mcg/dL', lab: [6, 23], best: [10, 15], group: 'Hormones' },
]

export const markerById = (id) => MARKERS.find((m) => m.id === id) || null
export const MARKER_GROUPS = [...new Set(MARKERS.map((m) => m.group))]

// Where a number falls. Three answers only: in the optimal band, inside the
// lab range but outside optimal, or outside the lab range altogether.
export const readingState = (marker, value) => {
  const v = Number(value)
  if (!marker || !Number.isFinite(v)) return null
  const [bl, bh] = marker.best
  const [ll, lh] = marker.lab
  if (v >= bl && v <= bh) return 'optimal'
  if (v >= ll && v <= lh) return 'normal'
  return 'out'
}

// ── What she might ask for.
//
// A woman describes a symptom and is told it is stress. These are the tests
// commonly discussed for each, so the conversation starts from something
// specific. It is a list of questions, not an answer.
export const SYMPTOMS = [
  { id: 'tired', name: 'Tired all the time', tests: ['ferritin', 'iron_sat', 'tsh', 'ft3', 'ft4', 'vitd', 'b12', 'crp'] },
  { id: 'hair', name: 'Hair shedding', tests: ['ferritin', 'tsh', 'ft3', 'vitd', 'zinc', 'testo', 'dheas'] },
  { id: 'cold', name: 'Always cold', tests: ['tsh', 'ft3', 'ft4', 'ferritin'] },
  { id: 'periods', name: 'Periods all over the place', tests: ['lh', 'fsh', 'e2', 'prog', 'prl', 'tsh', 'testo', 'shbg', 'amh'] },
  { id: 'acne', name: 'Acne along the jaw', tests: ['testo', 'dheas', 'shbg', 'insulin'] },
  { id: 'weight', name: 'Weight that will not move', tests: ['insulin', 'hba1c', 'tsh', 'ft3', 'cortisol'] },
  { id: 'fog', name: 'Brain fog', tests: ['b12', 'folate', 'tsh', 'ft3', 'ferritin', 'vitd', 'crp'] },
  { id: 'sleep', name: 'Anxious, sleeping badly', tests: ['cortisol', 'mag', 'tsh', 'prog', 'ferritin'] },
  { id: 'libido', name: 'No libido', tests: ['testo', 'dheas', 'e2', 'prl', 'tsh'] },
  { id: 'pms', name: 'PMS getting worse', tests: ['prog', 'e2', 'shbg', 'vitd', 'mag'] },
  { id: 'bruise', name: 'Bruising easily', tests: ['ferritin', 'hgb', 'vitd'] },
  { id: 'ttc', name: 'Trying to conceive', tests: ['amh', 'fsh', 'lh', 'prog', 'tsh', 'prl', 'vitd'] },
]
