import React from 'react'
import RitualSchedule from './RitualSchedule'
import CategoryCalendar from './shared/CategoryCalendar'

export default function Skincare({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="skincare" cycleConfig={cycleConfig} noun="Step" />
    : <RitualSchedule category="skincare" noun="Step" placeholder="Vitamin C serum" />
}
