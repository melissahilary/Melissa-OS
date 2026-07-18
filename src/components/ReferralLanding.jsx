import React from 'react'

// The public referral page shown at share.agirlinglow.com/<username> (and, for
// testing before the domain is wired up, at <app>/r/<username>). No auth — it's a
// pitch that opens for anyone with the link.

// Resolve a referrer's first name from their username. For now this is a small
// lookup; once the backend exists it will resolve any username to its owner.
const KNOWN_NAMES = { melissahilary: 'Melissa', melissa: 'Melissa' }
function referrerName(username) {
  if (!username) return ''
  return KNOWN_NAMES[username.toLowerCase()] || ''
}

// Where "claim your 25% off" sends people — the app, carrying the referral so it
// can be credited later.
const APP_URL = 'https://melissa-os.vercel.app'

export default function ReferralLanding({ username }) {
  const name = referrerName(username)
  const cta = username ? `${APP_URL}/?ref=${encodeURIComponent(username)}` : APP_URL

  return (
    <div className="min-h-screen w-full bg-cream text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
        {/* Hero image — intentionally blank for now. */}
        <div className="mb-10 aspect-[4/5] w-full border border-stone-200 bg-stone-100" aria-hidden="true" />

        <h1 className="font-serif text-4xl leading-[1.1] md:text-5xl">
          {name ? (
            <>
              {name} thinks you need this. <span className="italic">she&apos;s right.</span>
            </>
          ) : (
            <>someone who loves you sent this.</>
          )}
        </h1>

        <p className="mt-6 text-base leading-relaxed text-stone-600">
          Face masks, hair oiling, hormone panels, GHK-Cu, pilates, botox, therapy,
          date night. You&apos;re already doing all of it. This is how the girls keep up.
        </p>

        <a
          href={cta}
          className="mt-10 block w-full bg-stone-900 px-6 py-4 text-center text-base tracking-wide text-cream transition-colors hover:bg-stone-700"
        >
          claim your 25% off
        </a>
        <p className="mt-3 text-center text-sm text-stone-500">25% off your first month.</p>

        <div className="mt-auto pt-14">
          <div className="flex items-center justify-center gap-3 text-xs tracking-wide text-stone-400">
            <a href="#how" className="hover:text-stone-700">how it works</a>
            <span>·</span>
            <a href="#terms" className="hover:text-stone-700">terms</a>
            <span>·</span>
            <a href="#privacy" className="hover:text-stone-700">privacy</a>
          </div>
        </div>
      </div>
    </div>
  )
}

// Decide whether the current URL is a referral link, and for whom. Returns the
// username string, or null if this isn't a referral page.
export function referralUsername() {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname || ''
  const segs = window.location.pathname.split('/').filter(Boolean)
  // share.agirlinglow.com/<username>
  if (host.startsWith('share.')) return segs[0] || null
  // <app>/r/<username> — works anywhere, for testing before the domain is live.
  if (segs[0] === 'r') return segs[1] || null
  return null
}
