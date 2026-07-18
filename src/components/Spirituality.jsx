import React from 'react'
import RitualSchedule from './RitualSchedule'
import CategoryCalendar from './shared/CategoryCalendar'

export default function Spirituality({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="spirituality" cycleConfig={cycleConfig} noun="Practice" />
    : <RitualSchedule category="spirituality" noun="Practice" placeholder="Morning prayer" />
}
