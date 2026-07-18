import React from 'react'
import RitualSchedule from './RitualSchedule'
import CategoryCalendar from './shared/CategoryCalendar'

export default function Aesthetics({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="aesthetics" cycleConfig={cycleConfig} noun="Treatment" />
    : <RitualSchedule category="aesthetics" noun="Treatment" placeholder="LED mask" />
}
