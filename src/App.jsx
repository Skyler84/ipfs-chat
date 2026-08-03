import { React, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import Peer from './Peer'
import { useHelia } from '@/hooks/useHelia'
import { multiaddr } from '@multiformats/multiaddr'

const DEFAULT_CHAT_ROOM = 'helia-examples/chatroom'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function App () {
  const [connectedPeers, setConnectedPeers] = useState(0)
  const [chatStatus, setChatStatus] = useState('Waiting for Helia...')
  const [chatName, setChatName] = useState('')
  const [chatRoomInput, setChatRoomInput] = useState(DEFAULT_CHAT_ROOM)
  const [joinedRoom, setJoinedRoom] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [localPeerId, setLocalPeerId] = useState('')
  const [subscribedTopics, setSubscribedTopics] = useState([])
  const [topicSubscribers, setTopicSubscribers] = useState([])
  const [connectedPeerIds, setConnectedPeerIds] = useState([])
  const [connectedPeersDetail, setConnectedPeersDetail] = useState([])
  const [localPeerDetail, setLocalPeerDetail] = useState(null)
  const [showConnectedPeers, setShowConnectedPeers] = useState(false)
  const [chatDebugLog, setChatDebugLog] = useState([])
  const [dialMultiaddrInput, setDialMultiaddrInput] = useState('')
  const [dialStatus, setDialStatus] = useState('')
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showDebugLog, setShowDebugLog] = useState(false)
  const pubsubRef = useRef(null)
  const joinedRoomRef = useRef('')
  const seenIdsRef = useRef(new Set())
  const peerConnectionFirstSeenRef = useRef(new Map())
  const messageHandlerRef = useRef(null)
  const { helia, error, starting } = useHelia()

  const pushDebugLog = useCallback((line) => {
    const timestamp = new Date().toLocaleTimeString()
    setChatDebugLog((previous) => [`[${timestamp}] ${line}`, ...previous].slice(0, 120))
  }, [])

  const formatConnectionProtocols = (connection) => {
    const protocolValues = []

    if (typeof connection?.protocol === 'string' && connection.protocol !== '') {
      protocolValues.push(connection.protocol)
    }

    if (typeof connection?.stat?.protocol === 'string' && connection.stat.protocol !== '') {
      protocolValues.push(connection.stat.protocol)
    }

    return Array.from(new Set(protocolValues))
  }

  const updatePeerDetails = useCallback(() => {
    if (helia == null) {
      setLocalPeerDetail(null)
      setConnectedPeersDetail([])
      return
    }

    const connections = helia.libp2p.getConnections()
    const localMultiaddrs = helia.libp2p.getMultiaddrs().map((addr) => addr.toString())
    const peerMap = new Map()
    const connectedPeerIdSet = new Set()

    const parseConnectionStart = (connection) => {
      const openTimestamp = connection?.stat?.timeline?.open

      if (typeof openTimestamp === 'number' && Number.isFinite(openTimestamp)) {
        const openDate = new Date(openTimestamp)

        if (!Number.isNaN(openDate.getTime())) {
          return openDate.toISOString()
        }
      }

      return new Date().toISOString()
    }

    connections.forEach((connection) => {
      const peerId = connection.remotePeer?.toString?.() ?? ''

      if (peerId === '') {
        return
      }

      connectedPeerIdSet.add(peerId)

      const connectionAddress = connection.remoteAddr?.toString?.() ?? ''
      const connectionStart = parseConnectionStart(connection)
      const previouslySeenStart = peerConnectionFirstSeenRef.current.get(peerId)
      const firstSeenStart = previouslySeenStart == null || connectionStart < previouslySeenStart
        ? connectionStart
        : previouslySeenStart

      peerConnectionFirstSeenRef.current.set(peerId, firstSeenStart)

      const currentPeer = peerMap.get(peerId) ?? {
        peerId,
        addresses: [],
        connectedAddress: null,
        connectionHistory: {},
        protocols: [],
        connectionStartedAt: firstSeenStart,
        latency: null,
        lastSeen: new Date().toISOString()
      }

      if (connectionAddress !== '' && !currentPeer.addresses.includes(connectionAddress)) {
        currentPeer.addresses.push(connectionAddress)
      }

      if (currentPeer.connectedAddress == null && connectionAddress !== '') {
        currentPeer.connectedAddress = connectionAddress
      }

      currentPeer.protocols = Array.from(new Set(currentPeer.protocols.concat(formatConnectionProtocols(connection))))
      currentPeer.connectionStartedAt =
        currentPeer.connectionStartedAt < firstSeenStart ? currentPeer.connectionStartedAt : firstSeenStart
      currentPeer.lastSeen = new Date().toISOString()
      peerMap.set(peerId, currentPeer)
    })

    Array.from(peerConnectionFirstSeenRef.current.keys()).forEach((peerId) => {
      if (!connectedPeerIdSet.has(peerId)) {
        peerConnectionFirstSeenRef.current.delete(peerId)
      }
    })

    setLocalPeerDetail({
      peerId: helia.libp2p.peerId.toString(),
      addresses: localMultiaddrs,
      connectedAddress: localMultiaddrs[0] ?? null,
      connectionHistory: {},
      protocols: Array.from(new Set(connections.flatMap((connection) => formatConnectionProtocols(connection)))),
      latency: null,
      lastSeen: new Date().toISOString()
    })

    setConnectedPeersDetail(
      Array.from(peerMap.values()).sort((left, right) => {
        const leftStart = left.connectionStartedAt ?? ''
        const rightStart = right.connectionStartedAt ?? ''

        if (leftStart !== rightStart) {
          return leftStart.localeCompare(rightStart)
        }

        return left.peerId.localeCompare(right.peerId)
      })
    )
    setConnectedPeers(connections.length)
    setConnectedPeerIds(connections.map((connection) => connection.remotePeer.toString()))
  }, [helia])

  const refreshPubsubDiagnostics = useCallback((roomOverride) => {
    const pubsub = pubsubRef.current

    if (helia == null || pubsub == null) {
      return
    }

    const connected = helia.libp2p.getConnections().map((connection) => connection.remotePeer.toString())
    setConnectedPeerIds(connected)

    try {
      const topics = typeof pubsub.getTopics === 'function' ? pubsub.getTopics() : []
      setSubscribedTopics(topics)
    } catch {
      setSubscribedTopics([])
    }

    const room = roomOverride ?? joinedRoomRef.current

    if (room === '' || typeof pubsub.getSubscribers !== 'function') {
      setTopicSubscribers([])
      return
    }

    try {
      const subscribers = pubsub.getSubscribers(room).map((peerId) => peerId.toString())
      setTopicSubscribers(subscribers)
    } catch {
      setTopicSubscribers([])
    }
  }, [helia])

  useEffect(() => {
    if (helia == null) {
      setConnectedPeers(0)
      setConnectedPeerIds([])
      setConnectedPeersDetail([])
      setLocalPeerDetail(null)
      return
    }

    updatePeerDetails()
    const interval = setInterval(updatePeerDetails, 500)

    return () => {
      clearInterval(interval)
    }
  }, [helia, updatePeerDetails])

  const addSystemMessage = (text) => {
    setChatMessages((previous) => previous.concat({
      id: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      from: 'system',
      text,
      timestamp: Date.now(),
      system: true
    }))
  }

  useEffect(() => {
    if (helia == null) {
      setChatStatus('Waiting for Helia...')
      return
    }

    const peerId = helia.libp2p.peerId.toString()
    setLocalPeerId(peerId)
    pushDebugLog(`local peer id ${peerId}`)

    const pubsub = helia.libp2p?.services?.pubsub

    if (pubsub == null) {
      setChatStatus('Pubsub service unavailable')
      pushDebugLog('pubsub service unavailable')
      return
    }

    pubsubRef.current = pubsub

    setChatName((previous) => {
      if (previous.trim() !== '') {
        return previous
      }

      return `anon-${helia.libp2p.peerId.toString().slice(0, 8)}`
    })

    const onPeerConnect = (event) => {
      pushDebugLog(`peer connected ${event.detail.toString()}`)
      refreshPubsubDiagnostics()
    }

    const onPeerDisconnect = (event) => {
      pushDebugLog(`peer disconnected ${event.detail.toString()}`)
      refreshPubsubDiagnostics()
    }

    helia.libp2p.addEventListener('peer:connect', onPeerConnect)
    helia.libp2p.addEventListener('peer:disconnect', onPeerDisconnect)

    const onMessage = (event) => {
      console.log('onMessage', event)
      const detail = event?.detail

      if (detail?.topic !== joinedRoomRef.current || detail?.data == null) {
        return
      }

      try {
        const payload = JSON.parse(decoder.decode(detail.data))

        if (typeof payload?.id !== 'string' || seenIdsRef.current.has(payload.id)) {
          return
        }

        seenIdsRef.current.add(payload.id)
        pushDebugLog(`message received topic=${String(detail.topic)} from=${String(payload.from ?? 'anon')}`)
        setChatMessages((previous) => previous.concat({
          id: payload.id,
          from: String(payload.from ?? 'anon'),
          text: String(payload.text ?? ''),
          timestamp: Number(payload.timestamp ?? Date.now())
        }))
      } catch {
        // Ignore malformed pubsub messages
      }
    }

    messageHandlerRef.current = onMessage
    pubsub.addEventListener('message', onMessage)

    const initialRoom = chatRoomInput.trim() || DEFAULT_CHAT_ROOM
    pubsub.subscribe(initialRoom)
    joinedRoomRef.current = initialRoom
    setJoinedRoom(initialRoom)
    addSystemMessage(`Joined room: ${initialRoom}`)
    setChatStatus(`Chat connected in ${initialRoom}`)
    pushDebugLog(`subscribed to topic ${initialRoom}`)
    refreshPubsubDiagnostics(initialRoom)

    const diagnosticsInterval = setInterval(() => {
      refreshPubsubDiagnostics()
    }, 1000)

    return () => {
      clearInterval(diagnosticsInterval)

      helia.libp2p.removeEventListener('peer:connect', onPeerConnect)
      helia.libp2p.removeEventListener('peer:disconnect', onPeerDisconnect)

      if (messageHandlerRef.current != null) {
        pubsub.removeEventListener('message', messageHandlerRef.current)
      }

      if (joinedRoomRef.current !== '') {
        pushDebugLog(`unsubscribing from topic ${joinedRoomRef.current}`)
        pubsub.unsubscribe(joinedRoomRef.current)
        joinedRoomRef.current = ''
      }
    }
  }, [helia, pushDebugLog, refreshPubsubDiagnostics])

  const joinRoom = () => {
    const pubsub = pubsubRef.current
    const nextRoom = chatRoomInput.trim()

    if (pubsub == null || nextRoom === '' || nextRoom === joinedRoomRef.current) {
      return
    }

    if (joinedRoomRef.current !== '') {
      pushDebugLog(`unsubscribing from topic ${joinedRoomRef.current}`)
      pubsub.unsubscribe(joinedRoomRef.current)
    }

    pubsub.subscribe(nextRoom)
    joinedRoomRef.current = nextRoom
    setJoinedRoom(nextRoom)
    setChatMessages([])
    seenIdsRef.current.clear()
    addSystemMessage(`Joined room: ${nextRoom}`)
    setChatStatus(`Chat connected in ${nextRoom}`)
    pushDebugLog(`subscribed to topic ${nextRoom}`)
    refreshPubsubDiagnostics(nextRoom)
  }

  const sendChatMessage = async () => {
    const pubsub = pubsubRef.current
    const room = joinedRoomRef.current
    const messageText = chatDraft.trim()

    if (pubsub == null || room === '' || messageText === '') {
      return
    }

    const payload = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      from: chatName.trim() || 'anon',
      text: messageText,
      timestamp: Date.now()
    }

    seenIdsRef.current.add(payload.id)
    setChatMessages((previous) => previous.concat({
      ...payload,
      self: true
    }))
    setChatDraft('')

    try {
      console.log('room:' + room)
      console.log(pubsub.getSubscribers(room))
      const subscribers = typeof pubsub.getSubscribers === 'function'
        ? pubsub.getSubscribers(room).map((peerId) => peerId.toString())
        : []

      pushDebugLog(`publish attempt topic=${room} subscribers=${subscribers.length} connected=${helia?.libp2p.getConnections().length ?? 0}`)

      if (subscribers.length === 0) {
        setChatStatus(`No known subscribers yet for ${room}; sending anyway`)
      }

      await pubsub.publish(room, encoder.encode(JSON.stringify(payload)), {
        allowPublishToZeroTopicPeers: true
      })
      setChatStatus(`Published to ${room} (known subscribers: ${subscribers.length})`)
      refreshPubsubDiagnostics(room)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setChatStatus(`Publish failed: ${message}`)
      pushDebugLog(`publish failed topic=${room} error=${message}`)
    }
  }

  const dialPeerByMultiaddr = async () => {
    console.log('dialPeerByMultiaddr', dialMultiaddrInput)
    const dialAddress = multiaddr(dialMultiaddrInput.trim())
    console.log('dialAddress', dialAddress)

    if (helia == null || dialAddress === '') {
      return
    }

    setDialStatus(`Dialing ${dialAddress}...`)
    pushDebugLog(`dial attempt ${dialAddress}`)
    console.log('dialing', dialAddress)

    try {
      await helia.libp2p.dial(dialAddress)
      setDialStatus(`Dial succeeded: ${dialAddress}`)
      pushDebugLog(`dial succeeded ${dialAddress}`)
      refreshPubsubDiagnostics()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDialStatus(`Dial failed: ${message}`)
      pushDebugLog(`dial failed ${dialAddress} error=${message}`)
      console.log('dial failed', dialAddress, err)
    }
  }

  let colour = 'green'

  if (error) {
    colour = 'red'
  } else if (starting) {
    colour = 'yellow'
  }

  return (
    <div className='App'>
      <div
        id='heliaStatus'
        style={{
          border: `4px solid ${colour}`,
          paddingBottom: '4px'
        }}
      >Helia Status - Connected Peers: {connectedPeers}
      </div>
      <h2>Minimal Pubsub Chatroom</h2>
      <div id='chatStatus'>Status: {chatStatus}</div>
      <div id='chatRoom'>Joined room: {joinedRoom || '(none)'}</div>
      <div id='chatPeerId'>Local peer id: {localPeerId || '(starting)'}</div>

      <div className='peerDashboard'>
        <section className='peerDashboardSection'>
          <div className='peerDashboardHeader'>
            <h3>Local Peer</h3>
            <span>{connectedPeers} connection{connectedPeers === 1 ? '' : 's'}</span>
          </div>
          {localPeerDetail != null ? (
            <Peer {...localPeerDetail} />
          ) : (
            <div className='peerDashboardEmpty'>Waiting for Helia to finish starting up.</div>
          )}
        </section>

        {connectedPeersDetail.length > 0 && (
          <section className={`peerDashboardSection ${showConnectedPeers ? '' : 'isCollapsed'}`}>
            <div className='peerDashboardHeader'>
              <h3>Connected Peers</h3>
              <div className='peerDashboardHeaderActions'>
                <span>{connectedPeersDetail.length}</span>
                <button
                  type='button'
                  className='peerDashboardToggle'
                  onClick={() => setShowConnectedPeers((previous) => !previous)}
                  aria-expanded={showConnectedPeers}
                  aria-controls='connectedPeersGrid'
                >
                  {showConnectedPeers ? 'Minimize' : 'Expand'}
                </button>
              </div>
            </div>
            {showConnectedPeers && (
              <div className='peerDashboardGrid' id='connectedPeersGrid'>
                {connectedPeersDetail.map((peer) => (
                  <Peer key={peer.peerId} {...peer} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className='chatControls'>
        <input
          id='chatDialMultiaddrInput'
          value={dialMultiaddrInput}
          onChange={(event) => setDialMultiaddrInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void dialPeerByMultiaddr()
            }
          }}
          type='text'
          placeholder='/ip4/127.0.0.1/tcp/4001/ws/p2p/12D3KooW...'
        />
        <button id='chatDialPeerButton' onClick={() => { void dialPeerByMultiaddr() }}>Dial Peer</button>
      </div>
      <div id='chatDialStatus'>{dialStatus || 'Dial status: idle'}</div>

      <div className='chatControls'>
        <button id='chatToggleDiagnosticsButton' onClick={() => setShowDiagnostics((previous) => !previous)}>
          {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
        </button>
        <button id='chatToggleDebugLogButton' onClick={() => setShowDebugLog((previous) => !previous)}>
          {showDebugLog ? 'Hide Debug Log' : 'Show Debug Log'}
        </button>
      </div>

      {showDiagnostics && (
        <div id='chatDiagnostics'>
          <div>Local subscribed topics: {subscribedTopics.length > 0 ? subscribedTopics.join(', ') : '(none)'}</div>
          <div>Known subscribers in joined topic: {topicSubscribers.length > 0 ? topicSubscribers.join(', ') : '(none)'}</div>
          <div>Connected peer ids: {connectedPeerIds.length > 0 ? connectedPeerIds.join(', ') : '(none)'}</div>
          <button id='chatRefreshDiagnosticsButton' onClick={() => refreshPubsubDiagnostics()}>Refresh Chat Diagnostics</button>
        </div>
      )}

      <div className='chatControls'>
        <input
          id='chatNameInput'
          value={chatName}
          onChange={(event) => setChatName(event.target.value)}
          type='text'
          placeholder='nickname'
        />
        <input
          id='chatRoomInput'
          value={chatRoomInput}
          onChange={(event) => setChatRoomInput(event.target.value)}
          type='text'
          placeholder={DEFAULT_CHAT_ROOM}
        />
        <button id='chatJoinButton' onClick={joinRoom}>Join Room</button>
      </div>

      <div id='chatMessages'>
        {chatMessages.map((message) => {
          const timestamp = new Date(message.timestamp).toLocaleTimeString()
          const className = message.system ? 'system' : (message.self ? 'self' : 'peer')

          return (
            <div className={`chatMessage ${className}`} key={message.id}>
              [{timestamp}] <strong>{message.from}</strong>: {message.text}
            </div>
          )
        })}
      </div>

      <div className='chatControls'>
        <input
          id='chatMessageInput'
          value={chatDraft}
          onChange={(event) => setChatDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void sendChatMessage()
            }
          }}
          type='text'
          placeholder='message'
        />
        <button id='chatSendButton' onClick={() => { void sendChatMessage() }}>Send</button>
      </div>

      {showDebugLog && (
        <pre id='chatDebugLog'>
          {chatDebugLog.length > 0 ? chatDebugLog.join('\n') : 'No chat logs yet'}
        </pre>
      )}
    </div>
  )
}

export default App
