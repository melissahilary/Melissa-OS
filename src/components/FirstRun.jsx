import React, { useState } from 'react'
import { APP_NAME } from '../lib/brand'
import * as store from '../lib/dataStore'

const line = 'w-full border-0 border-b border-[#C4A46A] bg-transparent pb-1.5 text-sm text-stone-900 outline-none'

// The first screen after a new account's first successful read.
export default function FirstRun() {
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [cycleOptIn, setCycle] = useState(false)

  const save = () => {
    const firstName = name.trim()
    if (!firstName) return
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
      <div className="w-full max-w-md border border-[#C4A46A] bg-cream px-8 py-10">
        <p className="kicker text-stone-400">A new book</p>
        <h1 className="mt-2 font-serif text-4xl text-stone-900">{APP_NAME}</h1>
        <p className="mt-3 font-serif text-lg italic text-stone-500">Your name opens it. The rest can wait.</p>
        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="kicker mb-1.5 block text-stone-400">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={line} />
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
          <button type="button" onClick={() => setCycle((v) => !v)} className="flex items-center gap-3 text-left text-sm text-stone-700">
            <span className={`inline-block h-3.5 w-3.5 border ${cycleOptIn ? 'border-[#6B2B2B] bg-[#6B2B2B]' : 'border-stone-400'}`} />
            Track my cycle
          </button>
        </div>
        <button onClick={save} className="mt-8 bg-[#6B2B2B] px-6 py-3 text-sm text-cream">Open my book</button>
      </div>
    </div>
  )
}
