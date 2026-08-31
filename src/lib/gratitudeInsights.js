// ── Reading what she wrote, rather than counting that she wrote. Everything
// here works on the words themselves: which subjects keep returning, which part
// of a life they belong to, and which lines were worth keeping. No model, no
// network — it has to be right offline and instant.

const STOPWORDS = new Set(`
a an and the of to in on at for with from by as is are was were be been being am
i im i'm my me mine myself we our us you your yours he him his she her hers they
them their it its this that these those there here what which who whom when where
why how all any both each few more most other some such no nor not only own same
so than too very can will just dont don't should now got get getting had has have
having did do does doing done able about after again against because before being
below between during into out over under up down off through above once but or if
then else about around still yet also even much many lot lots really quite bit
today tonight morning evening day days week weeks time times thing things able
made make makes making feel feels feeling felt good great nice lovely wonderful
grateful thankful thanks love loved loves like liked being new one two three
`.trim().split(/\s+/))

// Rough plural folding — enough to keep "walks" and "walk" together without
// dragging in a stemmer.
const singular = (w) => {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`
  if (w.length > 3 && w.endsWith('ses')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

// Every written line across the whole history, with its date.
export function allLines(map, normDay) {
  const out = []
  Object.keys(map || {}).forEach((k) => {
    const entries = normDay(map[k]).entries || {}
    Object.entries(entries).forEach(([promptId, arr]) => {
      ;(Array.isArray(arr) ? arr : []).forEach((l) => {
        const t = (l || '').trim()
        if (t) out.push({ date: k, promptId, text: t })
      })
    })
  })
  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

// The subjects that keep coming back. A word she capitalised mid-sentence is
// almost always a person, so it keeps its capital and counts for more.
export function subjectsOf(lines, { min = 2, limit = 14 } = {}) {
  const counts = new Map()
  const display = new Map()
  const proper = new Set()

  lines.forEach(({ text }) => {
    const words = text.split(/[^A-Za-z'’-]+/).filter(Boolean)
    const seenInLine = new Set()
    words.forEach((raw, i) => {
      const low = singular(raw.toLowerCase().replace(/[’']s$/, ''))
      if (low.length < 3 || STOPWORDS.has(low)) return
      // capitalised, but not merely the first word of the line
      if (i > 0 && /^[A-Z]/.test(raw)) proper.add(low)
      if (!display.has(low)) display.set(low, raw)
      if (/^[A-Z]/.test(raw)) display.set(low, raw)
      if (seenInLine.has(low)) return // one line counts once
      seenInLine.add(low)
      counts.set(low, (counts.get(low) || 0) + 1)
    })
  })

  return [...counts.entries()]
    .filter(([, n]) => n >= min)
    .map(([w, n]) => ({
      key: w,
      label: proper.has(w) ? display.get(w) : w,
      count: n,
      person: proper.has(w),
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit)
}

// Which part of a life a line belongs to. Deliberately coarse — it is a shape,
// not a diagnosis.
const DOMAINS = [
  { id: 'people', label: 'People', words: 'mum mom dad sister brother friend friends husband wife partner son daughter family baby team call called dinner together laugh laughed talk talked hug love' },
  { id: 'body', label: 'Body', words: 'sleep slept walk walked run ran gym train training stretch yoga pilates skin hair strong rest rested energy body bath shower breath breathe heal healing period cycle' },
  { id: 'work', label: 'Work', words: 'work project client meeting launch shipped wrote writing money paid job business idea built build finished deadline' },
  { id: 'home', label: 'Home', words: 'home house kitchen bed room garden clean tidy plants candle fire coffee tea quiet apartment sheets' },
  { id: 'food', label: 'Food', words: 'ate eat food meal breakfast lunch dinner cook cooked bread fruit peach coffee wine chocolate market' },
  { id: 'world', label: 'The world', words: 'sun sunset sunrise sky rain weather sea ocean beach trees tree birds air light moon flowers park mountain snow travel trip' },
]
const DOMAIN_INDEX = (() => {
  const m = new Map()
  DOMAINS.forEach((d) => d.words.split(/\s+/).forEach((w) => m.set(w, d.id)))
  return m
})()

export const domainOf = (text) => {
  const words = text.toLowerCase().split(/[^a-z']+/).filter(Boolean)
  const tally = {}
  words.forEach((w) => {
    const id = DOMAIN_INDEX.get(w) || DOMAIN_INDEX.get(singular(w))
    if (id) tally[id] = (tally[id] || 0) + 1
  })
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  return best ? best[0] : null
}
export const domainLabel = (id) => (DOMAINS.find((d) => d.id === id) || {}).label || 'Elsewhere'
export const DOMAIN_IDS = DOMAINS.map((d) => d.id)

// What a month came to: the subjects that recurred, where the gratitude sat,
// and the lines worth reading back.
export function compileMonth(lines, year, month) {
  const inMonth = lines.filter(({ date }) => {
    const [y, m] = date.split('-').map(Number)
    return y === year && m === month + 1
  })
  const days = new Set(inMonth.map((l) => l.date))
  const split = {}
  inMonth.forEach(({ text }) => {
    const d = domainOf(text) || 'other'
    split[d] = (split[d] || 0) + 1
  })
  const ordered = Object.entries(split).sort((a, b) => b[1] - a[1])
  // The lines worth keeping: the most particular ones, which in practice means
  // the ones she took the trouble to write out.
  const best = [...inMonth].sort((a, b) => b.text.length - a.text.length).slice(0, 5)
  return {
    lines: inMonth,
    days: days.size,
    written: inMonth.length,
    subjects: subjectsOf(inMonth, { min: 2, limit: 8 }),
    split: ordered.map(([id, n]) => ({ id, label: id === 'other' ? 'Elsewhere' : domainLabel(id), n })),
    best,
  }
}

// The month as plain text, for keeping or sending on.
export function monthAsText(compiled, monthName, year) {
  const L = []
  L.push(`Gratitude — ${monthName} ${year}`)
  L.push('')
  L.push(`${compiled.written} things across ${compiled.days} day${compiled.days === 1 ? '' : 's'}.`)
  if (compiled.subjects.length) {
    L.push('')
    L.push('What kept coming back')
    compiled.subjects.forEach((s) => L.push(`  ${s.label} · ${s.count}`))
  }
  if (compiled.split.length) {
    L.push('')
    L.push('Where it sat')
    compiled.split.forEach((s) => L.push(`  ${s.label} · ${s.n}`))
  }
  if (compiled.best.length) {
    L.push('')
    L.push('Lines worth keeping')
    compiled.best.forEach((b) => L.push(`  ${b.date} — ${b.text}`))
  }
  return L.join('\n')
}
