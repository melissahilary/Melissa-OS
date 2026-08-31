// Vercel serverless function: turn a pasted URL into a product card.
//
// A wishlist of raw URLs is the worst thing in the section — a column of blue
// strings you cannot read, cannot price, and cannot recognise. Resolving one
// needs a fetch the browser is not allowed to make cross-origin, so it happens
// here: fetch the page, read the Open Graph tags the whole web already publishes
// for exactly this purpose, and hand back image, title, price and site.
//
// Deliberately narrow. It reads meta tags; it does not crawl, execute scripts,
// or follow anything but the URL it was given. On any failure it returns what it
// knows — usually just the hostname — so the client always has something to show.

export const maxDuration = 15

const MAX_BYTES = 512 * 1024 // meta tags live in <head>; a page's body is not our business

const pick = (html, patterns) => {
  for (const re of patterns) {
    const m = html.match(re)
    if (m && m[1] && m[1].trim()) return decode(m[1].trim())
  }
  return ''
}

const decode = (s) => s
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#0?39;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ')

// og: and twitter: in both attribute orders, since plenty of sites emit either.
const metaOf = (prop) => [
  new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
  new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'),
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const raw = (req.body && req.body.url) || ''
  let target
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return res.status(400).json({ error: 'Not a URL' })
  }
  // Only the public web. No internal addresses, no other schemes.
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return res.status(400).json({ error: 'Not a URL' })
  }
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(target.hostname)) {
    return res.status(400).json({ error: 'Not a URL' })
  }

  const fallback = {
    url: target.href,
    site: target.hostname.replace(/^www\./, ''),
    title: '',
    image: '',
    price: '',
    currency: '',
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const r = await fetch(target.href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Plenty of shops serve a stub to unknown agents; a browser UA gets the
        // same markup a person would see.
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timer)
    if (!r.ok) return res.status(200).json(fallback)

    const type = r.headers.get('content-type') || ''
    if (!/text\/html|application\/xhtml/i.test(type)) return res.status(200).json(fallback)

    // Read only the head-sized prefix rather than a whole product page.
    const reader = r.body.getReader()
    const chunks = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
      if (size >= MAX_BYTES) { try { await reader.cancel() } catch { /* already closed */ } break }
    }
    const buf = new Uint8Array(size)
    let at = 0
    chunks.forEach((c) => { buf.set(c, at); at += c.length })
    const html = new TextDecoder('utf-8').decode(buf)

    const title = pick(html, [...metaOf('og:title'), ...metaOf('twitter:title'), /<title[^>]*>([^<]+)<\/title>/i])
    let image = pick(html, [...metaOf('og:image:secure_url'), ...metaOf('og:image'), ...metaOf('twitter:image')])
    const price = pick(html, [...metaOf('product:price:amount'), ...metaOf('og:price:amount'), /itemprop=["']price["'][^>]*content=["']([^"']+)["']/i])
    const currency = pick(html, [...metaOf('product:price:currency'), ...metaOf('og:price:currency')])
    const site = pick(html, metaOf('og:site_name')) || fallback.site

    // A protocol-relative or root-relative image is still a real image.
    if (image) {
      try { image = new URL(image, target.href).href } catch { image = '' }
    }

    return res.status(200).json({
      url: target.href,
      site,
      title: title.slice(0, 180),
      image,
      price: price.replace(/[^\d.,]/g, '').slice(0, 20),
      currency: currency.slice(0, 8),
    })
  } catch {
    return res.status(200).json(fallback)
  }
}
