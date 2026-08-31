// ISO week number — the week a Thursday falls in decides the year it belongs to,
// which is why the last days of December can be week 1 of the year after.
export const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t - jan1) / 86400000 + 1) / 7)
}
