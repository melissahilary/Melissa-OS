// ── The list, as something she can send.
//
// A wishlist you cannot send is half a product. Women already screenshot Notes
// app lists and send them — badly formatted, no prices, no structure. This is
// that exact behaviour done properly, and it shares the gratitude day card's
// system on purpose: same cream, same serif, same letterspaced small caps, same
// hairlines, so the two exports read as one family wherever they land.

import { fmtMoney, classMeta } from './assetClasses'

const CREAM = '#FAF8F3'
const INK = '#1C1C1A'
const MUTED = '#8A837A'
const RULE = '#DDD7C8'

const SERIF = "'Cormorant Garamond', Georgia, serif"
const SANS = "'Inter', system-ui, sans-serif"

export const FORMATS = {
  story: { id: 'story', label: 'Story', w: 1080, h: 1920, perPage: 6 },
  feed: { id: 'feed', label: 'Feed', w: 1080, h: 1350, perPage: 8 },
}

export const paginate = (items, format) => {
  const n = FORMATS[format].perPage
  const pages = []
  for (let i = 0; i < items.length; i += n) pages.push(items.slice(i, i + n))
  return pages.length ? pages : [[]]
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const out = []
  let line = ''
  words.forEach((w) => {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) { out.push(line); line = w } else { line = next }
  })
  if (line) out.push(line)
  return out
}

const smallCaps = (ctx, text, x, y, size = 22, track = '6px', color = MUTED) => {
  ctx.fillStyle = color
  ctx.font = `500 ${size}px ${SANS}`
  ctx.letterSpacing = track
  ctx.fillText(String(text).toUpperCase(), x, y)
  ctx.letterSpacing = '0px'
}

// One page. `page` is 1-indexed; page one takes the full header, the rest a
// slimmer continuation so a card standing alone still says what it is.
export async function drawListCard({ listName, classId, items, page = 1, pages = 1, format = 'story', showPrices = true, showSizes = false, currency = 'USD', totalCount, totalSpend, images = {} }) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready } catch { /* draw with what we have */ }
  }
  const F = FORMATS[format] || FORMATS.story
  const c = document.createElement('canvas')
  c.width = F.w
  c.height = F.h
  const ctx = c.getContext('2d')

  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, F.w, F.h)
  ctx.strokeStyle = RULE
  ctx.lineWidth = 2
  ctx.strokeRect(48, 48, F.w - 96, F.h - 96)

  const M = 120
  const maxW = F.w - M * 2
  const cls = classMeta(classId)
  const first = page === 1

  let y = first ? (format === 'story' ? 300 : 220) : (format === 'story' ? 230 : 180)

  // Header: the list's name left, its class right, in small caps.
  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  ctx.font = `400 ${first ? 76 : 48}px ${SERIF}`
  ctx.fillText(listName || 'Untitled', M, y)
  ctx.textAlign = 'right'
  smallCaps(ctx, cls.label, F.w - M, y - (first ? 22 : 12), first ? 24 : 20, '8px')
  ctx.textAlign = 'left'
  y += first ? 56 : 40

  ctx.strokeStyle = RULE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(M, y)
  ctx.lineTo(F.w - M, y)
  ctx.stroke()
  y += first ? 92 : 76

  const withImages = Object.keys(images).length > 0
  const rowGap = format === 'story' ? 56 : 44
  const thumb = 128

  items.forEach((it) => {
    const rowTop = y
    let textX = M
    if (withImages && images[it.id]) {
      const img = images[it.id]
      ctx.save()
      ctx.beginPath()
      ctx.rect(M, rowTop - thumb * 0.62, thumb, thumb)
      ctx.clip()
      const ar = img.width / img.height
      const dw = ar > 1 ? thumb * ar : thumb
      const dh = ar > 1 ? thumb : thumb / ar
      ctx.drawImage(img, M - (dw - thumb) / 2, rowTop - thumb * 0.62 - (dh - thumb) / 2, dw, dh)
      ctx.restore()
      textX = M + thumb + 28
    }

    const priceStr = showPrices ? fmtMoney(it.price, currency) : ''
    ctx.font = `400 46px ${SERIF}`
    const priceW = priceStr ? ctx.measureText(priceStr).width : 0

    // The brand carries the line; the description sits under it, quieter.
    const brand = (it.brand || '').trim()
    const name = (it.title || '').trim()
    const headline = brand || name
    const under = brand ? name : ''

    ctx.fillStyle = INK
    ctx.font = `400 46px ${SERIF}`
    const headLines = wrap(ctx, headline, F.w - M - textX - priceW - 40)
    headLines.slice(0, 2).forEach((l, i) => { ctx.fillText(l, textX, y + i * 52) })

    if (priceStr) {
      ctx.textAlign = 'right'
      ctx.fillStyle = INK
      ctx.font = `400 46px ${SERIF}`
      ctx.fillText(priceStr, F.w - M, y)
      ctx.textAlign = 'left'
    }
    y += headLines.slice(0, 2).length * 52

    const sub = [under, showSizes && it.size ? it.size : ''].filter(Boolean).join(', ')
    if (sub) {
      ctx.fillStyle = MUTED
      ctx.font = `italic 32px ${SERIF}`
      const subLines = wrap(ctx, sub, F.w - M - textX - 40)
      subLines.slice(0, 1).forEach((l) => { ctx.fillText(l, textX, y + 8) })
      y += 40
    }

    y = Math.max(y, rowTop + (withImages && images[it.id] ? thumb * 0.5 : 0)) + rowGap
  })

  // The footer: what the list amounts to, and where you are in it.
  const footY = F.h - 150
  ctx.strokeStyle = RULE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(M, footY - 46)
  ctx.lineTo(F.w - M, footY - 46)
  ctx.stroke()

  const countStr = `${totalCount} ${totalCount === 1 ? 'piece' : 'pieces'}`
  const totalStr = showPrices && totalSpend != null ? ` · ${fmtMoney(totalSpend, currency)}` : ''
  smallCaps(ctx, countStr + totalStr, M, footY, 24, '4px')

  if (pages > 1) {
    ctx.textAlign = 'right'
    smallCaps(ctx, `${page}/${pages}`, F.w - M, footY, 24, '4px')
    ctx.textAlign = 'left'
  }

  return c
}

