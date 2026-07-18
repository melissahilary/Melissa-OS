import React from 'react'
import RitualSchedule from './RitualSchedule'
import CategoryCalendar from './shared/CategoryCalendar'

export default function Bodycare({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="body" cycleConfig={cycleConfig} noun="Treatment" />
    : <RitualSchedule category="body" noun="Treatment" placeholder="Body scrub" />
}
