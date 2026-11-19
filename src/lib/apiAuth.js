import { supabase } from './supabaseClient'

export async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data && data.session ? data.session.access_token : ''
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}
