// A light tap for a committed action. Skipped when motion is reduced, and
// silent in the browser. The book stays light; there is no dark theme.
export async function tap() {
  try {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cap = typeof window !== 'undefined' ? window.Capacitor : null
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
    }
  } catch {
    /* haptics are optional */
  }
}