// Preload the product thumbnails so the canvas can draw them synchronously.
export async function loadImages(items) {
  const out = {}
  await Promise.all(items.filter((it) => it.image).map((it) => new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { out[it.id] = img; resolve() }
    img.onerror = () => resolve()
    img.src = it.image
  })))
  return out
}

export async function renderPages(opts) {
  const { items, format } = opts
  const pages = paginate(items, format)
  const images = opts.withImages ? await loadImages(items) : {}
  const canvases = []
  for (let i = 0; i < pages.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const canvas = await drawListCard({ ...opts, items: pages[i], page: i + 1, pages: pages.length, images })
    canvases.push(canvas)
  }
  return canvases
}

export function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      resolve()
    }, 'image/png')
  })
}

// ── The text version — the utility one, for WhatsApp and iMessage.
// Never paginated: one block you paste and send.
export function asText({ listName, classId, items, showPrices = true, showLinks = true, showSizes = false, currency = 'USD' }) {
  const cls = classMeta(classId)
  const L = [`${listName || 'Untitled'} — ${cls.label}`, '']
  let total = 0
  items.forEach((it) => {
    const bits = [it.brand, it.title].filter(Boolean).join(' ') || 'Untitled'
    const size = showSizes && it.size ? ` (${it.size})` : ''
    const price = showPrices && it.price ? ` — ${fmtMoney(it.price, currency)}` : ''
    L.push(`${bits}${size}${price}`)
    if (showLinks && it.url) L.push(`  ${it.url}`)
    const n = parseFloat(String(it.price).replace(/[^\d.]/g, ''))
    if (Number.isFinite(n)) total += n
  })
  L.push('')
  L.push(`${items.length} ${items.length === 1 ? 'piece' : 'pieces'}${showPrices && total ? ` · ${fmtMoney(total, currency)}` : ''}`)
  return L.join('\n')
}
