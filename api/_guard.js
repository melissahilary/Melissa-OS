import { createClient } from '@supabase/supabase-js'

// Publishable values already shipped in the client. The JWT is what proves
// the caller. A service role key is never used here.
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rqtfmhenwmzbeowlqjli.supabase.co'
const KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TrmkazdspbLFXQcAz7Nx0w_HpJCJqnv'

const LIMIT = 30
const WINDOW_MS = 60 * 1000
const hits = new Map()

function allow(userId) {
  const now = Date.now()
  const recent = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= LIMIT) {
    hits.set(userId, recent)
    return false
  }
  recent.push(now)
  hits.set(userId, recent)
  return true
}

export function modelName() {
  const name = process.env.ANTHROPIC_MODEL
  return typeof name === 'string' && name.trim() ? name.trim() : ''
}

export async function requireUser(req, res) {
  const header = req.headers.authorization || req.headers.Authorization || ''
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    res.status(401).json({ error: 'Sign in required' })
    return null
  }
  try {
    const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data || !data.user) {
      res.status(401).json({ error: 'Sign in required' })
      return null
    }
    if (!allow(data.user.id)) {
      res.status(429).json({ error: 'Slow down a moment, then try again.' })
      return null
    }
    return data.user
  } catch (e) {
    res.status(401).json({ error: 'Sign in required' })
    return null
  }
}
