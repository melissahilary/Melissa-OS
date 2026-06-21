import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseFor } from '../lib/cycle'
import { dateKey } from '../lib/date'
import SectionTitle from './shared/SectionTitle'
import { DayNav, DayHeader } from './shared/DayNav'
import CardCollection from './shared/CardCollection'

const opt = (arr) => arr.map((x) => ({ id: x, label: x }))

const FREQ_OPTS = opt(['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'As Needed'])
const STATUS_OPTS = opt(['On track', 'Building', 'Maintaining', 'Needs work', 'Paused'])

const PROTOCOL_CATEGORIES = opt([
  'Internal Health',
  'Balance & Coordination',
  'Strength Training',
  'Cardiovascular',
  'Mobility & Flexibility',
  'Pelvic Floor',
  'Breath & Nervous System',
  'Recovery & Lymphatic',
  'Hormonal & Cycle',
])

const PROTOCOL_FIELDS = [
  { key: 'notes', label: 'Notes / description', type: 'textarea' },
  { key: 'frequency', label: 'Frequency', type: 'select', options: FREQ_OPTS },
  { key: 'status', label: 'Progress / status', type: 'select', options: STATUS_OPTS },
]

const PRACTICE_FIELDS = [
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'perWeek', label: 'How often per week', type: 'text' },
  { key: 'lastDone', label: 'Last done', type: 'date' },
]

export default function Workout({ cycleConfig = {}, setCycleConfig = () => {}, subPage = 'schedule' }) {
  const today = new Date()
  const [selected, setSelected] = useState(new Date())
  const key = dateKey(selected)
  const phase = phaseFor(selected, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
  const todayPhase = phaseFor(today, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
  const [sessions, setSessions] = useLocalStorage('mos:workout:sessions', {})

  return (
    <div>
      <SectionTitle kicker="02 · The body" title="Health & Fitness." />

      {subPage === 'schedule' && (
        <>
          <DayNav selected={selected} setSelected={setSelected} today={today} />
          <DayHeader date={selected} phase={phase} />
          <section className="border-t border-stone-200 pt-7">
            <label className="kicker text-stone-500 mb-3 block">Today's session</label>
            <input
              value={sessions[key] || ''}
              onChange={(e) => setSessions((p) => ({ ...p, [key]: e.target.value }))}
              placeholder="A workout, or 'rest day'"
              className="w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
            />
          </section>
        </>
      )}

      {subPage === 'protocols' && (
        <CardCollection
          storageKey="mos:workout:protocols"
          noun="protocol"
          previewKey="notes"
          chipKeys={['frequency', 'status']}
          fields={PROTOCOL_FIELDS}
          filter={{ key: 'category', label: 'Category', options: PROTOCOL_CATEGORIES }}
        />
      )}

      {subPage === 'practices' && (
        <CardCollection
          storageKey="mos:workout:practices"
          noun="practice"
          previewKey="notes"
          chipKeys={['perWeek', 'lastDone']}
          fields={PRACTICE_FIELDS}
        />
      )}

      {subPage === 'cycle' && (
        <section className="border-t border-stone-200 pt-7">
          <h3 className="kicker text-stone-500 mb-4">Cycle tracking</h3>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <label className="kicker text-stone-400 mb-1.5 block">Last period started</label>
              <input
                type="date"
                value={cycleConfig.lastPeriodStart || ''}
                onChange={(e) => setCycleConfig({ ...cycleConfig, lastPeriodStart: e.target.value })}
                className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
              />
            </div>
            <div>
              <label className="kicker text-stone-400 mb-1.5 block">Cycle length</label>
              <input
                type="number"
                min="20"
                max="45"
                value={cycleConfig.cycleLength || 28}
                onChange={(e) => setCycleConfig({ ...cycleConfig, cycleLength: Number(e.target.value) })}
                className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
              />
            </div>
          </div>
          {todayPhase ? (
            <div
              className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 text-xs"
              style={{ backgroundColor: todayPhase.color, color: todayPhase.ink }}
            >
              <span className="font-medium">{todayPhase.name}</span>
              <span className="opacity-70">· Day {todayPhase.cycleDay}</span>
            </div>
          ) : (
            <p className="mt-6 text-sm text-stone-400">Set your last period to see your current phase.</p>
          )}
        </section>
      )}
    </div>
  )
}
