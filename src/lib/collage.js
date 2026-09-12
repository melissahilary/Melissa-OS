// ── The board, composed.
//
// A scrapbook and a contact sheet hold the same photographs. What separates
// them is entirely the arrangement, and it comes down to two things: cards of
// different weight, and edges that lap over each other rather than abut.
//
// The old placement had neither. Three fixed columns at six, thirty-six and
// sixty-six per cent, a fixed two hundred and fifty pixels of drop between
// rows, and a degree or two of tilt on top. Cards never overlapped sideways
// because the columns were further apart than the cards were wide; they
// collided vertically at random, because a fixed drop cannot know how tall the
// next picture is. That is the choppiness — a grid with tape on it, and the
// tape doing all the work.
//
// So: three running columns, each card dropped into whichever column is
// currently shortest, so the board grows evenly instead of leaving one side
// hanging. Every card is pushed off its column's centre line by a share of the
// slack, which is what turns three columns into a suggestion rather than a
// ruling — and it is what makes cards lap sideways into their neighbours. Every
// card is then pulled up over the one above it by a slice of its own height.
//
// The overlaps are deliberately shallow — six to seventeen per cent of a card,
// landing at corners. A collage that covers the middle of its own pictures is
// not imperfect, it is just a mess.
//
// Everything is drawn from the picture's own id, so a card sits in exactly the
// same place on her phone, her laptop and after every reload. Nothing here is
// random at render time.

export const SIZES = { S: 150, M: 225, L: 330 }
export const sizeW = (s) => (SIZES[s] ? SIZES[s] : SIZES.M)

// Three across is the density she asked for, and the density a phone holds
// without the pictures becoming stamps.
const COLS = 3
// A card clipped by the edge of the board reads as a bug, never as a crop.
const EDGE = 10
// The columns do not start on one rule. A straight top edge on a scrapbook is
// the first thing that gives away that a machine placed it.
const TOPS = [14, 46, 26]

const hash32 = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// A stream that depends only on the id it was seeded with.
const rng = (seed) => {
  let s = (seed || 1) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// A board wants weight in it: a few large, a scatter of small, the rest even.
// The rhythm comes from the position so it reads as a composition rather than
// as noise — then the picture's own shape vetoes anything that would make a
// tower or a strip of it.
function pickSize(ratio, i) {
  let size = 'M'
  if (i % 5 === 4) size = 'S'
  if (i % 7 === 2) size = 'L'
  if (size === 'L' && ratio > 1.45) size = 'M'
  if (size === 'S' && ratio < 0.72) size = 'M'
  return size
}

// How much of the smaller of two cards one is allowed to cover. Past about a
// third, the card underneath has stopped being a picture on a board and has
// become a texture behind another one.
const MAX_COVER = 0.3

// The worst burial this card would inflict on anything already down.
function buries(rects, b) {
  const areaB = b.w * b.h
  let worst = 0
  for (let i = 0; i < rects.length; i += 1) {
    const a = rects[i]
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    if (ox <= 0 || oy <= 0) continue
    const cover = (ox * oy) / Math.min(areaB, a.w * a.h)
    if (cover > worst) worst = cover
  }
  return worst
}

// Returns, per item id: x as a percentage of the canvas, y in canvas pixels,
// the size it should be drawn at, its tilt, its height, and where it sits in
// the stack.
export function compose(items, canvasW, cols = COLS) {
  const colW = canvasW / cols
  const bottoms = Array.from({ length: cols }, (_, i) => TOPS[i % TOPS.length])
  const rects = []
  const out = {}

  items.forEach((it, i) => {
    const r = rng(hash32(String(it.id || i)))
    const ratio = (it.h || 3) / (it.w || 4)
    const size = pickSize(ratio, i)
    const w = sizeW(size)
    const h = Math.round(w * ratio)

    let c = 0
    for (let k = 1; k < cols; k += 1) if (bottoms[k] < bottoms[c]) c = k

    // Off the centre line by a share of the slack. A large card has negative
    // slack — it is wider than its column — so it is already lapping into both
    // neighbours, and only needs a nudge.
    const slack = colW - w
    const jitter = (r() - 0.5) * (slack > 0 ? slack * 1.7 : 64)
    // Lap it over the card above. The first card in a column has nothing to lap.
    const first = bottoms[c] === TOPS[c % TOPS.length]
    const lap = first ? 0 : h * (0.06 + r() * 0.11)

    // Then settle it. A large card thrown hard off its column line can land
    // almost squarely on top of a smaller one — which is not an imperfect
    // overlap, it is a lost picture. So the card is offered its intended place
    // first and, if that buries something, walked back toward its column and up
    // off the card above until it doesn't. The first offer is almost always the
    // one taken; this only bites where it has to.
    let best = null
    let worst = Infinity
    for (let k = 0; k < 5; k += 1) {
      const damp = 1 - k * 0.22
      const at = {
        x: Math.max(EDGE, Math.min(canvasW - w - EDGE, c * colW + (colW - w) / 2 + jitter * damp)),
        y: Math.max(0, Math.round(bottoms[c] - lap * damp)),
        w,
        h,
      }
      const cover = buries(rects, at)
      if (cover < worst) { worst = cover; best = at }
      if (cover <= MAX_COVER) break
    }

    const { x, y } = best
    rects.push(best)
    bottoms[c] = y + h

    out[it.id] = {
      x: (x / canvasW) * 100,
      y,
      size,
      h,
      // Never nought. One card sitting perfectly straight among tilted ones
      // reads as a card that failed to get tilted.
      rot: Math.round((1.1 + r() * 2.7) * (r() < 0.5 ? -1 : 1) * 10) / 10,
      // A small card tucked over a large one reads as deliberate; a large one
      // dropped across a small one reads as an accident.
      z: i + 1 + (size === 'S' ? 400 : 0),
    }
  })

  return out
}
