// ── What the browser can tell about a picture on its own.
//
// Two of the most useful things a board can say need no model at all, and
// shouldn't wait on one: whether she has saved this image before, and which
// pictures look alike. Both come out of a perceptual hash computed at the moment
// she drops the file — instant, offline, and free.

// A 64-bit average hash. Shrink to 8×8 greyscale, then mark each pixel as above
// or below the mean. Robust to resizing, re-compression and small crops, which
// is exactly how the same image arrives twice from two different websites.
export function averageHash(img) {
  const N = 8
  const c = document.createElement('canvas')
  c.width = N
  c.height = N
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, N, N)
  let data
  try { data = ctx.getImageData(0, 0, N, N).data } catch { return '' }

  const grey = []
  for (let i = 0; i < data.length; i += 4) {
    grey.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }
  const mean = grey.reduce((a, b) => a + b, 0) / grey.length
  let hex = ''
  for (let i = 0; i < grey.length; i += 4) {
    let nib = 0
    for (let j = 0; j < 4; j += 1) if (grey[i + j] > mean) nib |= 1 << (3 - j)
    hex += nib.toString(16)
  }
  return hex
}

// How many of the 64 bits differ.
export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64
  let d = 0
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) { d += x & 1; x >>= 1 }
  }
  return d
}

// Under about a tenth of the bits differing is the same picture arriving again.
export const SAME = 6
export const ALIKE = 14

// Every earlier save of this same image. Repetition is her telling herself
// something, so it is worth surfacing as a fact — never as a warning.
export const duplicatesOf = (item, all) => (!item.hash ? [] : all.filter(
  (x) => x.id !== item.id && x.hash && hamming(item.hash, x.hash) <= SAME,
))

// Quiet gathering by how things look — a shared palette, a shared shape, a
// shared quality of light. Not by meaning: this says nothing about what any of
// it is for, which is the part that belongs to her.
export function clusters(items, { min = 3 } = {}) {
  const seen = new Set()
  const out = []
  items.forEach((it) => {
    if (!it.hash || seen.has(it.id)) return
    const group = items.filter((x) => x.hash && !seen.has(x.id) && hamming(it.hash, x.hash) <= ALIKE)
    if (group.length >= min) {
      group.forEach((g) => seen.add(g.id))
      out.push(group)
    }
  })
  return out
}

// ── Finding it again ────────────────────────────────────────────────
// She never labelled any of this, so search runs over what the picture itself
// said plus anything she happened to write. Ordinary word matching, but over
// text a machine wrote about the image rather than text she had to type.
const STOP = new Set('a an the of in on at with and or is it this that one my her for from to'.split(' '))

const haystack = (it) => [
  it.title, it.caption, it.kind, it.material, it.brand, it.room, it.source,
  (it.colors || []).join(' '), it.search,
].filter(Boolean).join(' ').toLowerCase()

export function matches(item, query) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return true
  const hay = haystack(item)
  const words = q.split(/[^a-z0-9']+/).filter((w) => w.length > 1 && !STOP.has(w))
  if (!words.length) return true
  // Every meaningful word has to appear somewhere — "the green kitchen" should
  // not return every kitchen.
  return words.every((w) => hay.includes(w) || hay.includes(w.replace(/s$/, '')))
}

export const searchable = (it) => haystack(it).length > 0
