import React, { useState } from 'react'

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
const CONTACT_EMAIL = 'devenishmelissa@gmail.com'

export default function ReferralLanding({ username }) {
  const [view, setView] = useState('landing') // landing | how | terms | privacy
  const name = referrerName(username)
  const cta = username ? `${APP_URL}/?ref=${encodeURIComponent(username)}` : APP_URL

  if (view !== 'landing') {
    return <LegalPage view={view} onBack={() => setView('landing')} />
  }

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
            <button onClick={() => setView('how')} className="hover:text-stone-700">how it works</button>
            <span>·</span>
            <button onClick={() => setView('terms')} className="hover:text-stone-700">terms</button>
            <span>·</span>
            <button onClick={() => setView('privacy')} className="hover:text-stone-700">privacy</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const Label = ({ children }) => <span className="font-medium text-stone-900">{children}</span>

function LegalPage({ view, onBack }) {
  const TITLE = { how: 'How it works.', terms: 'Terms & conditions.', privacy: 'Privacy.' }[view]
  return (
    <div className="min-h-screen w-full bg-cream text-stone-900">
      <div className="mx-auto max-w-lg px-6 py-12">
        <button onClick={onBack} className="mb-8 flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">‹ Back</button>
        <h1 className="font-serif text-3xl md:text-4xl">{TITLE}</h1>

        {view === 'how' && (
          <div className="mt-8 space-y-8 text-sm leading-relaxed text-stone-600">
            <div>
              <p className="kicker text-stone-400 mb-3">For you (joining)</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Use the link a friend sent you — your 25% off is already applied.</li>
                <li>Create your account and pick your plan.</li>
                <li>Your discount comes off your first month automatically. No code to enter.</li>
              </ol>
            </div>
            <div>
              <p className="kicker text-stone-400 mb-3">For them (referring)</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Every member gets a personal link from their account.</li>
                <li>When someone subscribes through it, their friend gets 25% off.</li>
                <li>The referrer gets a $25 Visa gift card, emailed within 30 days of the subscription clearing its first billing cycle.</li>
              </ol>
            </div>
            <div>
              <p className="kicker text-stone-400 mb-3">The fine print in plain language</p>
              <p>Referral rewards are earned once the referred member completes their first paid month. Cancellations before that don&apos;t qualify. There&apos;s no cap — refer as many people as you want.</p>
            </div>
          </div>
        )}

        {view === 'terms' && (
          <div className="mt-8 space-y-5 text-sm leading-relaxed text-stone-600">
            <p><Label>Eligibility.</Label> The referral program is open to active A Girl in Glow members. Referred individuals must be new customers who haven&apos;t previously held a subscription.</p>
            <p><Label>The offer.</Label> New members receive 25% off their first month. Referring members receive a $25 Visa gift card per qualifying referral.</p>
            <p><Label>When a referral qualifies.</Label> A referral is valid when the referred person subscribes through the unique link and completes their first paid billing cycle. Rewards are issued within 30 days of qualification. Accounts that cancel, refund, or charge back before completing the first billing cycle do not qualify.</p>
            <p><Label>Rewards.</Label> Gift cards are sent by email to the address on file. They have no cash value, cannot be exchanged, and are subject to the card issuer&apos;s terms. Replacement isn&apos;t guaranteed if a card is lost or an incorrect email was provided.</p>
            <p><Label>Taxes.</Label> Referral rewards may be taxable income. Members who earn $600 or more in a calendar year may be required to provide tax information and will be issued a 1099-MISC.</p>
            <p><Label>Fair use.</Label> Self-referrals, duplicate or disposable email addresses, bulk distribution, paid advertising on our brand terms, and any attempt to game the program are prohibited. We may withhold rewards, void referrals, or close accounts for suspected abuse.</p>
            <p><Label>Changes.</Label> We may modify or end this program at any time. Referrals already qualified will be honored.</p>
          </div>
        )}

        {view === 'privacy' && (
          <div className="mt-8 space-y-5 text-sm leading-relaxed text-stone-600">
            <p><Label>What we collect here.</Label> When you use a referral link, we record the referring member&apos;s identifier and, if you sign up, your email and account details. If you enter your email to generate a referral link, we store that address to send your rewards.</p>
            <p><Label>What we do with it.</Label> We use this information to apply your discount, credit the correct referrer, send reward cards, and prevent fraud. That&apos;s it.</p>
            <p><Label>What we don&apos;t do.</Label> We don&apos;t sell your data. We don&apos;t share it with advertisers. Your referrer sees only that a referral converted — never your name, email, or anything in your planner.</p>
            <p><Label>Your planner is yours.</Label> Anything you track inside A Girl in Glow — your protocols, labs, cycle, notes — is private to your account, is never shared with referrers or partners, and is never used for advertising.</p>
            <p><Label>Your choices.</Label> You can export your data or delete your account at any time from settings. Deleting your account removes your personal data, though we retain limited transaction records where required by law.</p>
            <p><Label>Contact.</Label> Questions: <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-stone-900">{CONTACT_EMAIL}</a>.</p>
          </div>
        )}
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
