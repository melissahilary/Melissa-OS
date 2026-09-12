// ── The board, composed as a paste-up.
//
// The reference is an editorial collage, and the thing to get right about it is
// that it is *nearly* a grid and not actually one. Blocks run in three rough
// columns, but they are not the same width as each other, they do not start on
// the same line, some lap over their neighbour by an inch and some leave a
// finger of ground showing. A true tiling — every block flush, every seam the
// same width — was the first attempt here and it read as a contact sheet: very
// tidy, and nothing like a page somebody laid out by hand.
//
// So: three running columns, each picture into whichever is shortest, at its
// own proportions rather than cropped into a slot; widths that sometimes exceed
// the column so blocks lap sideways; vertical laps and, now and then, a
// deliberate gap. No rotation, no tape, no borders and no shadows — the
// reference has none of those, and they were what made the last-but-one attempt
// read as a scrapbook rather than a collage.
//
// Everything is drawn from the picture's own id, so the page is identical on
// every screen and after every reload. Nothing is random at render time.
//
// Cut-outs are the only things allowed to break the rectangle. They keep their
// block's place and are drawn larger, on nothing at all.

const COLS = 3
// A block clipped by the edge of the page reads as a bug, never as a crop.
const EDGE = 10
// How much of the smaller of two blocks one may cover. Past about a third the
// block underneath has stopped being a picture and become a texture.
const MAX_COVER = 0.32
// A very tall photograph at full width would run the height of the screen on
// its own, so height is capped in multiples of its own width.
const MAX_RATIO = 1.62

// Three weights. The multiplier is against the column width, so anything over
// 1 is a block that laps into its neighbours by design.
const WEIGHT = { S: 0.82, M: 1.02, L: 1.24 }

const hash32 = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const rng = (seed) => {
  let s = (seed || 1) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

// A page wants weight in it: a few large, a scatter of small, the rest even.
// The rhythm comes from the position so it reads as a composition rather than
// as noise; the picture's own shape then vetoes anything that would make a
// tower or a strip of it.
function weigh(ratio, i) {
  let size = 'M'
  if (i % 5 === 4) size = 'S'
  if (i % 7 === 2) size = 'L'
  if (size === 'L' && ratio > 1.45) size = 'M'
  if (size === 'S' && ratio < 0.7) size = 'M'
  return size
}

// The worst burial this block would inflict on anything already down.
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

// Returns the blocks by id — position and size in canvas pixels — and the
// height the whole page comes to.
export function mosaic(items, canvasW, opts = {}) {
  const pad = opts.pad == null ? 18 : opts.pad
  const inner = canvasW - pad * 2
  const colW = inner / COLS
  // The columns do not start on one line. A straight top edge is the first
  // thing that gives away that a machine laid the page out.
  const bottoms = [pad, pad + Math.round(colW * 0.11), pad + Math.round(colW * 0.04)]
  const rects = []
  const tiles = {}

  items.forEach((it, i) => {
    const r = rng(hash32(String(it.id || i)))
    const ratio = Math.min(MAX_RATIO, (it.h || 3) / (it.w || 4))
    const size = weigh(ratio, i)
    const w = Math.round(colW * WEIGHT[size])
    const h = Math.round(w * ratio)

    let c = 0
    for (let k = 1; k < COLS; k += 1) if (bottoms[k] < bottoms[c]) c = k

    // Off the column's centre line, so the columns read as a drift rather than
    // a ruling — and so blocks meet their neighbours at different places.
    const jitter = (r() - 0.5) * colW * 0.3
    // Mostly a lap over the block above; every so often a finger of ground.
    const roll = r()
    const lap = roll < 0.12 ? -h * 0.04 * r() : h * (0.03 + r() * 0.11)

    let best = null
    let worst = Infinity
    for (let k = 0; k < 5; k += 1) {
      const damp = 1 - k * 0.24
      const at = {
        x: Math.max(EDGE, Math.min(canvasW - w - EDGE, pad + c * colW + (colW - w) / 2 + jitter * damp)),
        y: Math.max(pad, Math.round(bottoms[c] - lap * damp)),
        w,
        h,
      }
      const cover = buries(rects, at)
      if (cover < worst) { worst = cover; best = at }
      if (cover <= MAX_COVER) break
    }

    rects.push(best)
    bottoms[c] = best.y + h
    tiles[it.id] = {
      x: Math.round(best.x),
      y: Math.round(best.y),
      w,
      h,
      cut: false,
      // Later blocks sit over earlier ones, the way a paste-up is actually
      // built; a small block tucked over a large one reads as deliberate.
      z: i + 1 + (size === 'S' ? 400 : 0),
    }
  })

  // Which ones lift off the page. A rhythm rather than a judgement — the
  // photograph itself gets the final say, because a cut only happens if the
  // background actually comes away. Never the big blocks: a large picture grown
  // another quarter swallows the page instead of sitting on it.
  items.forEach((it, i) => {
    const t = tiles[it.id]
    if (t && i % 5 === 3 && t.w <= colW * 1.05) {
      t.cut = true
      t.z = 900 + i
    }
  })

  return { tiles, height: Math.round(Math.max(...bottoms, pad) + pad) }
}
