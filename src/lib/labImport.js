// ── Getting numbers in without typing them.
//
// Results arrive as a PDF, a portal screenshot, an email, a photo of a printout.
// What they all have in common is that a human can select the text. So the
// import that actually works on day one is paste: drop the whole report in and
// let this find the markers inside it.
//
// Two rules hold the design together. Nothing is guessed silently — a line that
// cannot be read comes back as unread, visibly, rather than vanishing. And the
// lab's own printed range is captured and kept, because it always outranks the
// general one in the catalogue.

import { resolveMarker, toCanonical } from './biomarkers'

// Units as labs print them. Kept deliberately tight — a loose unit pattern
// swallows half the reference range and turns a good number into a wrong one.
const UNIT = /(ng\/dL|ng\/mL|ng\/L|pg\/mL|µg\/dL|ug\/dL|mcg\/dL|µg\/L|ug\/L|mg\/dL|mg\/L|g\/dL|g\/L|mIU\/L|mIU\/mL|µIU\/mL|uIU\/mL|IU\/mL|IU\/L|mU\/L|nmol\/L|pmol\/L|µmol\/L|umol\/L|mmol\/L|mmol\/mol|mcg\/L|%)/i

// "0.450-4.500", "30 - 100", "<5", "> 50", "0.4–4.0"
const RANGE = /(?:^|\s|\()(?:(<|>|≤|≥)\s*(\d+\.?\d*)|(\d+\.?\d*)\s*[-–—]\s*(\d+\.?\d*))(?:\s|\)|$)/

const SEP = '\u0000'

const NOISE = /^(name|patient|dob|date of birth|collected|reported|ordering|physician|specimen|account|page|test\s*name|result|units?|reference|flag|status|final|comment)s?\b/i

function parseRange(tail) {
  const m = tail.match(RANGE)
  if (!m) return null
  if (m[1]) {
    const n = parseFloat(m[2])
    return m[1] === '<' || m[1] === '≤' ? [null, n] : [n, null]
  }
  const lo = parseFloat(m[3])
  const hi = parseFloat(m[4])
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return null
  return [lo, hi]
}

// Standalone numbers — ones not welded to a letter. This is what keeps
// "25-Hydroxy", "Vitamin B12", "Free T4", "HbA1c" and "(E2)" from being read as
// results: their digits belong to the name, and a name is not a number.
const NUMBERS = /(?<![A-Za-z0-9.])(\d+(?:[.,]\d+)?)/g

function lastNumberIn(text) {
  let m
  let last = null
  NUMBERS.lastIndex = 0
  // eslint-disable-next-line no-cond-assign
  while ((m = NUMBERS.exec(text)) !== null) last = m
  if (!last) return null
  return { value: parseFloat(last[1].replace(',', '.')), at: last.index }
}

