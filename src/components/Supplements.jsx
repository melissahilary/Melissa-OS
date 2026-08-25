import React, { useState } from 'react'
import { Pill } from 'lucide-react'
import { useActivities } from '../hooks/useActivities'
import { blankActivity } from '../lib/activities'
import ActivityForm from './shared/ActivityForm'
import { useRegisterAdd } from './shared/AddButton'

// ── Supplements — every capsule and powder in one place, grouped by the moment
// you take it. Dose lives on the row; tap to open the full editor.

const GROUPS = [
  { id: 'empty', label: 'Empty Stomach' },
  { id: 'breakfast', label: 'With Breakfast' },
  { id: 'lunch', label: 'With Lunch' },
  { id: 'dinner', label: 'With Dinner' },
  { id: 'bed', label: 'Before Bed' },
]
const groupOf = (slot) => (GROUPS.some((g) => g.id === slot) ? slot : 'breakfast')

export default function Supplements() {
  const { activities, add, update, remove } = useActivities()
  const [editing, setEditing] = useState(null)
  const supps = activities.filter((a) => a.type === 'supplement' && a.status !== 'archived')

  const newSupp = () => blankActivity('supplement', { details: { slot: 'breakfast', dose: '', unit: 'mg' } })
  useRegisterAdd(() => setEditing(newSupp()), [])
  const save = (a) => { if (activities.some((x) => x.id === a.id)) update(a.id, a); else add(a); setEditing(null) }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex flex-col items-center text-center">
        <Pill size={26} strokeWidth={1.25} className="text-stone-400" />
        <p className="mt-3 max-w-xs text-sm italic leading-relaxed text-stone-400">The stack — every supplement, at the moment it's taken. Tap one to edit dose and cadence.</p>
      </div>

      {supps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-200 py-14 text-center font-serif italic text-lg text-stone-400">No supplements yet — tap + to add your first.</p>
      ) : (
        <div className="space-y-7">
          {GROUPS.map((g) => {
            const items = supps.filter((a) => groupOf(a.details?.slot || 'breakfast') === g.id)
            if (!items.length) return null
            return (
              <div key={g.id}>
                <div className="mb-2 flex items-center gap-3">
                  <span className="kicker text-stone-400">{g.label}</span>
                  <span className="h-px flex-1 bg-stone-100" />
                  <span className="text-xs tabular-nums text-stone-300">{items.length}</span>
                </div>
                <div className="space-y-0.5">
                  {items.map((a) => (
                    <button key={a.id} onClick={() => setEditing(a)} className="flex w-full items-baseline gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/60">
                      <span className="flex-1 font-serif text-lg leading-tight text-stone-800">{a.title || 'Untitled'}</span>
                      {(a.details?.dose || '').trim() && <span className="text-xs tabular-nums text-stone-400">{a.details.dose}{a.details.unit ? ` ${a.details.unit}` : ''}</span>}
                      {a.frequency && a.frequency !== 'daily' && <span className="kicker text-stone-300">{a.frequency}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <ActivityForm
          activity={editing}
          isNew={!activities.some((x) => x.id === editing.id)}
          onSave={save}
          onDelete={() => { remove(editing.id); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
