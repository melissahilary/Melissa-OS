import { BUNDLE_ID } from './brand'

// Where a magic link should return. The browser comes back to this origin.
// The installed app comes back through its own URL scheme.
export function redirectTo() {
  try {
    const cap = typeof window !== 'undefined' ? window.Capacitor : null
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      return `${BUNDLE_ID}://auth`
    }
  } catch {
    /* stay on the web origin */
  }
  return typeof window !== 'undefined' ? window.location.origin : ''
}

// Hand a returning magic link to the caller. The link may carry a PKCE code
// or a hash session, depending on how the mail was opened.
export function sessionFromUrl(url) {
  if (!url) return null
  const hash = url.includes('#') ? url.split('#').slice(1).join('#') : ''
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
  const q = new URLSearchParams(query)
  const h = new URLSearchParams(hash)
  const code = q.get('code')
  const access_token = h.get('access_token') || q.get('access_token')
  const refresh_token = h.get('refresh_token') || q.get('refresh_token')
  if (code) return { type: 'code', code }
  if (access_token && refresh_token) return { type: 'session', access_token, refresh_token }
  return null
}

export async function listenForAuthLinks(onUrl) {
  try {
    const cap = typeof window !== 'undefined' ? window.Capacitor : null
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return
    const { App } = await import('@capacitor/app')
    App.addListener('appUrlOpen', (event) => {
      if (event && event.url) onUrl(event.url)
    })
  } catch {
    /* the native plugin is absent in the browser */
  }
}
