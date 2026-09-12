// ── The board, composed as a mosaic.
//
// The reference is an editorial collage: blocks of picture packed flush into a
// page, cream showing only at the seams and the margin, nothing tilted, nothing
// taped, no white borders and no shadows. A few pictures are cut out of their
// backgrounds altogether and sit over the grid, which is the only thing on the
// page allowed to break the rectangle.
//
// So the arrangement is a pattern that repeats rather than a scatter. Twelve
// columns; a block of eight slots of varied span that tiles a square exactly;
// two such blocks, alternating, so the repeat is felt rather than counted. Past
// the last whole block a tail pattern of the right size finishes the page, so a
// board of three pictures is a composition and not three blocks marooned in a
// square of nothing.
//
// Slots are filled by shape, not by order: within a block the widest picture
// goes to the widest slot. Everything is cropped to its slot, which is what
// packs the page — so the crop may as well be the one that loses least.

const COLS = 12

// The two repeating blocks. Each is [col, row, colSpan, rowSpan] on the grid,
// in reading order, and each tiles its rectangle exactly — no gaps, no overlaps.
const BLOCKS = [
  { rows: 12, slots: [[0, 0, 4, 5], [4, 0, 5, 3], [9, 0, 3, 6], [4, 3, 5, 4], [0, 5, 4, 4], [9, 6, 3, 6], [4, 7, 5, 5], [0, 9, 4, 3]] },
  { rows: 12, slots: [[0, 0, 5, 4], [5, 0, 3, 6], [8, 0, 4, 3], [8, 3, 4, 5], [0, 4, 5, 5], [5, 6, 3, 6], [8, 8, 4, 4], [0, 9, 5, 3]] },
]

// What finishes the page when fewer than eight are left.
const TAILS = {
  1: { rows: 8, slots: [[0, 0, 12, 8]] },
  2: { rows: 7, slots: [[0, 0, 6, 7], [6, 0, 6, 7]] },
  3: { rows: 8, slots: [[0, 0, 5, 8], [5, 0, 7, 4], [5, 4, 7, 4]] },
  4: { rows: 10, slots: [[0, 0, 7, 5], [7, 0, 5, 5], [0, 5, 5, 5], [5, 5, 7, 5]] },
  5: { rows: 11, slots: [[0, 0, 4, 6], [4, 0, 8, 6], [0, 6, 5, 5], [5, 6, 3, 5], [8, 6, 4, 5]] },
  6: { rows: 11, slots: [[0, 0, 5, 5], [5, 0, 4, 5], [9, 0, 3, 5], [0, 5, 4, 6], [4, 5, 4, 6], [8, 5, 4, 6]] },
  7: { rows: 11, slots: [[0, 0, 4, 5], [4, 0, 5, 5], [9, 0, 3, 5], [0, 5, 3, 6], [3, 5, 5, 6], [8, 5, 4, 3], [8, 8, 4, 3]] },
}

// Widest picture to widest slot. Sorting both by shape and pairing them off is
// the whole of it — it costs nothing and it is the difference between a face
// cropped to a band and a face that fits its block.
function byShape(group, slots) {
  const ss = slots.map((s, i) => ({ i, a: s[2] / s[3] })).sort((x, y) => x.a - y.a)
  const gg = group.map((it, i) => ({ i, a: (it.w || 4) / (it.h || 3) })).sort((x, y) => x.a - y.a)
  return ss.map((s, k) => ({ it: group[gg[k].i], slot: slots[s.i] }))
}

// Returns the tiles by id — position and size in canvas pixels — and the height
// the whole page comes to.
export function mosaic(items, canvasW, opts = {}) {
  const pad = opts.pad == null ? 24 : opts.pad
  const gut = opts.gutter == null ? 6 : opts.gutter
  const col = (canvasW - pad * 2) / COLS
  const tiles = {}
  let y0 = pad
  let at = 0
  let block = 0

  while (at < items.length) {
    const left = items.length - at
    const pat = left >= 8 ? BLOCKS[block % BLOCKS.length] : TAILS[left]
    const group = items.slice(at, at + pat.slots.length)
    byShape(group, pat.slots).forEach(({ it, slot }) => {
      tiles[it.id] = {
        x: Math.round(pad + slot[0] * col + gut / 2),
        y: Math.round(y0 + slot[1] * col + gut / 2),
        w: Math.round(slot[2] * col - gut),
        h: Math.round(slot[3] * col - gut),
        cut: false,
        z: 1,
      }
    })
    y0 += pat.rows * col
    at += pat.slots.length
    block += 1
  }

  // Which ones lift off the grid. A rhythm rather than a judgement — the
  // picture itself gets the final say, because a cut only happens if the
  // background actually comes away. Never the big blocks: a large picture
  // grown another quarter swallows the page instead of sitting on it.
  items.forEach((it, i) => {
    const t = tiles[it.id]
    if (t && i % 5 === 3 && t.w <= col * 4.5) {
      t.cut = true
      t.z = 10 + i
    }
  })

  return { tiles, height: Math.round(y0 + pad) }
}
