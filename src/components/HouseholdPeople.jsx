import React, { useState } from 'react'
import { Check } from 'lucide-react'
import * as store from '../lib/dataStore'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useActiveProfileId } from '../hooks/useHouseName'
import { newMemberId, normalizeMembers, OWNER_ID } from '../lib/scope'

const input = 'w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900'

// People who keep a planner inside this one account. The sign-in stays yours;
// opening someone else only changes which rows the house is reading.
export default function HouseholdPeople() {
  const [raw, setRaw] = useLocalStorage('mos:household', [])
  const members = normalizeMembers(raw)
  const active = useActiveProfileId()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = newMemberId()
    setRaw([...members, { id, name: trimmed, note: note.trim() }])
    store.setActiveProfile(id)
    setName('')
    setNote('')
  }

  const remove = (id) => {
    setRaw(members.filter((m) => m.id !== id))
    store.forgetProfile(id)
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white/40 p-6 md:p-7">
      <h2 className="font-serif italic text-2xl text-stone-900">The house.</h2>
      <p className="mt-1 text-sm text-stone-500">
        One sign-in, a planner for each person. Yours keeps every page already written. Theirs starts clear.
      </p>

      <ul className="mt-6 divide-y divide-stone-100">
        <li className="flex items-center gap-3 py-3">
          <button onClick={() => store.setActiveProfile(OWNER_ID)} className="min-w-0 flex-1 text-left">
            <span className="block text-sm text-stone-900">You</span>
            <span className="text-xs text-stone-400">The original planner</span>
          </button>
          {active === OWNER_ID && <Check size={16} className="text-stone-900" />}
        </li>
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <button onClick={() => store.setActiveProfile(m.id)} className="min-w-0 flex-1 text-left">
              <span className="block text-sm text-stone-900">{m.name}</span>
              <span className="text-xs text-stone-400">{m.note || 'Their planner'}</span>
            </button>
            {active === m.id && <Check size={16} className="shrink-0 text-stone-900" />}
            <button onClick={() => remove(m.id)} className="text-xs text-stone-400 hover:text-stone-800">Remove</button>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="kicker mb-1.5 block text-stone-400">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Their name" className={input} />
        </label>
        <label className="block">
          <span className="kicker mb-1.5 block text-stone-400">Place in the house</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Partner, child, guest" className={input} />
        </label>
      </div>
      <button onClick={add} className="mt-5 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream hover:bg-stone-700">Add a person</button>
    </section>
  )
}
