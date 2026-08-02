import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route} from 'react-router'
import About from './About'
import App from './App'
import Settings from './Settings'
import './index.css'
import { HeliaProvider } from '@/provider/HeliaProvider'

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
  {/* <React.StrictMode> */}
  <Routes>
    <Route path="/" element={<HeliaProvider><App /></HeliaProvider>} />
    <Route path="/about" element={<About />} />
    <Route path="/settings" element={<HeliaProvider><Settings /></HeliaProvider>} />
  </Routes>
    {/* <HeliaProvider>
      <App />
    </HeliaProvider> */}
  {/* </React.StrictMode> */}
  </HashRouter>
)
