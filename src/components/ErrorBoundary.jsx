import React from 'react'
import * as store from '../lib/dataStore'

// Catches any render error so the app never shows a blank white screen. Offers a
// reload, and a "reset" that clears the remembered section/subpage in case a
// specific view is failing — then reloads onto a clean Today.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false, message: '', stack: '' }
  }

  static getDerivedStateFromError(error) {
    return { failed: true, message: String(error && error.message || error), stack: String(error && error.stack || '') }
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error('[mos] app crashed', error)
  }

  reset = () => {
    try {
      store.set('mos:active', 'today')
      store.set('mos:subpages', {})
      store.set('mos:sidebar:collapsed', false)
    } catch { /* ignore */ }
    setTimeout(() => window.location.reload(), 700)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="w-full max-w-lg text-center">
          <h1 className="font-serif italic text-3xl text-stone-900">Something didn&apos;t load right.</h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-500">
            Your data is safe. This is usually fixed by reloading.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button onClick={() => window.location.reload()} className="bg-stone-900 px-5 py-2.5 text-sm text-cream hover:bg-stone-700">Reload</button>
            <button onClick={this.reset} className="border border-stone-300 px-5 py-2.5 text-sm text-stone-600 hover:border-stone-500">Reset to Today</button>
          </div>
        </div>
      </div>
    )
  }
}
