import { useEffect, useMemo, useState } from 'react'
import * as store from '../lib/dataStore'

// ── Signed links for private pictures.
//
// The bucket is private, so every photograph needs a signed URL and every
// signature expires. Asking once is enough to draw a page and not enough to
// keep it, and the ways it fails all look identical from the outside: a blank
// square where a picture ought to be, which reads as a picture that never
// saved.
//
// Three things go wrong, and all three are handled here:
//
//   - On a cold open the paths are known before the session is restored, so the
//     first request is signed by nobody and fails. Asking again when the auth
//     phase changes is what fixes that one.
//   - A request can simply fail. Keep asking, every twenty seconds, for as long
//     as anything is still unsigned.
//   - A page left open past eight hours holds signatures that have expired.
//     Re-sign the lot an hour before they do.
//
// The board learned this the hard way and the wishlist covers did not, which is
// how covers that were saved perfectly came to look like covers that never
// saved. One implementation now, so the two cannot drift again.

const SIGN_SECONDS = 28800
const REFRESH_MS = 7 * 60 * 60 * 1000
const RETRY_MS = 20000

export function useSignedUrls(paths) {
  const [urls, setUrls] = useState({})
  const [tick, setTick] = useState(0)

  // A stable key: the same set of paths in any order is the same work.
  const key = useMemo(() => [...new Set((paths || []).filter(Boolean))].sort().join(','), [paths])

  useEffect(() => {
    const unsub = store.subscribeStatus(() => setTick((n) => n + 1))
    const refresh = setInterval(() => { setUrls({}); setTick((n) => n + 1) }, REFRESH_MS)
    return () => { unsub(); clearInterval(refresh) }
  }, [])

  useEffect(() => {
    let alive = true
    const missing = key ? key.split(',').filter((p) => p && !urls[p]) : []
    if (!missing.length) return undefined
    // Only while something is still missing — a page that is fully signed sets
    // no timers at all.
    const retry = setTimeout(() => setTick((n) => n + 1), RETRY_MS)
    ;(async () => {
      const pairs = await Promise.all(missing.map(async (p) => [p, await store.signedPhotoUrl(p, SIGN_SECONDS)]))
      if (!alive) return
      const got = pairs.filter(([, url]) => url)
      // Writing an unchanged object back would re-run this effect and ask again
      // immediately, for ever. Nothing came back, so wait for the retry.
      if (!got.length) return
      setUrls((u) => { const next = { ...u }; got.forEach(([p, url]) => { next[p] = url }); return next })
    })()
    return () => { alive = false; clearTimeout(retry) }
  }, [key, tick, urls])

  return urls
}

export default useSignedUrls
