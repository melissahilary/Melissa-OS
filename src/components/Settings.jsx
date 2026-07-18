import React, { useEffect, useRef, useState } from 'react'
import { Copy, Check, LogOut, Upload, Trash2, Mail, X } from 'lucide-react'
import * as store from '../lib/dataStore'
import { useLocalStorage } from '../hooks/useLocalStorage'
import SectionTitle from './shared/SectionTitle'
import LocationField from './shared/LocationField'
import { SIGNS } from '../lib/astrology/natal'

// Pillars that can be hidden/shown (data is kept either way).
const SECTIONS = [
  { id: 'mindset', label: 'Mindset' },
  { id: 'skincare', label: 'Skincare' },
  { id: 'haircare', label: 'Haircare' },
  { id: 'aesthetics', label: 'Aesthetics' },
  { id: 'bodycare', label: 'Bodycare' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'menu', label: 'Nutrition' },
  { id: 'workout', label: 'Hormones' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'relationship', label: 'Relationships' },
  { id: 'spirituality', label: 'Spirituality' },
]

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'profile', label: 'Profile' },
  { id: 'plan', label: 'Plan & Subscription' },
  { id: 'notification', label: 'Notification' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'contact', label: 'Contact us' },
]

const NOTIFS = [
  { id: 'daily', label: 'Daily planner summary', hint: 'A morning note with today’s schedule and rituals.' },
  { id: 'cycle', label: 'Cycle reminders', hint: 'A heads-up before your period and around ovulation.' },
  { id: 'horoscope', label: 'Daily horoscope', hint: 'Your reading, ready each morning.' },
  { id: 'rituals', label: 'Ritual nudges', hint: 'Gentle reminders for scheduled skincare, haircare and more.' },
]

const TZ_LIST = (() => {
  try { return Intl.supportedValuesOf('timeZone') } catch { return ['America/Los_Angeles', 'America/New_York', 'America/Chicago', 'America/Denver', 'Europe/London', 'UTC'] }
})()

// ── file helpers ────────────────────────────────────────────────────
function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n')

// Downscale an uploaded photo to a small square-ish data URL.
function resizePhoto(file, max, cb) {
  const img = new Image()
  img.onload = () => {
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    cb(c.toDataURL('image/jpeg', 0.85))
    URL.revokeObjectURL(img.src)
  }
  img.src = URL.createObjectURL(file)
}

const H2 = ({ children }) => <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-4">{children}</h2>
const Field = ({ label, children }) => (
  <div>
    <label className="kicker text-stone-400 mb-1.5 block">{label}</label>
    {children}
  </div>
)
const input = 'w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900'

