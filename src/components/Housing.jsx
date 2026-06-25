import React, { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import SectionTitle from './shared/SectionTitle'
import { useRegisterAdd } from './shared/AddButton'

const uid = () => Math.random().toString(36).slice(2, 10)
const STAGES = ['Interested', 'Touring', 'Applied', 'Approved', 'Rejected']
const STAGE_COLOR = {
  Interested: '#C4A882',
  Touring: '#B8849A',
  Applied: '#5A6B7B',
  Approved: '#7B8B5F',
  Rejected: '#8B3A3A',
}

const newProperty = () => ({
  id: uid(),
  address: '',
  city: '',
  baseRent: '',
  monthlyFees: '',
  utilities: '',
  deposit: '',
  oneTimeFees: '',
  oneTimeMode: '$',
  creditRequired: false,
  minScore: '',
  washerDryer: 'In unit',
  beds: '',
  baths: '',
  parking: '',
  stage: 'Interested',
  backyard: false,
  walkable: false,
  petPolicy: '',
  notes: '',
})

const num = (v) => Number(v) || 0

export default function Housing() {
  const [data, setData] = useLocalStorage('mos:apt', {
    properties: [],
    application: {
      melissa: { credit: '', incomeBefore: '', incomeAfter: '' },
      tariq: { credit: '', incomeBefore: '', incomeAfter: '' },
    },
    chores: {},
  })
  const [expanded, setExpanded] = useState(null)
  const [split, setSplit] = useState('before')

  const properties = data.properties || []

  const addProperty = () => {
    const p = newProperty()
    setData((d) => ({ ...d, properties: [...(d.properties || []), p] }))
    setExpanded(p.id)
  }
  useRegisterAdd(() => addProperty(), [])
  const updateProperty = (id, patch) =>
    setData((d) => ({ ...d, properties: d.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const removeProperty = (id) =>
    setData((d) => ({ ...d, properties: d.properties.filter((p) => p.id !== id) }))

  const setApp = (who, patch) =>
    setData((d) => ({ ...d, application: { ...d.application, [who]: { ...d.application[who], ...patch } } }))

  return (
    <div>
      <SectionTitle kicker="07 · On our radar" title="Housing." />

      {/* Properties toolbar */}
      <section className="mb-10">
        <div className="mb-2 flex justify-end">
          <span className="text-sm text-stone-400">{properties.length} on the list</span>
        </div>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900">What we're considering.</h2>
        </div>

        <div className="space-y-2">
          {properties.map((p, idx) => (
            <PropertyCard
              key={p.id}
              property={p}
              index={idx + 1}
              open={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              onUpdate={(patch) => updateProperty(p.id, patch)}
              onRemove={() => removeProperty(p.id)}
            />
          ))}
          {properties.length === 0 && (
            <p className="font-serif italic text-lg text-stone-400">Nothing on the radar yet.</p>
          )}
        </div>
      </section>

      <hr className="my-12 border-stone-200" />

      <ApplicationDetails application={data.application} setApp={setApp} split={split} setSplit={setSplit} />

      <hr className="my-12 border-stone-200" />

      <Chores chores={data.chores || {}} setData={setData} />
    </div>
  )
}

function PropertyCard({ property: p, index, open, onToggle, onUpdate, onRemove }) {
  const monthlyTotal = num(p.baseRent) + num(p.monthlyFees) + num(p.utilities)
  const idx = String(index).padStart(2, '0')

  return (
    <div className="border border-stone-200">
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="font-serif italic text-xl text-stone-300 w-8">{idx}</span>
        <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left">
          <div className="flex-1">
            <p className="text-sm text-stone-900">{p.address || 'New property'}</p>
            <p className="text-xs text-stone-500">
              {[p.city, p.beds && `${p.beds} bd`, p.baths && `${p.baths} ba`, monthlyTotal && `$${monthlyTotal}/mo total`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <span className="font-serif italic text-2xl text-stone-900">{p.baseRent ? `$${p.baseRent}` : '—'}</span>
        </button>
        <span className="px-2.5 py-1 text-xs text-white" style={{ backgroundColor: STAGE_COLOR[p.stage] }}>{p.stage}</span>
        <button onClick={onToggle} className="text-stone-400 hover:text-stone-900">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <button onClick={onRemove} className="text-stone-300 hover:text-stone-700"><X size={16} /></button>
      </div>

      {open && (
        <div className="border-t border-stone-200 px-5 py-5 space-y-6">
          {/* Stage bubbles */}
          <BubbleRow
            label="Stage"
            options={STAGES}
            value={p.stage}
            onSelect={(s) => onUpdate({ stage: s })}
          />

          {/* Address */}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Address" value={p.address} onChange={(v) => onUpdate({ address: v })} />
            <Field label="City" value={p.city} onChange={(v) => onUpdate({ city: v })} />
          </div>

          {/* Monthly costs */}
          <div>
            <p className="kicker text-stone-400 mb-3">Monthly costs</p>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Base rent" value={p.baseRent} onChange={(v) => onUpdate({ baseRent: v })} type="number" prefix="$" />
              <Field label="Monthly fees" value={p.monthlyFees} onChange={(v) => onUpdate({ monthlyFees: v })} type="number" prefix="$" />
              <Field label="Utilities" value={p.utilities} onChange={(v) => onUpdate({ utilities: v })} type="number" prefix="$" />
              <div>
                <p className="kicker text-stone-400 mb-1.5">Total</p>
                <p className="font-serif italic text-2xl text-stone-900">${monthlyTotal}</p>
              </div>
            </div>
          </div>

          {/* One-time costs */}
          <div>
            <p className="kicker text-stone-400 mb-3">One-time costs</p>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Deposit" value={p.deposit} onChange={(v) => onUpdate({ deposit: v })} type="number" prefix="$" />
              <div>
                <p className="kicker text-stone-400 mb-1.5">One-time fees</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={p.oneTimeFees}
                    onChange={(e) => onUpdate({ oneTimeFees: e.target.value })}
                    className="w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
                  />
                  <button
                    onClick={() => onUpdate({ oneTimeMode: p.oneTimeMode === '$' ? '%' : '$' })}
                    className="border border-stone-300 px-2 py-1 text-xs hover:border-stone-900"
                  >
                    {p.oneTimeMode}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div>
            <p className="kicker text-stone-400 mb-3">Requirements</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="kicker text-stone-400 mb-1.5">Credit required</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdate({ creditRequired: !p.creditRequired })}
                    className={`px-2.5 py-1 text-xs border ${p.creditRequired ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-500'}`}
                  >
                    {p.creditRequired ? 'Yes' : 'No'}
                  </button>
                  {p.creditRequired && (
                    <input
                      type="number"
                      value={p.minScore}
                      onChange={(e) => onUpdate({ minScore: e.target.value })}
                      placeholder="Min score"
                      className="w-24 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
                    />
                  )}
                </div>
              </div>
              <div>
                <p className="kicker text-stone-400 mb-1.5">Washer / dryer</p>
                <div className="flex gap-1.5">
                  {['In unit', 'None'].map((o) => (
                    <button
                      key={o}
                      onClick={() => onUpdate({ washerDryer: o })}
                      className={`px-2.5 py-1 text-xs border ${p.washerDryer === o ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-500'}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Beds/baths/parking */}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Beds" value={p.beds} onChange={(v) => onUpdate({ beds: v })} type="number" />
            <Field label="Baths" value={p.baths} onChange={(v) => onUpdate({ baths: v })} type="number" />
            <Field label="Parking" value={p.parking} onChange={(v) => onUpdate({ parking: v })} type="number" />
          </div>

          {/* Toggle bubbles */}
          <div className="flex flex-wrap gap-2">
            <Toggle label="Backyard" active={p.backyard} onClick={() => onUpdate({ backyard: !p.backyard })} />
            <Toggle label="Walkable" active={p.walkable} onClick={() => onUpdate({ walkable: !p.walkable })} />
          </div>
          <Field label="Pet policy" value={p.petPolicy} onChange={(v) => onUpdate({ petPolicy: v })} />

          {/* Notes */}
          <div>
            <p className="kicker text-stone-400 mb-1.5">Notes</p>
            <textarea
              value={p.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              className="w-full min-h-[80px] resize-y bg-cream border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ApplicationDetails({ application, setApp, split, setSplit }) {
  const rows = [
    { key: 'incomeBefore', label: 'Income before taxes' },
    { key: 'incomeAfter', label: 'Income after taxes' },
  ]

  const melBefore = num(application.melissa.incomeBefore)
  const tarBefore = num(application.tariq.incomeBefore)
  const melAfter = num(application.melissa.incomeAfter)
  const tarAfter = num(application.tariq.incomeAfter)

  const melShare = split === 'before' ? melBefore : melAfter
  const tarShare = split === 'before' ? tarBefore : tarAfter
  const total = melShare + tarShare
  const melPct = total ? (melShare / total) * 100 : 50

  return (
    <section>
      <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-6">Our application details.</h2>

      {/* Credit row */}
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div>
          <p className="kicker text-stone-400 mb-1.5">Melissa · Credit</p>
          <input value={application.melissa.credit} onChange={(e) => setApp('melissa', { credit: e.target.value })} type="number" placeholder="Score" className="w-32 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
        <div>
          <p className="kicker text-stone-400 mb-1.5">Tariq · Credit</p>
          <input value={application.tariq.credit} onChange={(e) => setApp('tariq', { credit: e.target.value })} type="number" placeholder="Score" className="w-32 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
      </div>

      {/* Income rows for each person */}
      {['melissa', 'tariq'].map((who) => (
        <div key={who} className="mb-6">
          <p className="kicker text-stone-500 mb-3 capitalize">{who}</p>
          {rows.map((r) => {
            const yearly = num(application[who][r.key])
            return (
              <div key={r.key} className="mb-3 grid grid-cols-4 items-end gap-3">
                <div>
                  <p className="kicker text-stone-400 mb-1.5">{r.label}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-stone-400">$</span>
                    <input
                      type="number"
                      value={application[who][r.key]}
                      onChange={(e) => setApp(who, { [r.key]: e.target.value })}
                      placeholder="Yearly"
                      className="w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
                    />
                  </div>
                </div>
                <Computed label="Yearly" value={yearly} />
                <Computed label="Monthly" value={yearly / 12} />
                <Computed label="Biweekly" value={yearly / 26} />
              </div>
            )
          })}
        </div>
      ))}

      {/* The Split donut */}
      <div className="my-8 flex flex-wrap items-center gap-10">
        <Donut melPct={melPct} />
        <div>
          <div className="mb-4 flex gap-1.5">
            {['before', 'after'].map((s) => (
              <button
                key={s}
                onClick={() => setSplit(s)}
                className={`px-3 py-1 text-xs border capitalize ${split === s ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-500'}`}
              >
                {s} taxes
              </button>
            ))}
          </div>
          <p className="text-sm text-stone-600">
            <span className="inline-block h-2.5 w-2.5 align-middle mr-2" style={{ backgroundColor: '#B8849A' }} />
            Melissa · {melPct.toFixed(0)}%
          </p>
          <p className="mt-1.5 text-sm text-stone-600">
            <span className="inline-block h-2.5 w-2.5 align-middle mr-2" style={{ backgroundColor: '#5A6B7B' }} />
            Tariq · {(100 - melPct).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Joint household combined */}
      <div>
        <p className="kicker text-stone-500 mb-3">Joint household combined</p>
        <div className="grid grid-cols-3 border-l border-t border-stone-200">
          {['Yearly', 'Monthly', 'Biweekly'].map((c) => (
            <div key={c} className="border-b border-r border-stone-200 px-3 py-2 kicker text-stone-400">{c}</div>
          ))}
          {(() => {
            const yearly = (split === 'before' ? melBefore + tarBefore : melAfter + tarAfter)
            return [yearly, yearly / 12, yearly / 26].map((v, i) => (
              <div key={i} className="border-b border-r border-stone-200 px-3 py-3 font-serif italic text-xl text-stone-900">
                ${Math.round(v).toLocaleString()}
              </div>
            ))
          })()}
        </div>
      </div>
    </section>
  )
}

const CHORE_CARDS = ['Laundry', 'Dishes', 'Reorganization', 'Deep cleaning', 'Restock']

function Chores({ chores, setData }) {
  const update = (name, patch) =>
    setData((d) => ({ ...d, chores: { ...(d.chores || {}), [name]: { ...((d.chores || {})[name] || {}), ...patch } } }))

  return (
    <section>
      <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-6">Keeping the house running.</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {CHORE_CARDS.map((name) => {
          const c = chores[name] || {}
          return (
            <div key={name} className="border border-stone-200 px-4 py-4">
              <h3 className="font-serif text-xl text-stone-900 mb-3">{name}</h3>
              <p className="kicker text-stone-400 mb-1.5">Last done</p>
              <input
                type="date"
                value={c.lastDone || ''}
                onChange={(e) => update(name, { lastDone: e.target.value })}
                className="mb-3 w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
              />
              <p className="kicker text-stone-400 mb-1.5">Whose turn</p>
              <input
                value={c.who || ''}
                onChange={(e) => update(name, { who: e.target.value })}
                placeholder="Melissa / Tariq"
                className="w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── small primitives ────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', prefix }) {
  return (
    <div>
      <p className="kicker text-stone-400 mb-1.5">{label}</p>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-stone-400">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
        />
      </div>
    </div>
  )
}

function Computed({ label, value }) {
  return (
    <div>
      <p className="kicker text-stone-400 mb-1.5">{label}</p>
      <p className="text-sm text-stone-700 tabular-nums">${Math.round(value).toLocaleString()}</p>
    </div>
  )
}

function BubbleRow({ label, options, value, onSelect }) {
  return (
    <div>
      <p className="kicker text-stone-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onSelect(o)}
            className={`px-2.5 py-1 text-xs border transition-colors ${value === o ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-500 hover:border-stone-500'}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs border transition-colors ${active ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-500 hover:border-stone-500'}`}
    >
      {label}
    </button>
  )
}

function Donut({ melPct }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const melLen = (melPct / 100) * circ
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#5A6B7B" strokeWidth="20" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="#B8849A"
        strokeWidth="20"
        strokeDasharray={`${melLen} ${circ - melLen}`}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="76" textAnchor="middle" className="font-serif" fontStyle="italic" fontSize="22" fill="#1C1917">
        {melPct.toFixed(0)}%
      </text>
    </svg>
  )
}
