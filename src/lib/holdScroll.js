// ── The page stays where she left it.
//
// A sheet that opens over the page must not move the page underneath it. On a
// phone it always did: the field inside takes focus, the keyboard arrives, and
// the browser scrolls the document to bring the field into view. The sheet is
// fixed so it looks fine — and then she closes it and she is a screen and a
// half further down, with nothing to tell her how she got there.
//
// Rather than ask each of the four dozen sheets in this app to remember this,
// and every sheet written after today, the page watches for one itself:
// anything fixed, filling the viewport, standing at the layer sheets stand at.
// While one is up the body is pinned at exactly the offset it was at, and when
// the last one goes the page is put back there.

const LAYER = 50 // the z-index a sheet stands at; anything lower is page furniture

let held = false
let at = 0

function sheetsUp() {
  const all = document.querySelectorAll('.fixed.inset-0')
  let n = 0
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i]
    const cs = getComputedStyle(el)
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue
    // A scrim that is mounted all the time and faded out is not a sheet —
    // and neither is one that lets the page be touched straight through it.
    if (cs.opacity === '0' || parseFloat(cs.opacity) === 0) continue
    if (cs.pointerEvents === 'none') continue
    if ((parseInt(cs.zIndex, 10) || 0) < LAYER) continue
    n += 1
  }
  return n
}

function pin() {
  at = window.scrollY || document.documentElement.scrollTop || 0
  const b = document.body
  // Taking the scrollbar away on a desk shifts the whole page sideways, so
  // its width is handed back as padding.
  const bar = window.innerWidth - document.documentElement.clientWidth
  b.style.position = 'fixed'
  b.style.top = `-${at}px`
  b.style.left = '0'
  b.style.right = '0'
  b.style.width = '100%'
  b.style.overflow = 'hidden'
  if (bar > 0) b.style.paddingRight = `${bar}px`
}

function release() {
  const b = document.body
  // Send the keyboard on its way while the page is still pinned. A keyboard
  // being dismissed scrolls the page itself on the way out, and if it is
  // still going when the page is unpinned, its scroll is the one that lands.
  const el = document.activeElement
  if (el && el.blur && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.blur()

  b.style.position = ''
  b.style.top = ''
  b.style.left = ''
  b.style.right = ''
  b.style.width = ''
  b.style.overflow = ''
  b.style.paddingRight = ''
  // The document has been the height of the viewport while it was pinned, so
  // asking for the old offset before it has grown back lands her wherever the
  // short page happened to end. Read a layout property to make it grow first.
  void document.body.offsetHeight

  // Then hold the line for as long as the keyboard takes to go — about half a
  // second on a phone — because every one of those frames is a chance for
  // something else to decide where she should be looking. The moment she
  // touches the page herself, it is hers again and we stop.
  const back = () => window.scrollTo(0, at)
  back()
  requestAnimationFrame(back)
  const timers = [60, 150, 260, 380, 520].map((ms) => setTimeout(back, ms))
  const hers = () => {
    timers.forEach(clearTimeout)
    window.removeEventListener('touchstart', hers)
    window.removeEventListener('wheel', hers)
    window.removeEventListener('keydown', hers)
  }
  window.addEventListener('touchstart', hers, { passive: true, once: true })
  window.addEventListener('wheel', hers, { passive: true, once: true })
  window.addEventListener('keydown', hers, { once: true })
  setTimeout(hers, 600)
}

// ── Room for the keyboard.
//
// A sheet is fixed to the window, and the window does not get any shorter
// when the keyboard comes up — on a phone it simply stands in front of the
// bottom third of it, over the field she opened the sheet to type into. The
// page cannot be scrolled out of the way either, because the page is pinned.
//
// The visual viewport knows exactly how much is covered. It is published as
// a length on the root, and every sheet keeps that much clear at its foot,
// so the field rises above the keys rather than hiding behind them. One
// reading, every sheet, both phones.
function watchKeyboard() {
  const vv = window.visualViewport
  if (!vv) return
  const set = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    // Under a dozen pixels is a toolbar settling, not a keyboard.
    document.documentElement.style.setProperty('--mos-kb', `${kb > 12 ? kb : 0}px`)
    // A sheet that is taller than what is left of the window scrolls inside
    // itself, and the field she is in can end up above its own fold once the
    // keys have taken a third of the screen. Bring it back — within the
    // sheet, never by moving the page, which is pinned.
    const el = document.activeElement
    if (kb > 12 && el && el.scrollIntoView && /^(INPUT|TEXTAREA)$/.test(el.tagName)) {
      requestAnimationFrame(() => { try { el.scrollIntoView({ block: 'nearest' }) } catch { /* older engine */ } })
    }
  }
  set()
  vv.addEventListener('resize', set)
  vv.addEventListener('scroll', set)
}


// ── A press on a sheet must not first put the field down ───────────
//
// On a phone, pressing Add blurs the field she was typing in. The keyboard
// starts to leave, the sheet grows back under her thumb, and by the time the
// press completes the button is not where she aimed any more — so she gets
// nothing, or worse, the backdrop behind it, and the line she wrote is gone.
//
// Preventing the default on the way down keeps the field focused, the
// keyboard up and the sheet still, so the press lands where she put it. It is
// global for the same reason the pinning is: every sheet needs it, and a new
// one should not have to remember.
function holdPress() {
  document.addEventListener('mousedown', (e) => {
    const field = document.activeElement
    if (!field || !/^(INPUT|TEXTAREA)$/.test(field.tagName)) return
    const t = e.target
    if (!t || !t.closest) return
    const btn = t.closest('button')
    if (!btn || !btn.closest('.fixed.inset-0')) return
    e.preventDefault()
  }, true)
}

export default function holdScroll() {
  if (typeof document === 'undefined' || !document.body) return
  if (document.body.dataset.mosHolding) return
  document.body.dataset.mosHolding = '1'
  watchKeyboard()
  holdPress()

  let raf = 0
  const look = () => {
    raf = 0
    const n = sheetsUp()
    if (n > 0 && !held) { held = true; pin() }
    else if (n === 0 && held) { held = false; release() }
  }
  // Coalesced into a frame: a sheet that animates in would otherwise be
  // counted a dozen times on the way.
  const soon = () => { if (!raf) raf = requestAnimationFrame(look) }

  const mo = new MutationObserver(soon)
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
  soon()
}
