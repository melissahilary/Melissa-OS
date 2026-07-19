import React from 'react'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'

export default function Bodycare({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="body" cycleConfig={cycleConfig} noun="Treatment" />
    : <CategoryWeekly category="body" noun="Treatment" />
}
