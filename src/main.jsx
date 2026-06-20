import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import * as store from './lib/fileStore'
import './index.css'

// Prime the cache (sync) and restore any connected folder (async).
store.init()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
