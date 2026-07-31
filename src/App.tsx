import { React, RefObject, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { useCommitText } from '@/hooks/useCommitText'
import { useHelia } from '@/hooks/useHelia'
import { multiaddr } from '@multiformats/multiaddr'
import { Libp2p } from 'libp2p'
import { CID } from 'multiformats/cid'
import { sha256} from 'multiformats/hashes/sha2'
import { GossipSub } from '@libp2p/gossipsub'
import { MultihashDigest, Version } from 'multiformats/link/interface'
import { Multiaddr } from '@multiformats/multiaddr'

const DEFAULT_CHAT_ROOM = 'helia-examples/chatroom'
const DHT_DISCOVERY_INTERVAL_MS = 8000
const DIAL_COOLDOWN_MS = 15000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function getRoomCid (roomName: string): Promise<CID> {
  const roomBytes = new TextEncoder().encode(roomName)
  const roomHash: MultihashDigest = await sha256.digest(roomBytes)
  const roomCid = CID.create(1, 0x55, roomHash) // 0x55 is the raw codec
  return roomCid
}

function App () {
  const [text, setText] = useState('')
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
  const [chatDebugLog, setChatDebugLog] = useState([])
  const [dialMultiaddrInput, setDialMultiaddrInput] = useState('')
  const [dialStatus, setDialStatus] = useState('')
  const [showDiagnostics, setShowDiagnostics] = useState(true)
  const [showDebugLog, setShowDebugLog] = useState(false)
  const pubsubRef: RefObject<GossipSub | null> = useRef(null)
  const joinedRoomRef = useRef('')
  const seenIdsRef = useRef(new Set())
  const dialCooldownRef = useRef(new Map())
  const messageHandlerRef = useRef(null)
  const { helia, error, starting } = useHelia()
  const {
    cidString,
    commitText,
    fetchCommittedText,
    committedText
  } = useCommitText()

  const pushDebugLog = useCallback((line) => {
    const timestamp = new Date().toLocaleTimeString()
    setChatDebugLog((previous) => [`[${timestamp}] ${line}`, ...previous].slice(0, 120))
  }, [])

  const refreshPubsubDiagnostics = useCallback((roomOverride?: string) => {
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
      // console.log('refreshPubsubDiagnostics', room, pubsub.getSubscribers(room))
      const subscribers = pubsub.getSubscribers(room).map((peerId) => peerId.toString())
      setTopicSubscribers(subscribers)
    } catch {
      setTopicSubscribers([])
    }
  }, [helia])

  const discoverAndDialProvidersForRoom = useCallback(async (roomName: string) => {
    if (helia == null || roomName.trim() === '') {
      return
    }

    const libp2p: Libp2p = helia.libp2p

    try {
      const roomCid = await getRoomCid(roomName)
      const connectedPeersSet = new Set(libp2p.getConnections().map((connection) => connection.remotePeer.toString()))
      const localPeerId = libp2p.peerId.toString()

      for await (const provider of libp2p.contentRouting.findProviders(roomCid as any)) {
        const providerId = provider?.id?.toString?.() ?? ''

        if (providerId === '' || providerId === localPeerId || connectedPeersSet.has(providerId)) {
          continue
        }

        const cooldownKey = `${roomName}:${providerId}`
        const now = Date.now()
        const lastDialAttempt = dialCooldownRef.current.get(cooldownKey) ?? 0

        if (now - lastDialAttempt < DIAL_COOLDOWN_MS) {
          continue
        }

        dialCooldownRef.current.set(cooldownKey, now)
        let dialSucceeded = false

        pushDebugLog(`discovered provider ${providerId} for ${roomName}; trying dial`)
        console.log('discovered provider', providerId, 'for', roomName, 'trying dial')

        if (provider?.id != null) {
          try {
            await libp2p.dial(provider.id)
            dialSucceeded = true
          } catch {
            // Fallback to discovered addresses and peer routing.
          }
        }

        if (!dialSucceeded && Array.isArray(provider?.multiaddrs)) {
          for (const discoveredAddr of provider.multiaddrs) {
            try {
              await libp2p.dial(discoveredAddr)
              dialSucceeded = true
              break
            } catch {
              // Try the next address.
            }
          }
        }

        if (!dialSucceeded && provider?.id != null) {
          try {
            const peer = await libp2p.peerRouting.findPeer(provider.id)

            for (const peerAddr of peer?.multiaddrs ?? []) {
              try {
                await libp2p.dial(peerAddr)
                dialSucceeded = true
                break
              } catch {
                // Try the next routed address.
              }
            }
          } catch {
            // Ignore routing lookup failures.
          }
        }

        if (dialSucceeded) {
          pushDebugLog(`dialed discovered provider ${providerId}`)
          refreshPubsubDiagnostics(roomName)
        } else {
          pushDebugLog(`could not dial discovered provider ${providerId}`)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pushDebugLog(`provider discovery failed for ${roomName}: ${message}`)
    }
  }, [helia, pushDebugLog, refreshPubsubDiagnostics])

  useEffect(() => {
    if (helia == null) {
      setConnectedPeers(0)
      setConnectedPeerIds([])
      return
    }

    const updateConnectedPeers = () => {
      setConnectedPeers(helia.libp2p.getConnections().length)
      setConnectedPeerIds(helia.libp2p.getConnections().map((connection) => connection.remotePeer.toString()))
    }

    updateConnectedPeers()
    const interval = setInterval(updateConnectedPeers, 500)

    return () => {
      clearInterval(interval)
    }
  }, [helia])

  useEffect(() => {
    if (helia == null || joinedRoom === '') {
      return
    }

    let disposed = false
    let nextTimer: ReturnType<typeof setTimeout> | null = null

    const discoveryLoop = async () => {
      while (!disposed) {
        const activeRoom = joinedRoomRef.current

        if (activeRoom !== '') {
          await discoverAndDialProvidersForRoom(activeRoom)
        }

        await new Promise((resolve) => {
          nextTimer = setTimeout(resolve, DHT_DISCOVERY_INTERVAL_MS)
        })
      }
    }

    void discoveryLoop()

    return () => {
      disposed = true
      if (nextTimer != null) {
        clearTimeout(nextTimer)
      }
    }
  }, [helia, joinedRoom, discoverAndDialProvidersForRoom])

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
    void (async () => {
      try {
        const initialRoomCid = await getRoomCid(initialRoom)
        await helia.libp2p.contentRouting.provide(initialRoomCid as any)
        pushDebugLog(`provided room cid ${initialRoomCid.toString()} for ${initialRoom}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        pushDebugLog(`failed to provide room cid for ${initialRoom}: ${message}`)
      }
    })()
    void discoverAndDialProvidersForRoom(initialRoom)
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
        const roomBeingLeft = joinedRoomRef.current
        pushDebugLog(`unsubscribing from topic ${joinedRoomRef.current}`)
        pubsub.unsubscribe(joinedRoomRef.current)
        void (async () => {
          try {
            const roomCid = await getRoomCid(roomBeingLeft)
            helia.libp2p.contentRouting.cancelReprovide(roomCid as any)
            console.log('cancelled room cid provide', roomCid.toString(), 'for', roomBeingLeft  )
            pushDebugLog(`cancelled room cid provide ${roomCid.toString()} for ${roomBeingLeft}`)
            console.log(2)
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            pushDebugLog(`failed to cancel room cid provide for ${roomBeingLeft}: ${message}`)
          }
        })()
        joinedRoomRef.current = ''
      }
    }
  }, [helia, chatRoomInput, discoverAndDialProvidersForRoom, pushDebugLog, refreshPubsubDiagnostics])

  const joinRoom = async () => {
    const pubsub = pubsubRef.current
    const nextRoom = chatRoomInput.trim()

    if (pubsub == null || nextRoom === '' || nextRoom === joinedRoomRef.current) {
      return
    }

    const libp2p: Libp2p = helia.libp2p
    if (joinedRoomRef.current !== '') {
      // Generate CID from raw string contents.
      const roomCid = await getRoomCid(joinedRoomRef.current)
      pushDebugLog(`unsubscribing from topic ${joinedRoomRef.current}`)
      pubsub.unsubscribe(joinedRoomRef.current)
      libp2p.contentRouting.cancelReprovide(roomCid as any)
      console.log('cancelled room cid provide', roomCid.toString(), 'for', joinedRoomRef.current)
    }
    console.log('test1')

    const newRoomCid = await getRoomCid(nextRoom)

    try {
      console.log('providing room cid', newRoomCid.toString(), 'for', nextRoom)
      await libp2p.contentRouting.provide(newRoomCid as any)
      pushDebugLog(`provided room cid ${newRoomCid.toString()} for ${nextRoom}`)
      console.log('provided room cid', newRoomCid.toString(), 'for', nextRoom)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pushDebugLog(`failed to provide room cid for ${nextRoom}: ${message}`)
      console.log('failed to provide room cid for', nextRoom, message)
    }

    pubsub.subscribe(nextRoom)
    joinedRoomRef.current = nextRoom
    setJoinedRoom(nextRoom)
    setChatMessages([])
    seenIdsRef.current.clear()
    addSystemMessage(`Joined room: ${nextRoom}`)
    setChatStatus(`Chat connected in ${nextRoom}`)
    pushDebugLog(`subscribed to topic ${nextRoom}`)
    void discoverAndDialProvidersForRoom(nextRoom)
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
      <input
        id='textInput'
        value={text}
        onChange={(event) => setText(event.target.value)}
        type='text'
      />
      <button
        id='commitTextButton'
        onClick={() => commitText(text)}
      >Add Text To Node
      </button>
      <div
        id='cidOutput'
      >textCid: {cidString}
      </div>
      {cidString && (
        <>
          <button
            id='fetchCommittedTextButton'
            onClick={() => fetchCommittedText()}
          >Fetch Committed Text
          </button>
          <div
            id='committedTextOutput'
          >Committed Text: {committedText}
          </div>
        </>)}

      <hr />
      <h2>Minimal Pubsub Chatroom</h2>
      <div id='chatStatus'>Status: {chatStatus}</div>
      <div id='chatRoom'>Joined room: {joinedRoom || '(none)'}</div>
      <div id='chatPeerId'>Local peer id: {localPeerId || '(starting)'}</div>
      <div id='chatPeerAddresses'>Local peer addresses:
        <table>
        {helia?.libp2p?.getMultiaddrs().map((addr: Multiaddr) => (
          <tr key={addr.toString()}><td>{addr.toString()}</td></tr>
        ))}
        </table>
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
