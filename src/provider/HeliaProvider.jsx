/* eslint-disable no-console */

import { unixfs } from '@helia/unixfs'
import { createHelia, heliaDefaults, libp2pDefaults } from 'helia'
import PropTypes from 'prop-types'

import { IDBDatastore } from 'datastore-idb'
import { IDBBlockstore } from 'blockstore-idb'

import { Libp2pInitOptions } from '@/config/libp2p.ts'

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

const DIAL_TIMEOUT_DEFAULT_MS = 30000

export const HeliaProvider = ({ children }) => {
  const [helia, setHelia] = useState(null)
  const [fs, setFs] = useState(null)
  const [starting, setStarting] = useState(true)
  const [error, setError] = useState(null)

  const getConfiguredDialTimeout = useCallback(() => {
    if (typeof window === 'undefined') {
      return DIAL_TIMEOUT_DEFAULT_MS
    }

    try {
      const savedSettings = localStorage.getItem('ipfs-chat-settings')
      if (!savedSettings) {
        return DIAL_TIMEOUT_DEFAULT_MS
      }

      const parsedSettings = JSON.parse(savedSettings)
      const parsedDialTimeout = Number(parsedSettings?.dialTimeoutMs)

      return Number.isFinite(parsedDialTimeout) && parsedDialTimeout > 0
        ? parsedDialTimeout
        : DIAL_TIMEOUT_DEFAULT_MS
    } catch (error) {
      console.warn('Failed to read dial timeout setting', error)
      return DIAL_TIMEOUT_DEFAULT_MS
    }
  }, [])

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

        // const helia_datastore = new IDBDatastore('helia')
        // await helia_datastore.open()

        // const helia_blockstore = new IDBBlockstore('helia-blockstore')
        // await helia_blockstore.open()

        const dialTimeoutMs = getConfiguredDialTimeout()
        const libp2pInitOptions = await Libp2pInitOptions(libp2p_options, dialTimeoutMs)
        libp2pInitOptions.connectionManager.dialTimeout = 30_000 // 30 seconds

        const heliaInit = await heliaDefaults({
          // datastore: helia_datastore,
          // blockstore: helia_blockstore,
          libp2p: libp2pInitOptions, // By getting Helia to initialise the libp2p instance, it will use the node ID from the datastore.
        })
        const helia = await createHelia(heliaInit)

        setHelia(helia)
        setFs(unixfs(helia))
        setStarting(false)
        console.info('Helia started')

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
