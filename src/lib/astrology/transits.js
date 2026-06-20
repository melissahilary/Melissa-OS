// Deterministic transit engine. Computes today's geocentric ecliptic longitudes
// with astronomy-engine, then aspects them to the hard-coded natal points.
// All math lives here — the LLM only ever sees the resulting structured list.

import * as Astronomy from 'astronomy-engine'
import { NATAL_LONGITUDES, signOf, degreeInSign } from './natal.js'

const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0)
const PRECESSION_ARCSEC_PER_YEAR = 50.2879

// J2000 mean-ecliptic longitude (from astronomy-engine) → tropical longitude of
// date, via the linear precession term. Accurate to well under our orbs.
function precessionDegrees(date) {
  const years = (date.getTime() - J2000) / (365.25 * 86400000)
  return (years * PRECESSION_ARCSEC_PER_YEAR) / 3600
}

export const TRANSIT_BODIES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]

export const PLANET_GLYPH = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  NorthNode: '☊', Ascendant: 'Asc', Midheaven: 'MC',
}

export const ASPECTS = [
  { name: 'conjunction', angle: 0, glyph: '☌', orb: 4 },
  { name: 'sextile', angle: 60, glyph: '⚹', orb: 2.5 },
  { name: 'square', angle: 90, glyph: '□', orb: 3 },
  { name: 'trine', angle: 120, glyph: '△', orb: 3 },
  { name: 'opposition', angle: 180, glyph: '☍', orb: 4 },
]

// Loudness weights — what the chart cares about most.
const NATAL_WEIGHT = {
  Sun: 5, Moon: 5, Ascendant: 5, Venus: 5, // double-Libra, Venus-ruled chart
  Mercury: 3, Mars: 3, Midheaven: 3,
  Jupiter: 2, Saturn: 2, Uranus: 1, Neptune: 1, Pluto: 1, NorthNode: 1,
}
const TRANSIT_WEIGHT = {
  Moon: 5, Sun: 4, Mercury: 3, Venus: 3, Mars: 3,
  Saturn: 2.5, Pluto: 2.5, Jupiter: 2, Uranus: 2, Neptune: 2,
}
const ASPECT_WEIGHT = { conjunction: 3, opposition: 2.5, square: 2.5, trine: 2, sextile: 1.5 }

function transitLongitude(body, date) {
  const vec = Astronomy.GeoVector(Astronomy.Body[body], date, true)
  const ecl = Astronomy.Ecliptic(vec)
  return (((ecl.elon + precessionDegrees(date)) % 360) + 360) % 360
}

function separation(a, b) {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

// Returns { positions, aspects } for the given date (defaults to now).
export function computeTransits(date = new Date()) {
  const positions = {}
  TRANSIT_BODIES.forEach((body) => {
    const lon = transitLongitude(body, date)
    positions[body] = { longitude: lon, sign: signOf(lon), degree: degreeInSign(lon) }
  })

  const aspects = []
  TRANSIT_BODIES.forEach((tBody) => {
    const tLon = positions[tBody].longitude
    Object.entries(NATAL_LONGITUDES).forEach(([nPoint, nLon]) => {
      const sep = separation(tLon, nLon)
      ASPECTS.forEach((asp) => {
        const orb = Math.abs(sep - asp.angle)
        if (orb <= asp.orb) {
          const score =
            ((NATAL_WEIGHT[nPoint] || 1) * (TRANSIT_WEIGHT[tBody] || 1) * ASPECT_WEIGHT[asp.name]) /
            (1 + orb)
          aspects.push({
            transit: tBody,
            natal: nPoint,
            aspect: asp.name,
            glyph: asp.glyph,
            orb: Math.round(orb * 100) / 100,
            score: Math.round(score * 1000) / 1000,
          })
        }
      })
    })
  })

  aspects.sort((a, b) => b.score - a.score)
  return { positions, aspects }
}
