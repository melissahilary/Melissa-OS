import React from 'react'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'

export default function Skincare({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="skincare" cycleConfig={cycleConfig} noun="Step" />
    : <CategoryWeekly category="skincare" noun="Step" />
}
