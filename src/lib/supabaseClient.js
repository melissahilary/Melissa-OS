import { createClient } from '@supabase/supabase-js'

// These are public, client-safe values (the publishable/anon key is meant to ship
// in the browser). Row-level security on the database is what keeps data private —
// every row is scoped to the signed-in user. Overridable via Vite env vars.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rqtfmhenwmzbeowlqjli.supabase.co'
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TrmkazdspbLFXQcAz7Nx0w_HpJCJqnv'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
