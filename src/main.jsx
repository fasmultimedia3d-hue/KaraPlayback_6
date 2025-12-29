import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'       // 👈 ESTA LÍNEA ES CLAVE
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

