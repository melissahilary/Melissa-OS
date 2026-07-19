// Live moon phase, computed from the sky — not a lookup table.
// astronomy-engine gives the Moon's geocentric phase angle (elongation from the
// Sun) at any instant; the phase is a global, geocentric quantity, so it reads
// the same at every location on Earth for a given moment. We also search forward
// for the next new and full moons.

import * as Astronomy from 'astronomy-engine'

// The eight named phases, in cycle order (0 = new).
export const MOON_PHASES = [
  { id: 'new', name: 'New Moon' },
  { id: 'waxing-crescent', name: 'Waxing Crescent' },
  { id: 'first-quarter', name: 'First Quarter' },
  { id: 'waxing-gibbous', name: 'Waxing Gibbous' },
  { id: 'full', name: 'Full Moon' },
  { id: 'waning-gibbous', name: 'Waning Gibbous' },
  { id: 'third-quarter', name: 'Third Quarter' },
  { id: 'waning-crescent', name: 'Waning Crescent' },
]

// Phase angle (0..360, where 0 = new, 90 = first quarter, 180 = full, 270 =
// third quarter) → the named phase. Quarters/new/full occupy a small window
// around their exact mark; everything else is a crescent or gibbous.
export function phaseFromAngle(angle) {
  const a = ((angle % 360) + 360) % 360
  const W = 7 // degrees on either side of an exact quarter
  if (a < W || a > 360 - W) return MOON_PHASES[0]
  if (Math.abs(a - 90) < W) return MOON_PHASES[2]
  if (Math.abs(a - 180) < W) return MOON_PHASES[4]
  if (Math.abs(a - 270) < W) return MOON_PHASES[6]
  if (a < 90) return MOON_PHASES[1]
  if (a < 180) return MOON_PHASES[3]
  if (a < 270) return MOON_PHASES[5]
  return MOON_PHASES[7]
}

function searchPhase(targetLon, date) {
  try {
    const t = Astronomy.SearchMoonPhase(targetLon, date, 40)
    return t ? t.date : null
  } catch {
    return null
  }
}

// Everything the UI needs for a given instant.
export function moonInfo(date = new Date()) {
  const angle = Astronomy.MoonPhase(date) // 0..360
  const fraction = (1 - Math.cos((angle * Math.PI) / 180)) / 2 // 0 new … 1 full
  return {
    angle,
    fraction,
    waxing: angle < 180,
    phase: phaseFromAngle(angle),
    nextNew: searchPhase(0, date),
    nextFull: searchPhase(180, date),
  }
}
