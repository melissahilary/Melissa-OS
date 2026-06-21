import React, { useMemo, useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

const uid = () => Math.random().toString(36).slice(2, 10)
const labelOf = (facet, id) => (facet.options.find((o) => o.id === id) || {}).label || id

/**
 * CardCollection — a Google Keep style card grid + detail modal, visually
 * identical to the Recipes page. Configurable per use:
 *   storageKey  localStorage key
 *   noun        singular noun for the "+ New X" button / empty states
 *   fields      modal fields: { key, label, type: text|textarea|date|select, options? }
 *   previewKey  which field shows as the card body preview
 *   chipKeys    fields rendered as small chips on the card
 *   filter      optional single-select facet { key, label, options } → filter bar + modal select
 */
export default function CardCollection({ storageKey, noun, fields, previewKey, chipKeys = [], filter }) {
  const [items, setItems] = useLocalStorage(storageKey, [])
  const [activeFilter, setActiveFilter] = useState(null)
  const [editing, setEditing] = useState(null)

  const blank = () => {
    const base = { id: uid(), title: '' }
    fields.forEach((f) => { base[f.key] = '' })
    if (filter) base[filter.key] = ''
    return base
  }

  const save = (item) => {
    setItems((prev) => {
      const exists = prev.some((r) => r.id === item.id)
      return exists ? prev.map((r) => (r.id === item.id ? item : r)) : [...prev, item]
    })
    setEditing(null)
  }
  const remove = (id) => {
    setItems((prev) => prev.filter((r) => r.id !== id))
    setEditing(null)
  }

  const visible = useMemo(() => {
    if (!filter || !activeFilter) return items
    return items.filter((r) => r[filter.key] === activeFilter)
  }, [items, filter, activeFilter])

  return (
    <section className="mb-10">
      <div className="mb-2 flex justify-end">
        <span className="text-sm text-stone-400">{items.length} on file</span>
      </div>
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setEditing(blank())}
          className="flex items-center gap-1.5 bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700"
        >
          <Plus size={15} /> New {noun}
        </button>
      </div>

      {filter && (
        <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-stone-100 py-3">
          <FilterTag label="All" on={!activeFilter} onClick={() => setActiveFilter(null)} />
          {filter.options.map((o) => (
            <FilterTag
              key={o.id}
              label={o.label}
              on={activeFilter === o.id}
              onClick={() => setActiveFilter(activeFilter === o.id ? null : o.id)}
            />
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">No {noun}s yet.</p>
      ) : visible.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">Nothing matches that filter.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <Card key={r.id} item={r} previewKey={previewKey} chipKeys={chipKeys} fields={fields} filter={filter} onOpen={() => setEditing(r)} />
          ))}
        </div>
      )}

      {editing && (
        <Modal
          noun={noun}
          fields={fields}
          filter={filter}
          item={editing}
          isNew={!items.some((r) => r.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </section>
  )
}

function FilterTag({ label, on, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${
        on ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-700'
      }`}
      style={on ? { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: '#a8a29e' } : undefined}
    >
      {label}
    </button>
  )
}

function Card({ item, previewKey, chipKeys, fields, filter, onOpen }) {
  const preview = (item[previewKey] || '').trim()
  const chips = []
  if (filter && item[filter.key]) chips.push(labelOf(filter, item[filter.key]))
  chipKeys.forEach((k) => {
    const f = fields.find((x) => x.key === k)
    const v = item[k]
    if (v != null && String(v).trim()) chips.push(`${f ? f.label : k}: ${v}`)
  })
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-start border border-stone-200 bg-white/40 p-4 text-left transition-shadow hover:shadow-md"
    >
      <h3 className="font-serif text-xl text-stone-900">{item.title || 'Untitled'}</h3>
      {preview ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-500">{preview}</p>
      ) : (
        <p className="mt-2 text-sm italic text-stone-300">No notes yet.</p>
      )}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c, i) => (
            <span key={i} className="border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">{c}</span>
          ))}
        </div>
      )}
    </button>
  )
}

function FieldEditor({ field, value, onChange }) {
  const labelCls = 'kicker text-stone-400 mb-2 block'
  const lineCls = 'w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900'
  return (
    <div>
      <span className={labelCls}>{field.label}</span>
      {field.type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[120px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
        />
      ) : field.type === 'select' ? (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={lineCls}>
          <option value="">—</option>
          {field.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ) : (
        <input type={field.type === 'date' ? 'date' : 'text'} value={value || ''} onChange={(e) => onChange(e.target.value)} className={lineCls} />
      )}
    </div>
  )
}

function Modal({ noun, fields, filter, item, isNew, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(() => ({ ...item }))
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={`${noun.charAt(0).toUpperCase() + noun.slice(1)} name`}
            autoFocus
            className="w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none"
          />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-6 py-5 space-y-6">
          {filter && (
            <FieldEditor
              field={{ key: filter.key, label: filter.label, type: 'select', options: filter.options }}
              value={draft[filter.key]}
              onChange={(v) => set(filter.key, v)}
            />
          )}
          {fields.map((f) => (
            <FieldEditor key={f.key} field={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? (
            <span />
          ) : (
            <button onClick={() => onDelete(draft.id)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-phase-menstrual">
              <Trash2 size={15} /> Delete
            </button>
          )}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button
              onClick={() => onSave({ ...draft, title: (draft.title || '').trim() || 'Untitled' })}
              className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
