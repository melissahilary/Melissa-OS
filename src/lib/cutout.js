// ── Cutting a picture out of its background.
//
// The collage wants a few pictures with no rectangle around them — a shell, a
// hand, a bottle sitting straight on the paper. That only works on a photograph
// taken against something plain, which in practice means everything shot for a
// shop and nothing shot in a room. So this does not try to be clever. It reads
// the border of the picture, and if the border is one colour it floods inward
// from all four edges taking every pixel close enough to it.
//
// The important part is knowing when to refuse. A photograph of a kitchen has a
// busy border and is left alone; a flood that eats almost nothing, or almost
// everything, is thrown away rather than shown. A picture that cannot be cut
// stays a rectangle, which is a perfectly good thing for it to be.

// How far a pixel may stray from the border colour, summed across the channels.
const TOL = 100
// Below this the flood found nothing; above it, the subject went with it.
const MIN_CUT = 0.08
const MAX_CUT = 0.86
// How much the border may vary before it stops being a backdrop and starts
// being a scene.
const MAX_SPREAD = 46

// Fetched rather than assigned to an Image, so a picture the bucket will not
// share fails here — cleanly, with a cut-out that never appears — instead of
// tainting a canvas and throwing on read.
async function bitmap(src, maxPx) {
  const res = await fetch(src, { mode: 'cors' })
  if (!res.ok) throw new Error('unreachable')
  const blob = await res.blob()
  const first = await createImageBitmap(blob)
  const scale = Math.min(1, maxPx / Math.max(first.width, first.height))
  if (scale === 1) return first
  const out = await createImageBitmap(blob, {
    resizeWidth: Math.round(first.width * scale),
    resizeHeight: Math.round(first.height * scale),
    resizeQuality: 'high',
  })
  first.close()
  return out
}

// Returns an object URL for a transparent PNG, or null if this picture should
// keep its rectangle.
export async function cutOut(src, maxPx = 760) {
  if (!src || src.startsWith('blob:')) return null
  try {
    const bmp = await bitmap(src, maxPx)
    const W = bmp.width
    const H = bmp.height
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bmp, 0, 0)
    bmp.close()

    const img = ctx.getImageData(0, 0, W, H)
    const d = img.data

    // The border, as one colour and as a measure of how much it wavers.
    const edge = []
    for (let x = 0; x < W; x += 1) { edge.push(x); edge.push((H - 1) * W + x) }
    for (let y = 0; y < H; y += 1) { edge.push(y * W); edge.push(y * W + W - 1) }
    let r = 0
    let g = 0
    let b = 0
    edge.forEach((p) => { r += d[p * 4]; g += d[p * 4 + 1]; b += d[p * 4 + 2] })
    r /= edge.length
    g /= edge.length
    b /= edge.length
    let spread = 0
    edge.forEach((p) => {
      spread += Math.abs(d[p * 4] - r) + Math.abs(d[p * 4 + 1] - g) + Math.abs(d[p * 4 + 2] - b)
    })
    if (spread / edge.length > MAX_SPREAD) return null

    // Flood inward from every edge pixel that still looks like the backdrop.
    const seen = new Uint8Array(W * H)
    const stack = []
    const push = (p) => {
      if (seen[p]) return
      const i = p * 4
      if (Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b) > TOL) return
      seen[p] = 1
      stack.push(p)
    }
    edge.forEach(push)
    let cut = 0
    while (stack.length) {
      const p = stack.pop()
      cut += 1
      const x = p % W
      const y = (p / W) | 0
      if (x > 0) push(p - 1)
      if (x < W - 1) push(p + 1)
      if (y > 0) push(p - W)
      if (y < H - 1) push(p + W)
    }

    const frac = cut / (W * H)
    if (frac < MIN_CUT || frac > MAX_CUT) return null

    for (let p = 0; p < W * H; p += 1) if (seen[p]) d[p * 4 + 3] = 0
    // One row of half-lit pixels along the cut, so the edge is a soft one
    // rather than the staircase a hard threshold leaves behind.
    const rim = []
    for (let y = 1; y < H - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const p = y * W + x
        if (seen[p]) continue
        if (seen[p - 1] || seen[p + 1] || seen[p - W] || seen[p + W]) rim.push(p)
      }
    }
    rim.forEach((p) => { d[p * 4 + 3] = 122 })
    ctx.putImageData(img, 0, 0)

    return await new Promise((done) => {
      c.toBlob((out) => done(out ? URL.createObjectURL(out) : null), 'image/png')
    })
  } catch {
    return null
  }
}
