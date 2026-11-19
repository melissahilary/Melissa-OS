import React, { useState } from 'react'
import Logo from './shared/Logo'
import * as store from '../lib/dataStore'
import { tap } from '../lib/haptics'

const line = 'w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900'

export default function FirstRun() {
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [cycleOptIn, setCycle] = useState(false)
  const [missing, setMissing] = useState(false)

  const save = () => {
    const firstName = name.trim()
    if (!firstName) { setMissing(true); return }
    tap()
    store.set('mos:profile', {
      firstName,
      lastName: '',
      birthday,
      birthTime,
      birthPlace: birthPlace.trim(),
      lat: null,
      lon: null,
      cycleOptIn,
      setupComplete: true,
    })
    if (cycleOptIn) store.fillBlank('mos:settings:cycle', { lastPeriodStart: '', cycleLength: 28 })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Logo size="signin" />
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); save() }}
          className="rounded-2xl border border-stone-200 bg-white/60 px-6 py-8"
        >
          <p className="kicker text-stone-400">Your book</p>
          <h1 className="mt-2 font-serif text-3xl italic text-stone-900">A name, and you are in.</h1>
          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="kicker mb-1.5 block text-stone-400">Name</span>
              <input value={name} onChange={(e) => { setName(e.target.value); setMissing(false) }} className={line} autoFocus />
              {missing && <p className="mt-2 text-xs text-stone-500">The book needs a name.</p>}
            </label>
            <label className="block">
              <span className="kicker mb-1.5 block text-stone-400">Birthday, if you want it</span>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={line} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="kicker mb-1.5 block text-stone-400">Birth time</span>
                <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} className={line} />
              </label>
              <label className="block">
                <span className="kicker mb-1.5 block text-stone-400">Birth place</span>
                <input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className={line} />
              </label>
            </div>
            <button type="button" onClick={() => setCycle((v) => !v)} className="flex min-h-11 items-center gap-3 text-left text-sm text-stone-700">
              <span className={`inline-block h-4 w-4 rounded-full border ${cycleOptIn ? 'border-stone-900 bg-stone-900' : 'border-stone-300'}`} />
              Track my cycle
            </button>
          </div>
          <button type="submit" className="mt-8 min-h-11 w-full rounded-full bg-stone-900 text-sm text-cream hover:bg-stone-700">Open my book</button>
        </form>
      </div>
    </div>
  )
}
