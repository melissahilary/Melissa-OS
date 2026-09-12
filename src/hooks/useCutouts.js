import { useEffect, useState } from 'react'
import { cutOut } from '../lib/cutout'

// ── The cut-outs, made quietly and only once.
//
// Reading a picture's background off costs a few tens of milliseconds, and a
// board asks for several. So they are made one at a time, in whatever idle the
// browser has, and the board shows rectangles until each one is ready — a
// picture lifting off the grid a moment after the page settles is a great deal
// better than a page that will not paint until every matte is cut.
//
// Nothing is stored. The result is pixels, and pixels do not belong in the row
// that holds her board; they are cheap enough to make again next time. The
// cache is the module, so switching away from the board and back does not
// redo the work.
const CACHE = new Map() // src -> object URL, or null for "this one keeps its rectangle"
const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 60))

export function useCutouts(wanted) {
  const [, bump] = useState(0)
  const key = wanted.map((w) => `${w.id}:${w.src}`).join('|')

  useEffect(() => {
    let live = true
    const queue = wanted.filter((w) => w.src && !CACHE.has(w.src))
    if (!queue.length) return undefined

    let handle = 0
    const next = (i) => {
      if (!live || i >= queue.length) return
      handle = idle(async () => {
        const { src } = queue[i]
        const url = await cutOut(src)
        if (!live) {
          if (url) URL.revokeObjectURL(url)
          return
        }
        CACHE.set(src, url)
        if (url) bump((n) => n + 1)
        next(i + 1)
      })
    }
    next(0)

    return () => {
      live = false
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle)
      else clearTimeout(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const out = {}
  wanted.forEach((w) => {
    const url = CACHE.get(w.src)
    if (url) out[w.id] = url
  })
  return out
}
