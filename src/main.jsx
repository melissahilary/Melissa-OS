import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './components/AuthGate.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import ReferralLanding, { referralUsername } from './components/ReferralLanding.jsx'
import holdScroll from './lib/holdScroll'
import './index.css'

// Whatever opens over the page, the page stays where she left it.
holdScroll()

const refUser = referralUsername()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {refUser !== null ? (
        <ReferralLanding username={refUser} />
      ) : (
        <AuthGate>
          <App />
        </AuthGate>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
)
