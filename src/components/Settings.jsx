import React, { useEffect, useRef, useState } from 'react'
import { Copy, Check, LogOut, Upload, Trash2 } from 'lucide-react'
import * as store from '../lib/dataStore'
import { useLocalStorage } from '../hooks/useLocalStorage'
import SectionTitle from './shared/SectionTitle'
import LocationField from './shared/LocationField'
import { SIGNS } from '../lib/astrology/natal'
import { PHASES } from '../lib/cycle'

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

  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const photoRef = useRef(null)

  const link = typeof window !== 'undefined' ? window.location.origin : 'https://melissa-os.vercel.app'

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
  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) resizePhoto(file, 256, (data) => setP({ photo: data }))
  }
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

  return (
    <div className="pb-16">
      <SectionTitle kicker="Your account" title="Settings." />

      {/* PROFILE */}
      <section className="mb-14 max-w-lg space-y-6">
        <H2>Profile.</H2>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-stone-300 bg-white/50">
            {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-lg text-stone-300">{(p.name || st.email || '?').charAt(0).toUpperCase()}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => photoRef.current && photoRef.current.click()} className="flex items-center gap-1.5 border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-500"><Upload size={13} /> Photo</button>
            {p.photo && <button onClick={() => setP({ photo: '' })} className="text-xs text-stone-400 hover:text-stone-700">Remove</button>}
            <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          </div>
        </div>

        <Field label="Name"><input value={p.name || ''} onChange={(e) => setP({ name: e.target.value })} placeholder="Melissa" className={input} /></Field>

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

        <button onClick={() => store.signOut()} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700"><LogOut size={14} /> Sign out</button>
      </section>

      {/* REFER A FRIEND */}
      <section className="mb-14 max-w-lg">
        <H2>Refer a friend.</H2>
        <p className="mb-4 text-sm text-stone-600">Share your planner. Anyone with this link can sign up with their own email.</p>
        <div className="flex items-center gap-2">
          <input readOnly value={link} className="flex-1 border border-stone-300 bg-white/50 px-3 py-2 text-sm text-stone-700 outline-none" />
          <button onClick={copyLink} className="flex shrink-0 items-center gap-1.5 bg-stone-900 px-4 py-2 text-sm text-cream hover:bg-stone-700">
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      </section>

      {/* DATA */}
      <section className="mb-14 max-w-lg space-y-5">
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

      {/* PERSONALIZATION */}
      <section className="mb-14 max-w-lg">
        <H2>Personalization.</H2>
        <p className="mb-4 text-sm text-stone-600">Show or hide sections in your sidebar. Hiding one keeps all its data — it just tidies your planner.</p>
        <div className="divide-y divide-stone-100">
          {SECTIONS.map((s) => {
            const on = !hiddenArr.includes(s.id)
            return (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-stone-800">{s.label}</span>
                <button onClick={() => toggleHidden(s.id)} className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-stone-900' : 'bg-stone-300'}`} title={on ? 'Visible' : 'Hidden'}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* CYCLE */}
      <section className="mb-14 max-w-lg space-y-5">
        <H2>Cycle.</H2>
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Last period started"><input type="date" value={cycle.lastPeriodStart || ''} onChange={(e) => setCfg({ lastPeriodStart: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></Field>
          <Field label="Cycle length"><input type="number" min="20" max="45" value={cycle.cycleLength || 28} onChange={(e) => setCfg({ cycleLength: Number(e.target.value) })} className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></Field>
        </div>
        <p className="text-xs italic text-stone-400">You can also edit period days on the calendar under Hormones → Cycle.</p>
      </section>

      {/* HOROSCOPE */}
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
  )
}
