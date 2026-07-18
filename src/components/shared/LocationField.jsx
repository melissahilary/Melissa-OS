import React, { useEffect, useRef, useState } from 'react'

// A location is stored either as a legacy string ("Alameda") or, once picked from
// the autocomplete, an object with coordinates + label. These helpers read both.
export const dropdownLabel = (r) => [r.name, r.admin1, r.country].filter(Boolean).join(', ')
export const storedLabel = (r) => [r.name, r.admin1].filter(Boolean).join(', ')
export const locLabel = (loc) => (loc && typeof loc === 'object' ? loc.label || storedLabel(loc) : (loc || ''))
export const locKey = (loc) => (loc && typeof loc === 'object' ? `${loc.latitude},${loc.longitude}` : String(loc || ''))

// Resolve a stored location to coordinates (+ timezone). Objects carry their own;
// legacy strings get geocoded once.
export async function resolveCoords(location) {
  if (location && typeof location === 'object' && location.latitude != null) return location
  const q = (typeof location === 'string' ? location : '').trim()
  if (!q) return null
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`)
    const j = await r.json()
    return (j && j.results && j.results[0]) || null
  } catch { return null }
}

// City autocomplete over Open-Meteo's worldwide geocoder — type any city and pick
// "City, State, Country" from the list.
export default function LocationField({ location, setLocation, className }) {
  const label = locLabel(location)
  const [q, setQ] = useState(label)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const editing = useRef(false)

  // Keep the box in sync when the location changes elsewhere (not while typing).
  useEffect(() => { if (!editing.current) setQ(label) }, [label])

  useEffect(() => {
    const term = q.trim()
    if (!editing.current || term.length < 2) { setResults([]); return undefined }
    let alive = true
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=8&language=en&format=json`)
        const j = await r.json()
        if (alive) { setResults(Array.isArray(j.results) ? j.results : []); setOpen(true) }
      } catch { if (alive) setResults([]) }
    }, 250)
    return () => { alive = false; clearTimeout(id) }
  }, [q])

  const pick = (r) => {
    editing.current = false
    setLocation({
      label: storedLabel(r), name: r.name, admin1: r.admin1 || '', country: r.country || '',
      country_code: r.country_code || '', latitude: r.latitude, longitude: r.longitude, timezone: r.timezone || '',
    })
    setQ(storedLabel(r)); setResults([]); setOpen(false)
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { editing.current = true; setQ(e.target.value); setOpen(true) }}
        onFocus={() => { editing.current = true }}
        onBlur={() => { editing.current = false; setTimeout(() => setOpen(false), 150) }}
        placeholder="City"
        className={className}
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 overflow-y-auto border border-stone-200 bg-cream shadow-xl">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(r) }}
                className="block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
              >
                {dropdownLabel(r)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
