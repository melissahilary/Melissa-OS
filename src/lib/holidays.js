// A light set of US holidays for calendar overlay. Keyed by MM-DD so they
// recur each year without maintenance.
export const HOLIDAYS = {
  '01-01': "New Year's Day",
  '02-14': "Valentine's Day",
  '03-17': "St. Patrick's Day",
  '07-04': 'Independence Day',
  '10-31': 'Halloween',
  '11-11': 'Veterans Day',
  '12-24': 'Christmas Eve',
  '12-25': 'Christmas Day',
  '12-31': "New Year's Eve",
}

export function holidayFor(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return HOLIDAYS[`${m}-${d}`] || null
}
