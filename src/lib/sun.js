import * as Astronomy from 'astronomy-engine'

// ── Sunset, for wherever she is. The same ephemeris the horoscope runs on, so
// this needs no network and no API key — it is arithmetic on her coordinates.
// Returns a Date, or null when we don't know where she is (the caller then
// falls back to a fixed hour rather than guessing).
export function sunsetOn(date, location) {
  const lat = location && typeof location === 'object' ? Number(location.latitude) : NaN
  const lon = location && typeof location === 'object' ? Number(location.longitude) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  try {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    const observer = new Astronomy.Observer(lat, lon, 0)
    // -1 searches for the setting, within one day of the start.
    const found = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, startOfDay, 1)
    return found ? found.date : null
  } catch {
    return null
  }
}

// "7:42 PM" — for telling her when the evening opens.
export const clockOf = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const ap = h < 12 ? 'AM' : 'PM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`
}
