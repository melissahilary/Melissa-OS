// ── Making a cover, without locking up her phone.
//
// The board's processImage does three things a cover has no use for: it decodes
// the photograph at full size into an <img>, computes a perceptual hash of it,
// and encodes a second 640px JPEG for the reader to look at. On a desktop all of
// that is invisible. On a phone it is a twelve-megapixel photograph pushed
// through three canvases and two JPEG encodes, every one of them on the main
// thread — which is a screen frozen for several seconds, and a second cover that
// could not be started until the page was reloaded.
//
// A cover needs exactly one thing: a small JPEG. createImageBitmap decodes and
// hands back an already-decoded image without blocking the page, so there is one
// canvas and one encode left. Where it isn't available we fall back to the <img>
// route — which also revokes its object URL when the decode fails, where the old
// path leaked it.

async function viaBitmap(file, maxPx) {
  if (typeof createImageBitmap !== 'function') return null
  let bmp = null
  try {
    bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(bmp.width * scale))
    c.height = Math.max(1, Math.round(bmp.height * scale))
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((res) => { if (c.toBlob) c.toBlob(res, 'image/jpeg', 0.82); else res(null) })
    return { blob, dataUrl: blob ? '' : c.toDataURL('image/jpeg', 0.82) }
  } catch {
    return null
  } finally {
    if (bmp && bmp.close) bmp.close()
  }
}

function viaImage(file, maxPx) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    const finish = (out) => { URL.revokeObjectURL(url); resolve(out) }
    img.onload = () => {
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * scale))
        c.height = Math.max(1, Math.round(img.height * scale))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        if (c.toBlob) c.toBlob((blob) => finish({ blob, dataUrl: blob ? '' : c.toDataURL('image/jpeg', 0.82) }), 'image/jpeg', 0.82)
        else finish({ blob: null, dataUrl: c.toDataURL('image/jpeg', 0.82) })
      } catch { finish(null) }
    }
    img.onerror = () => finish(null)
    img.src = url
  })
}

// Resolves to { blob, dataUrl } or null when the browser cannot read the file —
// most often an iPhone HEIC opened somewhere that has no decoder for it.
export async function coverImage(file, maxPx = 900) {
  return (await viaBitmap(file, maxPx)) || viaImage(file, maxPx)
}

// When the upload cannot land — offline, or signed out — the cover has to be
// held somewhere or it reads as a cover that never saved. This is the already
// downscaled JPEG turned into base64, so it costs a read and not a second
// encode. Only ever used as a fallback: a data URL in the state row is bytes
// that load on every sign-in, and the bucket is where pictures belong.
export function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    if (!blob) { resolve(''); return }
    try {
      const r = new FileReader()
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : '')
      r.onerror = () => resolve('')
      r.readAsDataURL(blob)
    } catch { resolve('') }
  })
}

export default coverImage
