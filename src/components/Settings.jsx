import React, { useEffect, useRef, useState } from 'react'
import { Copy, Check, LogOut, Upload, Trash2, Mail, X, UserRound, Palette, HeartPulse, LayoutGrid, Bell, Gem, ShieldCheck, MessageCircle, Watch } from 'lucide-react'
import * as store from '../lib/dataStore'
import { useLocalStorage } from '../hooks/useLocalStorage'
import SectionTitle from './shared/SectionTitle'
import LocationField from './shared/LocationField'
import { SIGNS } from '../lib/astrology/natal'
import { LIFE_STAGES, useLifeStage, stageMeta } from '../lib/lifeStage'

// Pillars that can be hidden/shown (data is kept either way).
const SECTIONS = [
  { id: 'mindset', label: 'Mindset' },
  { id: 'skincare', label: 'Skincare' },
  { id: 'haircare', label: 'Haircare' },
  { id: 'aesthetics', label: 'Aesthetics' },
  { id: 'bodycare', label: 'Bodycare' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'menu', label: 'Nutrition' },
  { id: 'workout', label: 'Cycle' },
  { id: 'diagnostics', label: 'Testing' },
  { id: 'relationship', label: 'Relationships' },
  { id: 'spirituality', label: 'Spirituality' },
]

// The portal's rooms — each one owns a coherent slice of the account.
const ROOMS = [
  { id: 'profile', label: 'Profile', icon: UserRound, blurb: 'Who you are' },
  { id: 'appearance', label: 'Appearance', icon: Palette, blurb: 'Your palette' },
  { id: 'body', label: 'My Body', icon: HeartPulse, blurb: 'Life stage & cycle' },
  { id: 'house', label: 'My House', icon: LayoutGrid, blurb: 'Sections & layout' },
  { id: 'connected', label: 'Connected', icon: Watch, blurb: 'Wearables & devices' },
  { id: 'notifications', label: 'Notifications', icon: Bell, blurb: 'What reaches you' },
  { id: 'membership', label: 'Membership', icon: Gem, blurb: 'Plan & referrals' },
  { id: 'privacy', label: 'Data & Privacy', icon: ShieldCheck, blurb: 'Yours alone' },
  { id: 'contact', label: 'Contact', icon: MessageCircle, blurb: 'Reach us' },
]

// The wardrobe — theme palettes. Values must match index.css.
export const THEMES = [
  { id: 'porcelain', label: 'Porcelain', blurb: 'The house cream', ground: '#FAFAF7', mid: '#E7E5E4', ink: '#1C1917' },
  { id: 'ecru', label: 'Écru', blurb: 'Warm parchment', ground: '#FAF6ED', mid: '#E8E1D1', ink: '#1D1913' },
  { id: 'rosewater', label: 'Rosewater', blurb: 'The faintest blush', ground: '#FBF6F4', mid: '#EADFDC', ink: '#1D1817' },
  { id: 'sage', label: 'Sage', blurb: 'Quiet green air', ground: '#F7F8F4', mid: '#E2E5DB', ink: '#191B16' },
]

// Life stages live in src/lib/lifeStage.js — one source of truth for the
// whole arc, with per-stage feature manifests and behavior flags.

