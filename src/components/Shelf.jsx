import React, { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import * as store from '../lib/dataStore'
import { SHELF_CATEGORIES, categoryLabel, money, nudges, spendReport, costPerUse, normalizeProducts } from '../lib/shelf'
import { authHeaders } from '../lib/apiAuth'
import { tap } from '../lib/haptics'

const uid = () => Math.random().toString(36).slice(2, 10)
const line = 'w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900'
const STATUSES = [
  { id: 'sealed', label: 'Sealed' },
  { id: 'opened', label: 'Opened' },
  { id: 'low', label: 'Low' },
  { id: 'expiring', label: 'Expiring' },
]

const EMPTY = {
  name: '', brand: '', category: 'skin', size: '', ingredients: '', price: '', barcode: '',
  status: 'sealed', openedOn: '', expiresOn: '', purchasedOn: '', uses: '', notes: '',
  wishlist: false, restock: false,
}

async function lookupBarcode(code) {
  const headers = await authHeaders()
  try {
    const res = await fetch(`/api/product?code=${encodeURIComponent(code)}`, { headers })
    if (res.ok) {
      const json = await res.json()
      if (json && json.found && json.product) return json.product
    }
  } catch { /* the public record is the fallback */ }
  const urls = [
    `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
  ]
  for (const url of urls) {
    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const j = await r.json()
      const p = j && j.status === 1 ? j.product : null
      if (p && (p.product_name || p.product_name_en)) {
        return {
          name: p.product_name || p.product_name_en || '',
          brand: String(p.brands || '').split(',')[0].trim(),
          size: String(p.quantity || ''),
          ingredients: String(p.ingredients_text || p.ingredients_text_en || ''),
          price: p.price ? String(p.price) : '',
        }
      }
    } catch { /* next source */ }
  }
  return null
}

async function scanNative() {
  try {
    const cap = window.Capacitor
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
    const perm = await BarcodeScanner.requestPermissions()
    if (perm.camera !== 'granted' && perm.camera !== 'limited') return ''
    const { barcodes } = await BarcodeScanner.scan()
    return (barcodes && barcodes[0] && barcodes[0].rawValue) || ''
  } catch {
    return null
  }
}

export default function Shelf({ view, setView }) {
  const [raw, setRaw] = useLocalStorage('mos:shelf', [])
  const [journal, setJournal] = useLocalStorage('mos:shelf:journal', [])
  const [routines, setRoutines] = useLocalStorage('mos:shelf:routines', [])
  const products = normalizeProducts(raw)
  const [openId, setOpenId] = useState(null)
  const [cat, setCat] = useState('skin')
  const open = products.find((p) => p.id === openId) || null

  const show = (next) => { setView(next); if (next !== 'ledger') setOpenId(null) }
  const openProduct = (id) => { setOpenId(id); setView('ledger') }

  return (
    <div>
      <p className="kicker text-center text-stone-400">The cabinet</p>
      <h1 className="mt-2 text-center font-serif text-4xl text-stone-900 md:text-5xl">Shelf</h1>
      <div className="mx-auto mt-6 flex max-w-xl justify-center gap-2">
        {[
          ['cabinet', 'Shelf'],
          ['scan', 'Scan'],
          ['spend', 'Spend'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => show(id)} className={`min-h-11 rounded-full px-4 font-serif text-[15px] ${view === id || (id === 'cabinet' && view === 'ledger') ? 'bg-stone-900 text-cream' : 'text-stone-400'}`}>{label}</button>
        ))}
      </div>

      {view === 'scan' && <Scan onAdd={(p) => { setRaw((prev) => [...normalizeProducts(prev), p]); openProduct(p.id) }} />}
      {view === 'spend' && <Spend products={products} journal={Array.isArray(journal) ? journal : []} onOpen={openProduct} />}
      {view === 'ledger' && open && (
        <Ledger
          product={open}
          journal={(Array.isArray(journal) ? journal : []).filter((j) => j.productId === open.id)}
          onChange={(patch) => setRaw((prev) => normalizeProducts(prev).map((p) => (p.id === open.id ? { ...p, ...patch } : p)))}
          onRemove={() => { setRaw((prev) => normalizeProducts(prev).filter((p) => p.id !== open.id)); show('cabinet') }}
          onJournal={(entry) => setJournal((prev) => [...(Array.isArray(prev) ? prev : []), entry])}
          onBack={() => show('cabinet')}
        />
      )}
      {(view === 'cabinet' || (view === 'ledger' && !open)) && (
        <Cabinet
          products={products}
          routines={Array.isArray(routines) ? routines : []}
          setRoutines={setRoutines}
          cat={cat}
          setCat={setCat}
          onOpen={openProduct}
          onScan={() => show('scan')}
        />
      )}
    </div>
  )
}

function Cabinet({ products, routines, setRoutines, cat, setCat, onOpen, onScan }) {
  const mine = products.filter((p) => !p.wishlist && p.category === cat)
  const wishes = products.filter((p) => p.wishlist)
  const due = nudges(products)
  const [routineName, setRoutineName] = useState('')
  const addRoutine = () => {
    if (!routineName.trim()) return
    setRoutines((prev) => [...(Array.isArray(prev) ? prev : []), { id: uid(), name: routineName.trim(), time: 'morning', productIds: [] }])
    setRoutineName('')
  }
  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {SHELF_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs ${cat === c.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500'}`}>{c.label}</button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {mine.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-stone-200 px-6 py-10 text-center">
            <p className="font-serif italic text-stone-400">This shelf is empty.</p>
            <button onClick={onScan} className="mt-4 min-h-11 rounded-full bg-stone-900 px-5 text-sm text-cream">Scan a product</button>
          </div>
        )}
        {mine.map((p) => (
          <button key={p.id} onClick={() => onOpen(p.id)} className="min-h-11 rounded-2xl border border-stone-200 bg-white/40 p-4 text-left">
            <p className="kicker text-stone-400">{p.brand || categoryLabel(p.category)}</p>
            <p className="mt-2 font-serif text-xl text-stone-900">{p.name}</p>
            <p className="mt-3 font-mono text-xs text-stone-500">{p.status}{p.size ? ` · ${p.size}` : ''}</p>
          </button>
        ))}
      </div>

      {due.length > 0 && (
        <div className="mt-10">
          <p className="kicker text-stone-400">Restock</p>
          <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
            {due.map((p) => (
              <li key={p.id}>
                <button onClick={() => onOpen(p.id)} className="flex w-full items-baseline justify-between py-3 text-left">
                  <span className="font-serif text-lg">{p.name}</span>
                  <span className="font-mono text-xs text-stone-900">{p.status === 'sealed' ? 'marked' : p.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <p className="kicker text-stone-400">Routines</p>
          <div className="mt-3 flex gap-2">
            <input value={routineName} onChange={(e) => setRoutineName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRoutine()} placeholder="Morning vanity" className={line} />
            <button onClick={addRoutine} className="min-h-11 shrink-0 rounded-full bg-stone-900 px-4 text-sm text-cream">Add</button>
          </div>
          <ul className="mt-4 space-y-3">
            {routines.map((r) => (
              <li key={r.id} className="rounded-2xl border border-stone-200 p-4">
                <p className="font-serif text-lg">{r.name}</p>
                <p className="mt-1 text-xs text-stone-500">{(r.productIds || []).length} on the shelf</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {products.filter((p) => !p.wishlist).map((p) => {
                    const on = (r.productIds || []).includes(p.id)
                    return (
                      <button key={p.id} onClick={() => setRoutines((prev) => (Array.isArray(prev) ? prev : []).map((x) => x.id === r.id ? { ...x, productIds: on ? x.productIds.filter((id) => id !== p.id) : [...(x.productIds || []), p.id] } : x))} className={`min-h-11 rounded-full border px-3 text-[11px] ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-400'}`}>{p.name}</button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <p className="kicker text-stone-400">Wishlist</p>
          {wishes.length === 0 && <p className="mt-3 font-serif italic text-stone-400">Nothing waiting.</p>}
          <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
            {wishes.map((p) => (
              <li key={p.id}><button onClick={() => onOpen(p.id)} className="w-full py-3 text-left font-serif text-lg">{p.name}</button></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Scan({ onAdd }) {
  const videoRef = useRef(null)
  const [draft, setDraft] = useState(EMPTY)
  const [cameraOn, setCameraOn] = useState(false)
  const [looking, setLooking] = useState(false)
  const [note, setNote] = useState('')
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  useEffect(() => () => {
    const el = videoRef.current
    const stream = el && el.srcObject
    if (stream) stream.getTracks().forEach((t) => t.stop())
  }, [])

  const applyFound = (found, code) => {
    if (!found) { setNote('No public record. Write it in.'); set('barcode', code); return }
    setNote('')
    setDraft((d) => ({
      ...d,
      barcode: code,
      name: found.name || d.name,
      brand: found.brand || d.brand,
      size: found.size || d.size,
      ingredients: found.ingredients || d.ingredients,
      price: found.price || d.price,
    }))
  }

  const search = async (code) => {
    const clean = String(code || '').replace(/\D/g, '')
    if (clean.length < 8) { setNote('Enter the barcode, or the name.'); return }
    setLooking(true)
    const found = await lookupBarcode(clean)
    setLooking(false)
    applyFound(found, clean)
  }

  const startCamera = async () => {
    const native = await scanNative()
    if (typeof native === 'string') { set('barcode', native); search(native); return }
    if (!navigator.mediaDevices || !('BarcodeDetector' in window)) { setNote('This browser has no scanner. Type the code.'); return }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    const el = videoRef.current
    if (!el) return
    el.srcObject = stream
    setCameraOn(true)
    await el.play()
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] })
    let ticks = 0
    const tick = async () => {
      ticks += 1
      if (!el.srcObject || ticks > 80) return
      try {
        const codes = await detector.detect(el)
        if (codes && codes[0]) {
          stream.getTracks().forEach((t) => t.stop())
          el.srcObject = null
          setCameraOn(false)
          const code = codes[0].rawValue
          set('barcode', code)
          search(code)
          return
        }
      } catch { /* keep looking */ }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  const save = (wishlist) => {
    if (!draft.name.trim()) return
    tap()
    onAdd({
      id: uid(),
      ...draft,
      name: draft.name.trim(),
      wishlist,
      purchasedOn: draft.purchasedOn || new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <div className="mx-auto mt-8 max-w-xl">
      <video ref={videoRef} className={`mb-4 w-full border border-stone-200 ${cameraOn ? 'block' : 'hidden'}`} muted playsInline />
      <div className="flex flex-col gap-3">
        <button onClick={startCamera} className="min-h-11 rounded-full bg-stone-900 px-5 text-sm text-cream">Scan a barcode</button>
        <input value={draft.barcode} onChange={(e) => set('barcode', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(draft.barcode)} placeholder="Barcode" className={`${line} min-h-11 font-mono`} />
      </div>
      <p className="mt-3 min-h-5 text-xs text-stone-500">{looking ? 'Looking it up.' : note}</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name"><input value={draft.name} onChange={(e) => set('name', e.target.value)} className={line} /></Field>
        <Field label="Brand"><input value={draft.brand} onChange={(e) => set('brand', e.target.value)} className={line} /></Field>
        <Field label="Category">
          <select value={draft.category} onChange={(e) => set('category', e.target.value)} className={line}>
            {SHELF_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Size"><input value={draft.size} onChange={(e) => set('size', e.target.value)} className={line} /></Field>
        <Field label="Price"><input value={draft.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" className={`${line} font-mono`} /></Field>
        <Field label="Status">
          <select value={draft.status} onChange={(e) => set('status', e.target.value)} className={line}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Ingredients"><textarea value={draft.ingredients} onChange={(e) => set('ingredients', e.target.value)} className={`${line} mt-4 min-h-16`} /></Field>
      <div className="mt-6 flex gap-3">
        <button onClick={() => save(false)} className="min-h-11 rounded-full bg-stone-900 px-5 text-sm text-cream">Put it on the shelf</button>
        <button onClick={() => save(true)} className="min-h-11 rounded-full border border-stone-300 px-5 text-sm">Wishlist</button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="kicker mb-1.5 block text-stone-400">{label}</span>
      {children}
    </label>
  )
}

function Ledger({ product, journal, onChange, onRemove, onJournal, onBack }) {
  const cpu = costPerUse(product)
  const [entry, setEntry] = useState({ note: '', repurchase: false, dropped: false })
  const fileRef = useRef(null)
  const addNote = async (file) => {
    let photoPath = ''
    if (file) {
      const path = await store.uploadResultPhoto(file)
      photoPath = path || ''
    }
    if (!entry.note.trim() && !photoPath) return
    onJournal({
      id: uid(),
      productId: product.id,
      date: new Date().toISOString().slice(0, 10),
      note: entry.note.trim(),
      photoPath,
      repurchase: entry.repurchase,
      dropped: entry.dropped,
    })
    if (entry.dropped) onChange({ dropped: true })
    if (entry.repurchase) onChange({ restock: true })
    setEntry({ note: '', repurchase: false, dropped: false })
  }
  return (
    <div className="mx-auto mt-8 max-w-xl">
      <button onClick={onBack} className="kicker text-stone-400">Back to the shelf</button>
      <p className="kicker mt-4 text-stone-400">{product.brand || categoryLabel(product.category)}</p>
      <h2 className="font-serif text-4xl text-stone-900">{product.name}</h2>
      <p className="mt-2 font-mono text-sm text-stone-500">{money(product.price)}{cpu != null ? ` · ${money(cpu)} / use` : ''}</p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Field label="Status">
          <select value={product.status} onChange={(e) => onChange({ status: e.target.value })} className={line}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Uses"><input value={product.uses} onChange={(e) => onChange({ uses: e.target.value })} inputMode="numeric" className={`${line} font-mono`} /></Field>
        <Field label="Opened"><input type="date" value={product.openedOn || ''} onChange={(e) => onChange({ openedOn: e.target.value, status: product.status === 'sealed' ? 'opened' : product.status })} className={line} /></Field>
        <Field label="Expires"><input type="date" value={product.expiresOn || ''} onChange={(e) => onChange({ expiresOn: e.target.value })} className={line} /></Field>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-stone-600">{product.size}{product.ingredients ? ` · ${product.ingredients}` : ''}</p>
      <div className="mt-4 flex gap-4 text-sm">
        <button onClick={() => onChange({ restock: !product.restock })} className={product.restock ? 'text-stone-900' : 'text-stone-400'}>Restock</button>
        <button onClick={() => onChange({ wishlist: !product.wishlist })} className={product.wishlist ? 'text-stone-900' : 'text-stone-400'}>Wishlist</button>
        <button onClick={onRemove} className="text-stone-400">Remove</button>
      </div>
      <div className="mt-8 border-t border-stone-200 pt-6">
        <p className="kicker text-stone-400">Results</p>
        <textarea value={entry.note} onChange={(e) => setEntry({ ...entry, note: e.target.value })} placeholder="What changed" className={`${line} mt-3 min-h-16`} />
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <button onClick={() => setEntry({ ...entry, repurchase: !entry.repurchase })} className={entry.repurchase ? 'text-stone-900' : 'text-stone-400'}>Buy again</button>
          <button onClick={() => setEntry({ ...entry, dropped: !entry.dropped })} className={entry.dropped ? 'text-stone-900' : 'text-stone-400'}>Drop it</button>
          <button onClick={() => fileRef.current && fileRef.current.click()} className="text-stone-500">Photo</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) addNote(f); e.target.value = '' }} />
          <button onClick={() => addNote(null)} className="min-h-11 rounded-full bg-stone-900 px-5 text-sm text-cream">Save note</button>
        </div>
        <ul className="mt-4 divide-y divide-stone-200">
          {journal.map((j) => (
            <li key={j.id} className="py-3 text-sm">
              <p className="font-mono text-[11px] text-stone-400">{j.date}{j.photoPath ? ' · photo filed' : ''}</p>
              <p className="mt-1 text-stone-700">{j.note}</p>
              <p className="text-xs text-stone-400">{j.repurchase ? 'Buy again. ' : ''}{j.dropped ? 'Dropped.' : ''}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Spend({ products, journal, onOpen }) {
  const month = new Date().toISOString().slice(0, 7)
  const report = spendReport(products, month)
  return (
    <div className="mx-auto mt-8 grid max-w-4xl gap-10 md:grid-cols-2">
      <section>
        <p className="kicker text-stone-400">This month</p>
        <p className="mt-2 font-serif text-5xl text-stone-900">{money(report.total)}</p>
        <ul className="mt-6 space-y-3">
          {report.byCategory.map((c) => (
            <li key={c.id}>
              <div className="flex justify-between text-sm"><span>{c.label}</span><span className="font-mono">{money(c.total)}</span></div>
              <div className="mt-1 h-px bg-[#C4A46A]" style={{ width: report.total ? `${Math.max(8, (c.total / report.total) * 100)}%` : 0 }} />
            </li>
          ))}
        </ul>
        <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
          {report.perProduct.map((p) => (
            <li key={p.id}>
              <button onClick={() => onOpen(p.id)} className="flex w-full items-baseline justify-between py-3 text-left">
                <span className="font-serif text-lg">{p.name}</span>
                <span className="font-mono text-xs">{money(p.price)}{p.costPerUse != null ? ` · ${money(p.costPerUse)}/use` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <p className="kicker text-stone-400">Results</p>
        {journal.length === 0 && <p className="mt-3 font-serif italic text-stone-400">Notes and photos gather here.</p>}
        <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
          {journal.map((j) => {
            const product = products.find((p) => p.id === j.productId)
            return (
              <li key={j.id} className="py-3">
                <button onClick={() => product && onOpen(product.id)} className="text-left">
                  <p className="font-serif text-lg">{product ? product.name : 'A product'}</p>
                  <p className="text-sm text-stone-600">{j.note}</p>
                  <p className="font-mono text-[11px] text-stone-400">{j.date}{j.repurchase ? ' · buy again' : ''}{j.dropped ? ' · dropped' : ''}</p>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export function ShelfGlance({ onOpen }) {
  const [raw] = useLocalStorage('mos:shelf', [])
  const month = new Date().toISOString().slice(0, 7)
  const report = spendReport(raw, month)
  const due = nudges(raw)
  const held = normalizeProducts(raw).filter((p) => !p.wishlist).length
  return (
    <button onClick={onOpen} className="mb-8 grid w-full grid-cols-3 overflow-hidden rounded-2xl border border-stone-200 text-left">
      {[
        [String(held), 'On the shelf'],
        [money(report.total), 'This month'],
        [String(due.length), 'To restock'],
      ].map(([n, label]) => (
        <span key={label} className="border-r border-stone-200 px-4 py-4 last:border-r-0">
          <span className="block font-serif text-3xl text-stone-900">{n}</span>
          <span className="kicker mt-1 block text-stone-400">{label}</span>
        </span>
      ))}
    </button>
  )
}
