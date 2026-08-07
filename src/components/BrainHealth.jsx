import React from 'react'
import CategoryCalendar from './shared/CategoryCalendar'
import CategoryWeekly from './shared/CategoryWeekly'

// Brain Health — cognition, neuro care, focus, sleep-for-the-brain. Its own
// pillar, distinct from Mindset (mood, journaling, influences). Uses the shared
// weekly/monthly category views like the other care pillars.
export default function BrainHealth({ subPage, cycleConfig }) {
  return subPage === 'monthly'
    ? <CategoryCalendar category="brainhealth" cycleConfig={cycleConfig} noun="Practice" />
    : <CategoryWeekly category="brainhealth" noun="Practice" />
}