// The wearables & devices that can listen to her body. Auto-sync is a runway
// item; today each is 'worn' (tracked by hand / its own app) or not.
const DEVICES = [
  { id: 'oura', label: 'Oura ring', tracks: 'sleep · HRV · temperature' },
  { id: 'whoop', label: 'Whoop', tracks: 'strain · recovery · sleep' },
  { id: 'applewatch', label: 'Apple Watch', tracks: 'activity · heart · cycle' },
  { id: 'cgm', label: 'CGM', tracks: 'glucose' },
  { id: 'tempdrop', label: 'Tempdrop', tracks: 'basal temperature' },
  { id: 'naturalcycles', label: 'Natural Cycles', tracks: 'cycle · fertility' },
  { id: 'muse', label: 'Muse headband', tracks: 'meditation · EEG' },
  { id: 'garmin', label: 'Garmin', tracks: 'training · sleep' },
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

const Card = ({ title, blurb, children }) => (
  <section className="rounded-2xl border border-stone-200 bg-white/40 p-6 md:p-7">
    <h2 className="font-serif italic text-2xl text-stone-900">{title}</h2>
    {blurb && <p className="mt-1 text-sm text-stone-500">{blurb}</p>}
    <div className="mt-5">{children}</div>
  </section>
)
const Field = ({ label, children }) => (
  <div>
    <label className="kicker text-stone-400 mb-1.5 block">{label}</label>
    {children}
  </div>
)
const input = 'w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900'

export default function Settings() {
  const [room, setRoom] = useState('profile')
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
  const [theme, setTheme] = useLocalStorage('mos:settings:theme', 'porcelain')
  const { stage: lifeStage, setStage: setLifeStage, journey } = useLifeStage()
  const [pregRaw, setPreg] = useLocalStorage('mos:pregnancy', {})
  const preg = pregRaw && typeof pregRaw === 'object' ? pregRaw : {}
  const [ppRaw, setPP] = useLocalStorage('mos:postpartum', {})
  const pp = ppRaw && typeof ppRaw === 'object' ? ppRaw : {}
  const [connectionsRaw, setConnections] = useLocalStorage('mos:connections', {})
  const connections = connectionsRaw && typeof connectionsRaw === 'object' ? connectionsRaw : {}
  const setConn = (id, patch) => setConnections((prev) => { const p = prev && typeof prev === 'object' ? prev : {}; return { ...p, [id]: { ...(p[id] || {}), ...patch } } })

  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [cropSrc, setCropSrc] = useState(null)
  const [cropInit, setCropInit] = useState(null)
  const [refEmail, setRefEmail] = useState('')
  const [refReady, setRefReady] = useState(false)
  const photoRef = useRef(null)

  useEffect(() => {
    if (p.referralEmail && !refReady) { setRefEmail(p.referralEmail); setRefReady(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.referralEmail])

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

      <div className="mt-2 flex flex-col gap-8 md:flex-row md:gap-10">
        {/* The rail — rooms of the portal */}
        <nav className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
          {ROOMS.map((r) => {
            const on = room === r.id
            const Icon = r.icon
            return (
              <button
                key={r.id}
                onClick={() => setRoom(r.id)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${on ? 'bg-stone-900 text-cream' : 'text-stone-600 hover:bg-stone-500/5'}`}
              >
                <Icon size={16} strokeWidth={1.75} className={on ? 'text-cream' : 'text-stone-400'} />
                <span className="min-w-0">
                  <span className="block text-sm leading-tight">{r.label}</span>
                  <span className={`hidden text-[11px] md:block ${on ? 'text-cream/60' : 'text-stone-400'}`}>{r.blurb}</span>
                </span>
              </button>
            )
          })}
        </nav>

        {/* The room */}
        <div className="min-w-0 flex-1 space-y-6">

          {room === 'profile' && (<>
            <Card title="You." blurb="Your name and face, as the house knows you.">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-stone-300 bg-white/50">
                  {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-lg text-stone-300">{(p.firstName || p.name || st.email || '?').charAt(0).toUpperCase()}</span>}
                </div>
                <div className="flex items-center gap-3">
                  {p.photo && <button onClick={editPhoto} className="rounded-full border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-500">Edit</button>}
                  <button onClick={() => photoRef.current && photoRef.current.click()} className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-500"><Upload size={13} /> Upload</button>
                  <input ref={photoRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <Field label="First name"><input value={p.firstName || ''} onChange={(e) => setP({ firstName: e.target.value })} placeholder="Melissa" className={input} /></Field>
                <Field label="Last name"><input value={p.lastName || ''} onChange={(e) => setP({ lastName: e.target.value })} placeholder="Hilary" className={input} /></Field>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Location (for UV & weather)"><LocationField location={location} setLocation={setLocation} className={input} /></Field>
                <Field label="Time zone">
                  <select value={p.timezone || ''} onChange={(e) => setP({ timezone: e.target.value })} className={`${input} appearance-none`}>
                    <option value="">Auto (from location)</option>
                    {TZ_LIST.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </Field>
              </div>
            </Card>

            <Card title="Your chart." blurb="Birth details power your horoscope and the sky's daily read.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Birthday"><input type="date" value={p.birthday || ''} onChange={(e) => setP({ birthday: e.target.value })} className={input} /></Field>
                <Field label="Birth time"><input type="time" value={p.birthTime || ''} onChange={(e) => setP({ birthTime: e.target.value })} className={input} /></Field>
              </div>
              <div className="mt-4"><Field label="Birth place"><input value={p.birthPlace || ''} onChange={(e) => setP({ birthPlace: e.target.value })} placeholder="City, Country" className={input} /></Field></div>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {[{ k: 'sun', label: 'Sun' }, { k: 'moon', label: 'Moon' }, { k: 'rising', label: 'Rising' }].map((r) => (
                  <Field key={r.k} label={r.label}>
                    <select value={sg[r.k] || 'Libra'} onChange={(e) => setSigns((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [r.k]: e.target.value }))} className={`${input} appearance-none`}>
                      {SIGNS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                ))}
              </div>
            </Card>

            <Card title="Account." blurb="How you sign in.">
              <Field label="Signed in as"><p className="text-sm text-stone-700">{st.email || '—'}</p></Field>
              <div className="mt-4">
                <Field label="Change email">
                  <div className="flex items-center gap-2">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="new@email.com" className={input} />
                    <button onClick={changeEmail} className="shrink-0 rounded-full bg-stone-900 px-4 py-2 text-sm text-cream hover:bg-stone-700">Update</button>
                  </div>
                  <p className="mt-2 text-xs italic text-stone-400">You sign in with a magic link — no password. We'll email the new address to confirm.</p>
                  {msg && <p className="mt-2 text-sm text-stone-600">{msg}</p>}
                </Field>
              </div>
              <button onClick={() => store.signOut()} className="mt-5 flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700"><LogOut size={14} /> Sign out</button>
            </Card>
          </>)}

          {room === 'appearance' && (
            <Card title="The wardrobe." blurb="Choose the palette your whole planner wears. Elegant in every shade.">
              <div className="grid grid-cols-2 gap-4">
                {THEMES.map((t) => {
                  const on = (theme || 'porcelain') === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`overflow-hidden rounded-2xl border text-left transition-all ${on ? 'border-stone-900 shadow-md' : 'border-stone-200 hover:border-stone-400'}`}
                    >
                      {/* Swatch preview — ground, hairline, ink dot */}
                      <div className="relative h-20" style={{ background: t.ground }}>
                        <span className="absolute left-4 top-4 h-2 w-14 rounded-full" style={{ background: t.mid }} />
                        <span className="absolute left-4 top-8 h-2 w-9 rounded-full" style={{ background: t.mid }} />
                        <span className="absolute right-4 top-4 h-6 w-6 rounded-full" style={{ background: t.ink }} />
                      </div>
                      <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3">
                        <span>
                          <span className="block font-serif text-lg leading-tight text-stone-900">{t.label}</span>
                          <span className="text-xs text-stone-400">{t.blurb}</span>
                        </span>
                        {on && <Check size={16} className="text-stone-900" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>
          )}

          {room === 'body' && (<>
            <Card title="Life stage." blurb="The whole arc — pick where your body is and the planner reshapes itself. Change it any time; nothing is ever lost when you move.">
              <div className="space-y-3">
                {LIFE_STAGES.map((s) => {
                  const on = (lifeStage || 'cycling') === s.id
                  return (
                    <div key={s.id} className={`rounded-2xl border transition-all ${on ? 'border-stone-900 bg-white/60' : 'border-stone-200 hover:border-stone-400'}`}>
                      <button onClick={() => setLifeStage(s.id)} className="flex w-full items-start gap-4 p-4 text-left">
                        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-stone-900 bg-stone-900' : 'border-stone-300'}`}>{on && <Check size={12} className="text-cream" />}</span>
                        <span>
                          <span className="block font-serif text-lg text-stone-900">{s.label}</span>
                          <span className="text-sm text-stone-500">{s.blurb}</span>
                        </span>
                      </button>
                      {on && (
                        <div className="grid grid-cols-1 gap-4 border-t border-stone-100 px-4 pb-4 pt-3 sm:grid-cols-2 sm:px-5">
                          <div>
                            <p className="kicker mb-2 text-stone-500">Your planner turns on</p>
                            <ul className="space-y-1">
                              {s.on.map((f) => (
                                <li key={f} className="flex items-baseline gap-2 text-xs text-stone-700"><span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full bg-stone-900" />{f}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="kicker mb-2 text-stone-400">What rests</p>
                            <ul className="space-y-1">
                              {s.off.map((f) => (
                                <li key={f} className="flex items-baseline gap-2 text-xs text-stone-400"><span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full border border-stone-300" />{f}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {journey.length > 1 && (
                <p className="mt-4 text-xs italic text-stone-400">
                  Your journey so far: {journey.map((j) => stageMeta(j.stage).label).join(' → ')}. Everything you logged along the way is still yours.
                </p>
              )}
            </Card>

            {(lifeStage || 'cycling') === 'pregnant' && (
              <Card title="Due date." blurb="The anchor your weeks and trimester are counted from.">
                <Field label="Due date"><input type="date" value={preg.dueDate || ''} onChange={(e) => setPreg((p2) => ({ ...(p2 && typeof p2 === 'object' ? p2 : {}), dueDate: e.target.value }))} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></Field>
              </Card>
            )}

            {(lifeStage || 'cycling') === 'postpartum' && (
              <Card title="Birth date." blurb="The anchor your recovery weeks are counted from.">
                <Field label="Baby arrived"><input type="date" value={pp.birthDate || ''} onChange={(e) => setPP((p2) => ({ ...(p2 && typeof p2 === 'object' ? p2 : {}), birthDate: e.target.value }))} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></Field>
              </Card>
            )}

            {['cycling', 'ttc', 'perimenopause'].includes(lifeStage || 'cycling') && (
              <Card title="Cycle." blurb="The anchor your phases are computed from.">
                <div className="flex flex-wrap items-end gap-6">
                  <Field label="Last period started"><input type="date" value={cycle.lastPeriodStart || ''} onChange={(e) => setCfg({ lastPeriodStart: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></Field>
                  <Field label="Cycle length"><input type="number" min="20" max="45" value={cycle.cycleLength || 28} onChange={(e) => setCfg({ cycleLength: Number(e.target.value) })} className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" /></Field>
                </div>
                <p className="mt-3 text-xs italic text-stone-400">You can also mark period days on the calendar under Cycle.</p>
              </Card>
            )}
          </>)}

          {room === 'house' && (
            <Card title="Your house." blurb="Show or hide pillars. Hiding one keeps every bit of its data — it just tidies the halls.">
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
            </Card>
          )}

          {room === 'connected' && (<>
            <Card title="Intelligence." blurb="The mind behind the house.">
              <div className={`rounded-2xl border p-5 transition-all ${connections.claude?.off ? 'border-stone-200' : 'border-stone-900 bg-white/60'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-lg leading-tight text-stone-900">Claude</p>
                    <p className="mt-0.5 text-xs text-stone-400">Powers Esmé, your daily horoscope, and goal plans — reading only your own planner, never the open internet.</p>
                  </div>
                  <Toggle on={!connections.claude?.off} onClick={() => setConn('claude', { off: !connections.claude?.off })} title={connections.claude?.off ? 'Paused' : 'Connected'} />
                </div>
                {!connections.claude?.off && (
                  <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7C8B6B]" />
                    <span className="text-[10px] tracking-[0.12em] text-stone-400">CONNECTED · ANSWERS GROUNDED IN YOUR DATA</span>
                  </div>
                )}
              </div>
            </Card>

            <Card title="Wearables." blurb="What you wear that listens to your body. Toggle what you own; auto-sync arrives here first.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {DEVICES.map((d) => {
                  const c = connections[d.id] || {}
                  const on = !!c.on
                  return (
                    <div key={d.id} className={`rounded-2xl border p-4 transition-all ${on ? 'border-stone-900 bg-white/60' : 'border-stone-200'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-serif text-lg leading-tight text-stone-900">{d.label}</p>
                          <p className="text-xs text-stone-400">{d.tracks}</p>
                        </div>
                        <Toggle on={on} onClick={() => setConn(d.id, { on: !on })} title={on ? 'Worn' : 'Not worn'} />
                      </div>
                      {on && (
                        <div className="mt-3 border-t border-stone-100 pt-3">
                          <input value={c.note || ''} onChange={(e) => setConn(d.id, { note: e.target.value })} placeholder="What you watch for…" className="w-full bg-transparent text-xs text-stone-600 outline-none placeholder:text-stone-300" />
                          <span className="mt-2 inline-block rounded-full bg-stone-500/5 px-2.5 py-0.5 text-[10px] tracking-[0.12em] text-stone-400">AUTO-SYNC COMING SOON</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </>)}

          {room === 'notifications' && (
            <Card title="What reaches you." blurb="Only what you choose. Saved to your account.">
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
            </Card>
          )}

          {room === 'membership' && (<>
            <Card title="Membership." blurb="Your standing in the house.">
              <div className="flex items-center justify-between">
                <div>
                  <p className="kicker text-stone-400">Current plan</p>
                  <p className="mt-1 font-serif text-2xl text-stone-900">Personal</p>
                </div>
                <span className="rounded-full bg-stone-900 px-3 py-1 text-xs text-cream">Active</span>
              </div>
              <p className="mt-4 text-sm text-stone-600">Your private planner — every section, unlimited entries, cloud-synced across your devices.</p>
            </Card>

            <Card title="Get paid to glow." blurb="Send 25% off. Earn $25 for every friend who joins.">
              {!refReady ? (
                <>
                  <p className="text-sm text-stone-600">Enter your email to generate your link. Your $25 Visa card arrives here each time a friend subscribes.</p>
                  <div className="mt-4 flex items-center gap-2">
                    <input type="email" value={refEmail} onChange={(e) => setRefEmail(e.target.value)} placeholder="your email" className="flex-1 rounded-full border border-stone-300 bg-white/50 px-4 py-2 text-sm text-stone-700 outline-none focus:border-stone-900" />
                    <button onClick={() => { if (refEmail.trim()) { setP({ referralEmail: refEmail.trim() }); setRefReady(true) } }} className="shrink-0 rounded-full bg-stone-900 px-4 py-2 text-sm text-cream hover:bg-stone-700">Get my link</button>
                  </div>
                </>
              ) : (
                <div>
                  <p className="kicker text-stone-400 mb-2">your link — copy and send it</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={link} className="flex-1 rounded-full border border-stone-300 bg-white/50 px-4 py-2 text-sm text-stone-700 outline-none" />
                    <button onClick={copyLink} className="flex shrink-0 items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm text-cream hover:bg-stone-700">
                      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </>)}

          {room === 'privacy' && (<>
            <Card title="Your data." blurb="Take it with you any time.">
              <div className="flex flex-wrap gap-2">
                <button onClick={exportAll} className="rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-700 hover:border-stone-500">Download everything (JSON)</button>
                <button onClick={exportActivitiesCSV} className="rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-700 hover:border-stone-500">Activities (CSV)</button>
                <button onClick={exportCycleCSV} className="rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-700 hover:border-stone-500">Cycle log (CSV)</button>
              </div>
            </Card>

            <Card title="Privacy." blurb="This planner is yours alone.">
              <div className="space-y-4 text-sm leading-relaxed text-stone-600">
                <p>Everything you enter — your schedule, rituals, cycle, journal and horoscope details — is stored under your own account and protected so that only you, signed in with your email, can read it.</p>
                <div>
                  <p className="kicker text-stone-400 mb-1.5">How you sign in</p>
                  <p>Access is through a magic link sent to your email. There's no password to leak, and no one else can open your planner without access to your inbox.</p>
                </div>
                <div>
                  <p className="kicker text-stone-400 mb-1.5">What leaves the app</p>
                  <p>Weather and UV use your chosen city to fetch a local forecast. Your horoscope and concierge use your recorded data to write for you. Nothing is sold, shared, or used for advertising.</p>
                </div>
              </div>
            </Card>

            <Card title="Danger zone." blurb="Permanent, immediate, irreversible.">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-full border border-phase-menstrual/40 px-4 py-1.5 text-sm text-phase-menstrual hover:bg-phase-menstrual/5"><Trash2 size={14} /> Delete all my data</button>
              ) : (
                <div className="rounded-xl border border-phase-menstrual/40 bg-phase-menstrual/5 p-4">
                  <p className="text-sm text-stone-700">This permanently erases every section of your planner and signs you out. This can't be undone.</p>
                  <p className="mt-2 text-xs text-stone-500">Type <span className="font-semibold">DELETE</span> to confirm.</p>
                  <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="mt-2 w-40 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
                  <div className="mt-3 flex items-center gap-3">
                    <button onClick={() => { setConfirmDelete(false); setConfirmText('') }} className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
                    <button onClick={doDelete} disabled={confirmText.trim().toUpperCase() !== 'DELETE'} className={`rounded-full px-4 py-1.5 text-sm text-cream ${confirmText.trim().toUpperCase() === 'DELETE' ? 'bg-phase-menstrual hover:opacity-90' : 'bg-stone-300 cursor-not-allowed'}`}>Delete everything</button>
                  </div>
                </div>
              )}
            </Card>
          </>)}

          {room === 'contact' && (
            <Card title="Reach us." blurb="Something not working, or an idea to make your planner better? We read every message.">
              <a href="mailto:devenishmelissa@gmail.com" className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream hover:bg-stone-700">
                <Mail size={15} /> Email support
              </a>
              <p className="mt-3 text-xs italic text-stone-400">We usually reply within a day or two.</p>
            </Card>
          )}
        </div>
      </div>

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
      <div className="w-full max-w-sm bg-cream rounded-2xl border border-stone-200 shadow-2xl">
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
          <button onClick={save} className="rounded-full px-6 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Save</button>
        </div>
      </div>
    </div>
  )
}
