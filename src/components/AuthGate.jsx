import React, { useEffect, useState } from 'react'
import { Mail, Check } from 'lucide-react'
import * as store from '../lib/dataStore'

const Cursive = ({ children, className = '' }) => (
  <span className={className} style={{ fontFamily: "'Pinyon Script', cursive" }}>
    {children}
  </span>
)

// Gates the whole app on a Supabase session. Shows a splash while resolving the
// session, a magic-link login when signed out, and the app once signed in.
export default function AuthGate({ children }) {
  const [st, setSt] = useState(store.getStatus())

  useEffect(() => {
    const unsub = store.subscribeStatus(setSt)
    store.init()
    return unsub
  }, [])

  if (st.phase === 'loading') return <Splash />
  if (st.phase === 'signed-out') return <Login />
  return children
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <Cursive className="text-4xl text-stone-400">Melissa's Digital Planner</Cursive>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError('')
    const { error } = await store.signIn(email.trim())
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  // CSS-only linen: warm off-white base, fine woven grain, subtle vertical threads.
  const linenBg = {
    backgroundColor: '#f6f1e6',
    backgroundImage: [
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
      'repeating-linear-gradient(90deg, rgba(150,120,70,0.06) 0px, rgba(150,120,70,0.06) 1px, transparent 1px, transparent 4px)',
      'repeating-linear-gradient(0deg, rgba(150,120,70,0.035) 0px, rgba(150,120,70,0.035) 1px, transparent 1px, transparent 5px)',
    ].join(', '),
  }

  // Warm white-gold light emanating from the card edge — layered glow, no hard line.
  const cardGlow = {
    boxShadow: [
      '0 0 2px 0 rgba(255,250,240,0.95)',
      '0 0 10px 1px rgba(255,248,231,0.9)',
      '0 0 28px 6px rgba(255,236,190,0.6)',
      '0 0 64px 16px rgba(255,240,205,0.35)',
      'inset 0 0 14px rgba(255,248,231,0.55)',
    ].join(', '),
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={linenBg}>
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Cursive className="text-5xl text-stone-900 leading-tight">Melissa's Digital Planner</Cursive>
        </div>

        {sent ? (
          <div className="rounded-2xl bg-white/60 px-6 py-8 text-center" style={cardGlow}>
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-cream">
              <Check size={18} />
            </div>
            <h2 className="font-serif italic text-2xl text-stone-900 mb-2">Check your email.</h2>
            <p className="text-sm leading-relaxed text-stone-500">
              We sent a sign-in link to <span className="text-stone-800">{email}</span>. Open it on this
              device to enter your planner.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-5 text-xs text-stone-400 hover:text-stone-900"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl bg-white/60 px-6 py-8" style={cardGlow}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className="mb-4 w-full bg-transparent border-b border-stone-300 pb-2 text-sm outline-none focus:border-stone-900"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-stone-900 px-4 py-2.5 text-sm text-cream hover:bg-stone-700 disabled:opacity-50"
            >
              <Mail size={15} />
              {busy ? 'Sending…' : 'Send me a magic link'}
            </button>
            {error && <p className="mt-3 text-xs text-phase-menstrual">{error}</p>}
            <p className="mt-4 text-xs leading-snug text-stone-400">
              No password. We email you a one-time link; click it and you're in. Your data is tied to
              your email and follows you to any device.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
