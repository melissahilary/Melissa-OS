import { createClient } from '@supabase/supabase-js'

// These are public, client-safe values (the publishable/anon key is meant to ship
// in the browser). Row-level security on the database is what keeps data private —
// every row is scoped to the signed-in user. Overridable via Vite env vars.
const DEFAULT_URL = 'https://rqtfmhenwmzbeowlqjli.supabase.co'
const DEFAULT_KEY = 'sb_publishable_TrmkazdspbLFXQcAz7Nx0w_HpJCJqnv'

const OPTIONS = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}

// An override is only worth using if it is actually a URL. A blank, malformed or
// still-a-placeholder value would make createClient throw while this module is
// being imported — which happens before React mounts, so nothing would render and
// the whole app would be a white page with no error anyone could catch. A bad
// setting should never be able to do that; it falls back to the known-good one.
const usableUrl = (raw) => {
  const v = typeof raw === 'string' ? raw.trim() : ''
  if (!v || v.includes('your-project')) return ''
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? v : ''
  } catch {
    return ''
  }
}
const usableKey = (raw) => {
  const v = typeof raw === 'string' ? raw.trim() : ''
  return v && !v.includes('xxxxxxxx') ? v : ''
}

const url = usableUrl(import.meta.env.VITE_SUPABASE_URL) || DEFAULT_URL
const key = usableKey(import.meta.env.VITE_SUPABASE_ANON_KEY) || DEFAULT_KEY

const build = (u, k) => createClient(u, k, OPTIONS)

let client
try {
  client = build(url, key)
} catch (e) {
  // Whatever was configured is unusable — say so in the console and carry on with
  // the defaults rather than taking the entire app down with it.
  // eslint-disable-next-line no-console
  console.error('[mos] Supabase config rejected; falling back to defaults', e)
  client = build(DEFAULT_URL, DEFAULT_KEY)
}

export const supabase = client
