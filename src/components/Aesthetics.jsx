import React from 'react'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'

export default function Aesthetics({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="aesthetics" cycleConfig={cycleConfig} noun="Treatment" />
    : <CategoryWeekly category="aesthetics" noun="Treatment" />
}
