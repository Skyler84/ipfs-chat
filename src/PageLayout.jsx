import React from 'react'

function PageLayout ({ children, renderFooter }) {
  return (
    <div className='pageShell'>
      <main className='pageContent'>{children}</main>
      <footer className='pageFooter'>
        {typeof renderFooter === 'function'
          ? renderFooter()
          : <small>IPFS Chat</small>}
      </footer>
    </div>
  )
}

export default PageLayout
