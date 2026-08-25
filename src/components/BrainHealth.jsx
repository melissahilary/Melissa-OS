import React from 'react'
import { Brain } from 'lucide-react'
import CategorySchedule from './shared/CategorySchedule'
import RoutineBuilder from './shared/RoutineBuilder'
import { CategoryLog, CategoryShelf } from './shared/LogShelf'

// Cognitive practice types.
const MIND_TYPES = ['Meditation', 'Breathwork', 'Reading', 'Language', 'Memory training', 'Music', 'Puzzle / logic', 'Digital sunset']

export default function BrainHealth({ subPage, cycleConfig }) {
  if (subPage === 'scans') return <CategoryLog storeKey="mos:brainhealth:scans" addNoun="scan" blurb="The pictures and readings of your brain — dated, with results kept." suggestions={['qEEG brain map', 'MRI', 'Sleep study', 'Cognitive assessment', 'Neurofeedback session']} place={{ label: 'Where', placeholder: 'clinic · provider' }} fields={[{ key: 'results', label: 'Results', placeholder: 'findings to remember' }]} />
  if (subPage === 'wearables') return <CategoryShelf storeKey="mos:brainhealth:wearables" blurb="What you wear that watches over your mind — sleep, HRV, focus." suggestions={['Oura ring', 'Whoop', 'Apple Watch', 'Muse headband', 'CGM']} notePlaceholder="what it tracks · what you watch for" />
  if (subPage === 'practices') return <RoutineBuilder storeKey="mos:brainhealth:practices" Icon={Brain} intro="The daily work of a sharp, calm mind." types={MIND_TYPES} productLabel="Details" />
  return <CategorySchedule category="brainhealth" noun="Item" cycleConfig={cycleConfig} />
}
