import React from 'react'
import { Sun } from 'lucide-react'
import CategorySchedule from './shared/CategorySchedule'
import RoutineBuilder from './shared/RoutineBuilder'

// Practice types — the forms devotion takes.
const PRACTICE_TYPES = ['Prayer', 'Sabbath', 'Meditation', 'Scripture / study', 'Gratitude', 'Service', 'Fasting', 'Worship']

export default function Spirituality({ subPage, cycleConfig }) {
  if (subPage === 'practices') return <RoutineBuilder storeKey="mos:spirituality:practices" Icon={Sun} intro="What you keep holy, and how often — the practices that hold you." types={PRACTICE_TYPES} productLabel="Details" />
  return <CategorySchedule category="spirituality" noun="Practice" cycleConfig={cycleConfig} />
}
