// ── What a form of movement asks of the body.
//
// Melissa writes down what she did, not what it was for. The eight qualities
// below are what it was for, and she should never have to pick one: a reformer
// class is strength and core and posture whether or not anyone says so. So the
// reading is done for her — by Claude when the network is there (api/movement.js),
// and by the keyword table here the instant she presses Add, so a line is never
// sitting blank waiting on a round trip.
//
// Colours are the brand's secondary set, used nowhere else in the app. They
// are a legend, not a state: they say which quality, never good or bad.

export const QUALITIES = [
  { id: 'strength',    label: 'Strength',    tone: '#4C5F72' },
  { id: 'core',        label: 'Core',        tone: '#7E7452' },
  { id: 'flexibility', label: 'Flexibility', tone: '#7C8A6A' },
  { id: 'cardio',      label: 'Cardio',      tone: '#B2913C' },
  { id: 'glutes',      label: 'Glutes',      tone: '#9C5A32' },
  { id: 'pelvic',      label: 'Pelvic floor',tone: '#B07CA8' },
  { id: 'mobility',    label: 'Mobility',    tone: '#6F8A63' },
  { id: 'posture',     label: 'Posture',     tone: '#8D7FA8' },
]

export const QUALITY_IDS = QUALITIES.map((q) => q.id)
const BY_ID = Object.fromEntries(QUALITIES.map((q) => [q.id, q]))
export const qualityOf = (id) => BY_ID[id] || null

// The signature a reading is cached against. Two "reformer, with ines" lines on
// two different days are the same question and get asked once.
export const signatureOf = (x) =>
  `${String((x && x.name) || '').trim().toLowerCase()}|${String((x && x.detail) || '').trim().toLowerCase()}`

// Only ever these, only ever three, in the order the legend is drawn.
export const tidyKinds = (list) => {
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(list) ? list : []) {
    const id = String(raw || '').trim().toLowerCase()
    if (!BY_ID[id] || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return QUALITY_IDS.filter((id) => seen.has(id)).slice(0, 3)
}

// ── The reading that needs no network.
//
// Each quality owns the words that plainly mean it. A line is read against all
// of them and keeps the three that scored; anything that scored nothing at all
// is still movement, so it falls back to cardio + mobility rather than nothing.
const WORDS = {
  strength: ['strength', 'lift', 'lifting', 'weight', 'weights', 'dumbbell', 'barbell', 'kettlebell', 'press', 'squat', 'deadlift', 'row', 'curl', 'push up', 'pushup', 'pull up', 'pullup', 'resistance', 'band', 'legs', 'upper body', 'lower body', 'arms', 'back day', 'leg day', 'heavy', 'machine', 'chest', 'shoulders', 'gym', 'crossfit', 'f45', 'bootcamp', 'circuit', 'sets', 'reps', 'tonal'],
  core: ['core', 'abs', 'ab ', 'plank', 'sit up', 'situp', 'crunch', 'pilates', 'reformer', 'megaformer', 'lagree', 'obliques', 'hollow', 'dead bug', 'tva', 'deep core'],
  flexibility: ['stretch', 'stretching', 'flexibility', 'split', 'splits', 'hamstring', 'yin', 'restorative', 'bend', 'backbend', 'cool down', 'cooldown'],
  cardio: ['cardio', 'run', 'running', 'jog', 'sprint', 'treadmill', 'incline walk', 'bike', 'cycling', 'spin', 'peloton', 'row erg', 'erg', 'swim', 'swimming', 'hiit', 'tennis', 'pickleball', 'dance', 'zumba', 'jump rope', 'skipping', 'stairs', 'stairmaster', 'hike', 'hiking', 'elliptical', 'boxing', 'kickboxing', 'soccer', 'basketball'],
  glutes: ['glute', 'glutes', 'booty', 'hip thrust', 'bridge', 'kickback', 'abduction', 'band walk', 'monster walk', 'lunge', 'step up', 'squat', 'leg day', 'hamstring'],
  pelvic: ['pelvic', 'pelvic floor', 'kegel', 'postpartum', 'prenatal', 'diastasis', 'breathwork', 'breathing', 'hypopressive'],
  mobility: ['mobility', 'mobilise', 'mobilize', 'foam roll', 'rolling', 'warm up', 'warmup', 'yoga', 'vinyasa', 'flow', 'hip opener', 'cat cow', 'joint', 'range of motion', 'physio', 'rehab', 'walk', 'walking', 'stroll'],
  posture: ['posture', 'alignment', 'spine', 'spinal', 'thoracic', 'scapula', 'shoulder blade', 'barre', 'ballet', 'pilates', 'reformer', 'yoga', 'wall angel', 'neck', 'desk'],
}

export function readKinds(x) {
  const text = ` ${signatureOf(x).replace('|', ' ')} `
  const scored = []
  for (const id of QUALITY_IDS) {
    let n = 0
    for (const w of WORDS[id]) if (text.includes(w)) n += w.length
    if (n) scored.push([id, n])
  }
  if (!scored.length) return ['cardio', 'mobility']
  scored.sort((a, b) => b[1] - a[1])
  return tidyKinds(scored.slice(0, 3).map((s) => s[0]))
}
