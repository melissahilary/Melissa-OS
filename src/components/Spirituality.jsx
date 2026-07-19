import React from 'react'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'

export default function Spirituality({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="spirituality" cycleConfig={cycleConfig} noun="Practice" />
    : <CategoryWeekly category="spirituality" noun="Practice" />
}