export default function Settings() {
  const [tab, setTab] = useState('general')
  const [st, setSt] = useState(store.getStatus())
  useEffect(() => store.subscribeStatus(setSt), [])

  const [profile, setProfile] = useLocalStorage('mos:profile', { name: '', photo: '', timezone: '', birthday: '', birthTime: '', birthPlace: '' })
  const p = profile && typeof profile === 'object' ? profile : {}
  const setP = (patch) => setProfile((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), ...patch }))
  const [location, setLocation] = useLocalStorage('mos:settings:location', 'Alameda')
  const [hidden, setHidden] = useLocalStorage('mos:settings:hidden', [])
  const hiddenArr = Array.isArray(hidden) ? hidden : []
  const [cycle, setCycle] = useLocalStorage('mos:settings:cycle', { lastPeriodStart: '', cycleLength: 28 })
  const setCfg = (patch) => setCycle((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), ...patch }))
  const [signs, setSigns] = useLocalStorage('mos:astro:signs', { sun: 'Libra', moon: 'Taurus', rising: 'Libra' })
  const sg = signs && typeof signs === 'object' ? signs : {}
  const [notifs, setNotifs] = useLocalStorage('mos:settings:notifs', { daily: true, cycle: true, horoscope: true, rituals: false })
  const nf = notifs && typeof notifs === 'object' ? notifs : {}
  const toggleNotif = (id) => setNotifs((prev) => { const cur = prev && typeof prev === 'object' ? prev : {}; return { ...cur, [id]: !cur[id] } })

  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [cropSrc, setCropSrc] = useState(null)
  const [cropInit, setCropInit] = useState(null)
  const photoRef = useRef(null)

  // Personal referral link, keyed to the account's username.
  const refUser = (p.username || 'melissa hilary').trim().replace(/\s+/g, '')
  const link = `https://share.agirlinglow.com/${refUser}`

  const changeEmail = async () => {
    const e = email.trim()
    if (!e) return
    setMsg('')
    try {
      const { error } = await store.updateEmail(e)
      setMsg(error ? `Couldn't update: ${error.message}` : 'Check the new inbox to confirm the change.')
      if (!error) setEmail('')
    } catch { setMsg("Couldn't update right now.") }
  }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }
  // Uploading opens the cropper on a downscaled copy of the original; Editing
  // reopens the original with the last crop so you can re-position it.
  const onPickFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) resizePhoto(file, 1024, (data) => { setCropSrc(data); setCropInit(null) })
    e.target.value = ''
  }
  const editPhoto = () => { const s = p.photoOriginal || p.photo; if (s) { setCropSrc(s); setCropInit(p.photoTransform || null) } }
  const onCropSave = (data, transform) => { setP({ photo: data, photoOriginal: cropSrc, photoTransform: transform }); setCropSrc(null) }
  const toggleHidden = (id) => setHidden((prev) => {
    const arr = Array.isArray(prev) ? prev : []
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
  })

  // ── exports ──
  const exportAll = () => download('melissa-os-backup.json', JSON.stringify(store.all(), null, 2))
  const exportActivitiesCSV = () => {
    const acts = store.get('mos:activities', []) || []
    const head = ['type', 'title', 'category', 'frequency', 'daysOfWeek', 'timeOfDay', 'seriesStart', 'seriesEnd', 'status', 'notes']
    const rows = [head, ...acts.map((a) => [a.type, a.title, a.category, a.frequency, (a.daysOfWeek || []).join('/'), (a.timeOfDay || []).join('/'), a.seriesStart, a.seriesEnd, a.status, a.notes])]
    download('activities.csv', toCSV(rows), 'text/csv')
  }
  const exportCycleCSV = () => {
    const logs = store.get('mos:cycle:logs', {}) || {}
    const head = ['date', 'flow', 'bbt', 'symptoms', 'notes']
    const rows = [head, ...Object.keys(logs).sort().map((k) => [k, logs[k].flow, logs[k].bbt, (logs[k].symptoms || []).join('/'), logs[k].notes])]
    download('cycle-log.csv', toCSV(rows), 'text/csv')
  }

  const doDelete = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') return
    await store.wipeAll()
    await store.signOut()
  }

  const Toggle = ({ on, onClick, title }) => (
    <button onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-stone-900' : 'bg-stone-300'}`} title={title}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )

  return (
    <div className="pb-16">
      <SectionTitle kicker="Your account" title="Settings." />

      {/* NAV BAR */}
      <nav className="mb-10 flex flex-wrap gap-x-6 gap-y-2 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 pb-2.5 text-sm transition-colors ${tab === t.id ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-700'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── GENERAL ─────────────────────────────────────────────── */}
      {tab === 'general' && (
        <div className="space-y-14">
          <section className="max-w-lg space-y-6">
            <H2>Account.</H2>
            <Field label="Signed in as">
              <p className="text-sm text-stone-700">{st.email || '—'}</p>
            </Field>
            <Field label="Change email">
              <div className="flex items-center gap-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="new@email.com" className={input} />
                <button onClick={changeEmail} className="shrink-0 bg-stone-900 px-4 py-2 text-sm text-cream hover:bg-stone-700">Update</button>
              </div>
              <p className="mt-2 text-xs italic text-stone-400">You sign in with a magic link — no password. We'll email the new address to confirm.</p>
              {msg && <p className="mt-2 text-sm text-stone-600">{msg}</p>}
            </Field>
            <button onClick={() => store.signOut()} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700"><LogOut size={14} /> Sign out</button>
          </section>

          <section className="max-w-lg space-y-5">
            <H2>Data.</H2>
            <div>
              <p className="kicker text-stone-400 mb-2">Export</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportAll} className="border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500">Download everything (JSON)</button>
                <button onClick={exportActivitiesCSV} className="border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500">Activities (CSV)</button>
                <button onClick={exportCycleCSV} className="border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500">Cycle log (CSV)</button>
              </div>
            </div>
            <div className="border-t border-stone-100 pt-5">
              <p className="kicker text-stone-400 mb-2">Danger zone</p>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 border border-phase-menstrual/40 px-3 py-1.5 text-sm text-phase-menstrual hover:bg-phase-menstrual/5"><Trash2 size={14} /> Delete all my data</button>
              ) : (
                <div className="border border-phase-menstrual/40 bg-phase-menstrual/5 p-4">
                  <p className="text-sm text-stone-700">This permanently erases every section of your planner and signs you out. This can't be undone.</p>
                  <p className="mt-2 text-xs text-stone-500">Type <span className="font-semibold">DELETE</span> to confirm.</p>
                  <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="mt-2 w-40 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
                  <div className="mt-3 flex items-center gap-3">
                    <button onClick={() => { setConfirmDelete(false); setConfirmText('') }} className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
                    <button onClick={doDelete} disabled={confirmText.trim().toUpperCase() !== 'DELETE'} className={`px-4 py-1.5 text-sm text-cream ${confirmText.trim().toUpperCase() === 'DELETE' ? 'bg-phase-menstrual hover:opacity-90' : 'bg-stone-300 cursor-not-allowed'}`}>Delete everything</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── PROFILE (personalization + cycle live here) ─────────── */}
      {tab === 'profile' && (
        <div className="space-y-14">
          <section className="max-w-lg space-y-6">
            <H2>Profile.</H2>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-stone-300 bg-white/50">
                {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-lg text-stone-300">{(p.firstName || p.name || st.email || '?').charAt(0).toUpperCase()}</span>}
              </div>
              <div className="flex items-center gap-3">
                {p.photo && <button onClick={editPhoto} className="border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-500">Edit</button>}
                <button onClick={() => photoRef.current && photoRef.current.click()} className="flex items-center gap-1.5 border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-500"><Upload size={13} /> Upload</button>
                <input ref={photoRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="First name"><input value={p.firstName || ''} onChange={(e) => setP({ firstName: e.target.value })} placeholder="Melissa" className={input} /></Field>
              <Field label="Last name"><input value={p.lastName || ''} onChange={(e) => setP({ lastName: e.target.value })} placeholder="Hilary" className={input} /></Field>
            </div>

            <Field label="Username">
              <p className="text-sm text-stone-700">{p.username || 'melissa hilary'}</p>
            </Field>
            <Field label="Email">
              <p className="text-sm text-stone-700">{st.email || '—'}</p>
            </Field>

            <Field label="Location (for UV & weather)"><LocationField location={location} setLocation={setLocation} className={input} /></Field>
            <Field label="Time zone">
              <select value={p.timezone || ''} onChange={(e) => setP({ timezone: e.target.value })} className={`${input} appearance-none`}>
                <option value="">Auto (from location)</option>
                {TZ_LIST.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Birthday"><input type="date" value={p.birthday || ''} onChange={(e) => setP({ birthday: e.target.value })} className={input} /></Field>
              <Field label="Birth time"><input type="time" value={p.birthTime || ''} onChange={(e) => setP({ birthTime: e.target.value })} className={input} /></Field>
            </div>
            <Field label="Birth place"><input value={p.birthPlace || ''} onChange={(e) => setP({ birthPlace: e.target.value })} placeholder="City, Country" className={input} /></Field>
          </section>

          <section className="max-w-lg">
            <H2>Personalization.</H2>
            <p className="mb-4 text-sm text-stone-600">Show or hide sections in your sidebar. Hiding one keeps all its data — it just tidies your planner.</p>
            <div className="divide-y divide-stone-100">
              {SECTIONS.map((s) => {
                const on = !hiddenArr.includes(s.id)
                return (
                  <div key={s.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-stone-800">{s.label}</span>
                    <Toggle on={on} onClick={() => toggleHidden(s.id)} title={on ? 'Visible' : 'Hidden'} />
                  </div>
                )
              })}
            </div>
          </section>

          <section className="max-w-lg space-y-5">
            <H2>Cycle.</H2>
            <div className="flex flex-wrap items-end gap-6">
              <Field label="Last period started"><input type="date" value={cycle.lastPeriodStart || ''} onChange={(e) => setCfg({ lastPeriodStart: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></Field>
              <Field label="Cycle length"><input type="number" min="20" max="45" value={cycle.cycleLength || 28} onChange={(e) => setCfg({ cycleLength: Number(e.target.value) })} className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></Field>
            </div>
            <p className="text-xs italic text-stone-400">You can also edit period days on the calendar under Hormones → Cycle.</p>
          </section>

          <section className="max-w-lg space-y-4">
            <H2>Horoscope.</H2>
            <p className="text-sm text-stone-600">Your Sun, Moon and Rising — each day's reading is drawn from these.</p>
            {[{ k: 'sun', label: 'Sun' }, { k: 'moon', label: 'Moon' }, { k: 'rising', label: 'Rising' }].map((r) => (
              <Field key={r.k} label={r.label}>
                <select value={sg[r.k] || 'Libra'} onChange={(e) => setSigns((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [r.k]: e.target.value }))} className={`${input} appearance-none`}>
                  {SIGNS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            ))}
          </section>
        </div>
      )}

      {/* ── PLAN & SUBSCRIPTION ─────────────────────────────────── */}
      {tab === 'plan' && (
        <div className="space-y-14">
          <section className="max-w-lg space-y-6">
            <H2>Plan & Subscription.</H2>
            <div className="border border-stone-300 bg-white/40 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="kicker text-stone-400">Current plan</p>
                  <p className="mt-1 font-serif text-2xl text-stone-900">Personal</p>
                </div>
                <span className="rounded-full bg-stone-900 px-3 py-1 text-xs text-cream">Active</span>
              </div>
              <p className="mt-4 text-sm text-stone-600">Your private planner — every section, unlimited entries, cloud-synced across your devices. No billing, nothing to renew.</p>
            </div>
            <p className="text-xs italic text-stone-400">This is a personal planner built for you. There's nothing to upgrade or pay for.</p>
          </section>

          <section className="max-w-lg">
            <H2>Refer a friend.</H2>
            <p className="mb-4 text-sm text-stone-600">Share your planner. Anyone with this link can sign up with their own email.</p>
            <div className="flex items-center gap-2">
              <input readOnly value={link} className="flex-1 border border-stone-300 bg-white/50 px-3 py-2 text-sm text-stone-700 outline-none" />
              <button onClick={copyLink} className="flex shrink-0 items-center gap-1.5 bg-stone-900 px-4 py-2 text-sm text-cream hover:bg-stone-700">
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── NOTIFICATION ────────────────────────────────────────── */}
      {tab === 'notification' && (
        <section className="max-w-lg">
          <H2>Notification.</H2>
          <p className="mb-6 text-sm text-stone-600">Choose what you'd like to be reminded about. Your preferences are saved to your account.</p>
          <div className="divide-y divide-stone-100">
            {NOTIFS.map((n) => {
              const on = !!nf[n.id]
              return (
                <div key={n.id} className="flex items-center justify-between gap-6 py-3.5">
                  <div>
                    <p className="text-sm text-stone-800">{n.label}</p>
                    <p className="mt-0.5 text-xs text-stone-400">{n.hint}</p>
                  </div>
                  <Toggle on={on} onClick={() => toggleNotif(n.id)} title={on ? 'On' : 'Off'} />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── PRIVACY POLICY ──────────────────────────────────────── */}
      {tab === 'privacy' && (
        <section className="max-w-lg space-y-5 text-sm leading-relaxed text-stone-600">
          <H2>Privacy Policy.</H2>
          <p>This planner is private. Everything you enter — your schedule, rituals, cycle, journal and horoscope details — is stored under your own account and protected so that only you, signed in with your email, can read it.</p>
          <div>
            <p className="kicker text-stone-400 mb-1.5">How you sign in</p>
            <p>Access is through a magic link sent to your email. There's no password to leak, and no one else can open your planner without access to your inbox.</p>
          </div>
          <div>
            <p className="kicker text-stone-400 mb-1.5">Your data</p>
            <p>Your entries are saved to a secure database tied to your account. It is never sold, shared, or used for advertising. You can export everything or permanently delete all of it at any time from the General tab.</p>
          </div>
          <div>
            <p className="kicker text-stone-400 mb-1.5">What leaves the app</p>
            <p>Weather and UV use your chosen city to fetch a local forecast. Your daily horoscope voice is generated from your Sun, Moon and Rising and the day's transits. No personal identifying details are attached to these requests.</p>
          </div>
          <p className="text-xs italic text-stone-400">Questions about your data? Reach out on the Contact us tab.</p>
        </section>
      )}

      {/* ── CONTACT US ──────────────────────────────────────────── */}
      {tab === 'contact' && (
        <section className="max-w-lg space-y-5">
          <H2>Contact us.</H2>
          <p className="text-sm text-stone-600">Something not working, or an idea to make your planner better? We'd love to hear from you.</p>
          <a href="mailto:devenishmelissa@gmail.com" className="inline-flex items-center gap-2 bg-stone-900 px-4 py-2.5 text-sm text-cream hover:bg-stone-700">
            <Mail size={15} /> Email support
          </a>
          <p className="text-xs italic text-stone-400">We read every message and usually reply within a day or two.</p>
        </section>
      )}

      {cropSrc && <PhotoCropper src={cropSrc} initial={cropInit} onSave={onCropSave} onClose={() => setCropSrc(null)} />}
    </div>
  )
}

// Circular crop / reposition editor. The image "covers" a square viewport; drag
// to pan, slider to zoom. Save renders the framed square to a data URL (the round
// mask is CSS on the avatar). The chosen zoom/offset is returned so a later Edit
// can restore it.
function PhotoCropper({ src, initial, onSave, onClose }) {
  const V = 288
  const O = 512
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(initial && initial.zoom ? initial.zoom : 1)
  const [pos, setPos] = useState(initial ? { x: initial.x, y: initial.y } : { x: 0, y: 0 })
  const drag = useRef(null)

  const clampWith = (image, p, z) => {
    if (!image) return p
    const dispW = image.w * image.base * z
    const dispH = image.h * image.base * z
    return { x: Math.min(0, Math.max(V - dispW, p.x)), y: Math.min(0, Math.max(V - dispH, p.y)) }
  }

  useEffect(() => {
    const im = new Image()
    im.onload = () => {
      const base = Math.max(V / im.naturalWidth, V / im.naturalHeight)
      const image = { el: im, w: im.naturalWidth, h: im.naturalHeight, base }
      setImg(image)
      if (initial) setPos(clampWith(image, { x: initial.x, y: initial.y }, initial.zoom || 1))
      else {
        const dispW = image.w * base
        const dispH = image.h * base
        setPos({ x: (V - dispW) / 2, y: (V - dispH) / 2 })
      }
    }
    im.src = src
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const onZoom = (z1) => {
    if (img) {
      const f0 = img.base * zoom
      const f1 = img.base * z1
      const ipx = (V / 2 - pos.x) / f0
      const ipy = (V / 2 - pos.y) / f0
      setPos(clampWith(img, { x: V / 2 - ipx * f1, y: V / 2 - ipy * f1 }, z1))
    }
    setZoom(z1)
  }

  const onDown = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ } }
  const onMove = (e) => { if (!drag.current) return; setPos(clampWith(img, { x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) }, zoom)) }
  const onUp = () => { drag.current = null }

  const save = () => {
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = O; canvas.height = O
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, O, O)
    const k = O / V
    ctx.drawImage(img.el, pos.x * k, pos.y * k, img.w * img.base * zoom * k, img.h * img.base * zoom * k)
    onSave(canvas.toDataURL('image/jpeg', 0.9), { zoom, x: pos.x, y: pos.y })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <span className="kicker text-stone-400">Profile photo</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>
        <div className="px-6 py-6">
          <div
            className="relative mx-auto touch-none select-none overflow-hidden rounded-md bg-stone-100"
            style={{ width: V, height: V, cursor: 'grab' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {img && (
              <img
                src={src}
                alt=""
                draggable={false}
                style={{ position: 'absolute', left: pos.x, top: pos.y, width: img.w * img.base * zoom, height: img.h * img.base * zoom, maxWidth: 'none' }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 9999px rgba(28,25,23,0.5)', border: '2px solid rgba(255,255,255,0.9)' }} />
          </div>
          <p className="mt-3 text-center text-xs italic text-stone-400">Drag to reposition.</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="kicker text-stone-400">Zoom</span>
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => onZoom(Number(e.target.value))} className="flex-1 accent-stone-900" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-stone-200 px-6 py-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
          <button onClick={save} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Save</button>
        </div>
      </div>
    </div>
  )
}
