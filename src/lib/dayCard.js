// ── The day, as something she can keep or send. Drawn straight onto a canvas
// so it needs no library and no server: the same cream, the same serif, the
// day's lines and the day's quote, at a size that suits a phone screen.

const W = 1080
const H = 1350
const CREAM = '#FAF6ED'
const INK = '#1C1C1A'
const MUTED = '#8A837A'
const RULE = '#DDD7C8'

const SERIF = "'Bodoni Moda', Georgia, serif"
const SANS = "'JetBrains Mono', ui-monospace, monospace"

// Bottom left, Bodoni, 2.6% of the card's width.
function wordmark(ctx, w, h, margin) {
  const size = Math.round(w * 0.026)
  ctx.save()
  ctx.textAlign = 'left'
  ctx.fillStyle = MUTED
  ctx.font = `400 ${size}px ${SERIF}`
  ctx.letterSpacing = `${(size * 0.14).toFixed(1)}px`
  ctx.fillText('MEZZANINE', margin, h - margin * 0.52)
  ctx.letterSpacing = '0px'
  ctx.restore()
}

// Break text to a width, returning the lines.
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const out = []
  let line = ''
  words.forEach((w) => {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) {
      out.push(line)
      line = w
    } else {
      line = next
    }
  })
  if (line) out.push(line)
  return out
}

// entries: [{ label, values: [string] }] · quote: { text, who }
export async function drawDayCard({ dateLine, entries, quote }) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready } catch { /* draw with what we have */ }
  }
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')

  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, W, H)

  // a hairline frame, as on the printed page
  ctx.strokeStyle = RULE
  ctx.lineWidth = 2
  ctx.strokeRect(48, 48, W - 96, H - 96)

  const M = 120
  const maxW = W - M * 2
  let y = 190

  // the date, in small caps
  ctx.fillStyle = MUTED
  ctx.font = `500 26px ${SANS}`
  ctx.textAlign = 'center'
  ctx.letterSpacing = '6px'
  ctx.fillText(String(dateLine).toUpperCase(), W / 2, y)
  ctx.letterSpacing = '0px'
  y += 40

  ctx.strokeStyle = RULE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2 - 40, y)
  ctx.lineTo(W / 2 + 40, y)
  ctx.stroke()
  y += 78

  // what she wrote
  ctx.textAlign = 'left'
  entries.forEach(({ label, values }) => {
    if (!values || !values.length) return
    ctx.fillStyle = MUTED
    ctx.font = `italic 26px ${SERIF}`
    const labelLines = wrap(ctx, label, maxW)
    labelLines.forEach((l) => { ctx.fillText(l, M, y); y += 34 })
    y += 8

    ctx.fillStyle = INK
    ctx.font = `400 40px ${SERIF}`
    values.forEach((v) => {
      const vLines = wrap(ctx, v, maxW - 34)
      vLines.forEach((l, i) => {
        if (i === 0) {
          ctx.fillStyle = RULE
          ctx.fillRect(M, y - 28, 2, 34)
          ctx.fillStyle = INK
        }
        ctx.fillText(l, M + 26, y)
        y += 50
      })
    })
    y += 30
  })

  // the quote, closing the day
  if (quote && quote.text) {
    const qTop = Math.max(y + 40, H - 330)
    ctx.strokeStyle = RULE
    ctx.beginPath()
    ctx.moveTo(M, qTop - 60)
    ctx.lineTo(W - M, qTop - 60)
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = INK
    ctx.font = `italic 34px ${SERIF}`
    const qLines = wrap(ctx, `“${quote.text}”`, maxW - 40)
    let qy = qTop
    qLines.slice(0, 4).forEach((l) => { ctx.fillText(l, W / 2, qy); qy += 46 })

    ctx.fillStyle = MUTED
    ctx.font = `400 22px ${SANS}`
    ctx.letterSpacing = '4px'
    ctx.fillText(String(quote.who || '').toUpperCase(), W / 2, qy + 26)
    ctx.letterSpacing = '0px'
  }

  wordmark(ctx, W, H, M)

  return c
}

export async function saveDayCard(payload, filename = 'gratitude.png') {
  const canvas = await drawDayCard(payload)
  await new Promise((resolve) => {
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