// One line of a report → what it says, if anything.
export function readLine(raw) {
  // A printout's only structure is its columns, and a column boundary is a tab
  // or a run of spaces. That boundary is marked before the line is collapsed, so
  // the fallback still has something to read when there is no unit to anchor on.
  const line = String(raw || '').replace(/[ \t]+/g, (s) => (s.length > 1 ? SEP : ' ')).trim()
  const flat = line.split(SEP).join(' ').replace(/\s+/g, ' ').trim()
  if (flat.length < 3 || NOISE.test(flat)) return null

  let name = ''
  let value = null
  let unit = ''
  let tail = ''

  // The unit is the anchor. Everything a lab prints is laid out around it: the
  // result immediately before, the reference range immediately after. Find it
  // and the ambiguity disappears.
  const unitMatch = flat.match(UNIT)
  if (unitMatch) {
    const at = flat.indexOf(unitMatch[1])
    const head = flat.slice(0, at)
    const num = lastNumberIn(head)
    if (!num) return null
    name = head.slice(0, num.at)
    value = num.value
    unit = unitMatch[1]
    tail = flat.slice(at + unitMatch[1].length)
  } else {
    // No unit: fall back to the column layout, then to "Name: value".
    const cells = line.split(SEP).map((c) => c.trim()).filter(Boolean)
    const numeric = cells.findIndex((c, i) => i > 0 && /^[<>≤≥]?\s*\d+(?:\.\d+)?$/.test(c))
    if (cells.length >= 2 && numeric > 0) {
      name = cells[0]
      value = parseFloat(cells[numeric].replace(/[^\d.]/g, ''))
      tail = cells.slice(numeric + 1).join(' ')
    } else {
      const m = flat.match(/^(.{2,60}?)\s*[:=]\s*[<>≤≥]?\s*(\d+(?:\.\d+)?)\b(.*)$/)
      if (!m) return null
      name = m[1]
      value = parseFloat(m[2])
      tail = m[3] || ''
    }
  }

  name = name.replace(/[:,|\-–—\s]+$/, '').replace(/^[\s|]+/, '').trim()
  if (name.length < 2 || !/[A-Za-z]/.test(name) || !Number.isFinite(value)) return null

  const marker = resolveMarker(name)
  const labRange = parseRange(tail)

  return {
    raw: flat,
    name,
    marker: marker ? marker.id : null,
    markerLabel: marker ? marker.label : null,
    value,
    unit,
    labRange,
    canonical: marker ? toCanonical(marker, value, unit || marker.unit) : null,
    flagged: /(?:^|\s)(H|L|HIGH|LOW|ABNORMAL)\s*$/i.test(tail),
  }
}

// A whole report. Returns what was understood and what was not, because the
// lines it could not read are the ones she most needs to see.
export function readReport(text) {
  const lines = String(text || '').split(/[\r\n]+/)
  const found = []
  const unread = []
  const seen = new Set()

  lines.forEach((l) => {
    const r = readLine(l)
    if (!r) return
    if (!r.marker) {
      if (l.trim().length > 4) unread.push(l.trim())
      return
    }
    // A report often prints the same marker twice (summary then detail). The
    // first reading wins; a duplicate is not new information.
    if (seen.has(r.marker)) return
    seen.add(r.marker)
    found.push(r)
  })

  return { found, unread }
}

// CSV / TSV, for the exports the portals do offer.
export function readTable(text) {
  const rows = String(text || '').split(/[\r\n]+/).filter((r) => r.trim())
  if (!rows.length) return { found: [], unread: [] }
  const split = (r) => (r.includes('\t') ? r.split('\t') : r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)).map((c) => c.replace(/^"|"$/g, '').trim())

  const head = split(rows[0]).map((h) => h.toLowerCase())
  const col = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)))
  const iName = col('test', 'marker', 'analyte', 'name')
  const iVal = col('value', 'result')
  const iUnit = col('unit')
  const iDate = col('date', 'collected')

  // Without a recognisable header this is not a table — read it as a report.
  if (iName < 0 || iVal < 0) return readReport(text)

  const found = []
  const unread = []
  const seen = new Set()
  rows.slice(1).forEach((r) => {
    const c = split(r)
    const name = c[iName]
    if (!name) return
    const marker = resolveMarker(name)
    const value = parseFloat(String(c[iVal]).replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(value)) return
    if (!marker) { unread.push(r.trim()); return }
    if (seen.has(marker.id)) return
    seen.add(marker.id)
    const unit = iUnit >= 0 ? c[iUnit] : ''
    found.push({
      raw: r.trim(),
      name,
      marker: marker.id,
      markerLabel: marker.label,
      value,
      unit,
      date: iDate >= 0 ? c[iDate] : '',
      labRange: null,
      canonical: toCanonical(marker, value, unit || marker.unit),
      flagged: false,
    })
  })
  return { found, unread }
}

// Let the shape of the text decide which reader to use.
export function readAny(text) {
  const t = String(text || '')
  const firstLine = t.split(/[\r\n]/)[0] || ''
  const looksTabular = /\t/.test(firstLine) || (firstLine.split(',').length >= 3 && /test|marker|analyte|result|value/i.test(firstLine))
  return looksTabular ? readTable(t) : readReport(t)
}
