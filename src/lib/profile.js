import { MELISSA_USER_ID } from './brand.js'

// Her chart, moved off the global path. Other accounts never receive these.
export const MELISSA_PROFILE = {
  firstName: 'Melissa',
  lastName: 'Hilary',
  birthday: '1997-10-17',
  birthTime: '06:30',
  birthPlace: 'Valencia, Venezuela',
  lat: 10.162,
  lon: -68.0077,
  cycleOptIn: true,
  setupComplete: true,
}

export const MELISSA_SIGNS = { sun: 'Libra', moon: 'Taurus', rising: 'Libra' }

const blank = () => ({
  firstName: '',
  lastName: '',
  birthday: '',
  birthTime: '',
  birthPlace: '',
  lat: null,
  lon: null,
  cycleOptIn: false,
  setupComplete: false,
})

export function resolveProfile(stored, userId) {
  const row = stored && typeof stored === 'object' ? stored : null
  if (row && (row.firstName || row.birthday || row.setupComplete)) return row
  if (userId === MELISSA_USER_ID) return { ...MELISSA_PROFILE }
  return blank()
}

export function resolveSigns(stored, userId) {
  const row = stored && typeof stored === 'object' ? stored : null
  if (row && row.sun && row.moon && row.rising) return { sun: row.sun, moon: row.moon, rising: row.rising }
  if (userId === MELISSA_USER_ID) return { ...MELISSA_SIGNS }
  return { sun: '', moon: '', rising: '' }
}

export function needsSetup(stored, userId) {
  if (userId === MELISSA_USER_ID) return false
  const row = stored && typeof stored === 'object' ? stored : null
  if (row && (row.setupComplete || row.firstName)) return false
  return true
}

// Keys that are absent for the first account. Existing keys are not in this list.
export function missingSeeds(has, userId) {
  if (userId !== MELISSA_USER_ID) return []
  const out = []
  if (!has('mos:profile')) out.push(['mos:profile', { ...MELISSA_PROFILE }])
  if (!has('mos:astro:signs')) out.push(['mos:astro:signs', { ...MELISSA_SIGNS }])
  if (!has('mos:settings:location')) out.push(['mos:settings:location', 'Alameda'])
  return out
}
