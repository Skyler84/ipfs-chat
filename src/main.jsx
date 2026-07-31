import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route} from 'react-router'
import About from './About'
import App from './App'
import PageLayout from './PageLayout'
import './index.css'
import { HeliaProvider } from '@/provider/HeliaProvider'

const renderFooter = () => (
  <small>
    <a href="/#/">IPFS Chat</a> | <a href="/#/about">About</a> | <a href='https://github.com/Skyler84' target='_blank' rel='noreferrer'>GitHub</a>
  </small>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <PageLayout renderFooter={renderFooter}>
      <Routes>
        <Route path="/" element={<HeliaProvider><App /></HeliaProvider>} />
        <Route path="/about" element={<About />} />
      </Routes>
    </PageLayout>
  </HashRouter>
)
