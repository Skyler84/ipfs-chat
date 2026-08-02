/* eslint-disable no-console */

import { unixfs } from '@helia/unixfs'
import { createHelia, heliaDefaults, libp2pDefaults } from 'helia'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { gossipsub } from '@libp2p/gossipsub'
// import { floodsub } from '@libp2p/floodsub'
import { identify } from '@libp2p/identify'
import { createLibp2p } from 'libp2p'
import PropTypes from 'prop-types'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'

import {
  React,
  useEffect,
  useState,
  useCallback,
  createContext
} from 'react'

export const HeliaContext = createContext({
  helia: null,
  fs: null,
  error: false,
  starting: true
})

export const HeliaProvider = ({ children }) => {
  const [helia, setHelia] = useState(null)
  const [fs, setFs] = useState(null)
  const [starting, setStarting] = useState(true)
  const [error, setError] = useState(null)

  const startHelia = useCallback(async () => {
    if (helia) {
      console.info('helia already started')
    } else if (window.helia) {
      console.info('found a windowed instance of helia, populating ...')
      setHelia(window.helia)
      setFs(unixfs(helia))
      setStarting(false)
    } else {
      try {
        console.info('Starting Helia')
        var libp2p_options = libp2pDefaults()
        // const helia = await createHelia()
        const libp2p = await heliaDefaults({
          libp2p: {
            addresses: {
              listen: [
                '/p2p-circuit',
                '/webrtc'
              ]
            },
            // a connection encrypter is necessary to dial the relay
            connectionEncrypters: [noise()],
            // a stream muxer is necessary to dial the relay
            streamMuxers: [yamux()],
            transports: [
              webSockets(),
              webRTC(),
              webRTCDirect(),
              circuitRelayTransport(),
              webTransport()
            ],
            services: {
              ...libp2p_options.services,
              identify: identify(),
              pubsub: gossipsub(),
            },
            connectionGater: {
              denyDialMultiaddr: () => {
                // by default we refuse to dial local addresses from browsers since they
                // are usually sent by remote peers broadcasting undialable multiaddrs and
                // cause errors to appear in the console but in this example we are
                // explicitly connecting to a local node so allow all addresses
                return false
              }
            },
          }
        })
        console.log('libp2p', libp2p)
        const helia = await createHelia(libp2p)
        // const helia = await createHelia({ libp2p })
        setHelia(helia)
        setFs(unixfs(helia))
        setStarting(false)
        console.info('Helia started')
        console.log(helia)
      } catch (e) {
        console.error(e)
        setError(true)
      }
    }
  }, [])

  useEffect(() => {
    startHelia()
  }, [])

  return (
    <HeliaContext.Provider
      value={{
        helia,
        fs,
        error,
        starting
      }}
    >{children}
    </HeliaContext.Provider>
  )
}

HeliaProvider.propTypes = {
  children: PropTypes.any
}
