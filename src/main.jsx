import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './components/AuthGate.jsx'
import ReferralLanding, { referralUsername } from './components/ReferralLanding.jsx'
import './index.css'

const refUser = referralUsername()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {refUser !== null ? (
      <ReferralLanding username={refUser} />
    ) : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
  </React.StrictMode>,
)
