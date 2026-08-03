import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ChatRoom from './components/ChatRoom'
import { useHelia } from '@/hooks/useHelia'
import { multiaddr } from '@multiformats/multiaddr'

const DEFAULT_CHAT_ROOM = 'helia-examples/chatroom'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function App () {
  const [connectedPeers, setConnectedPeers] = useState(0)
  const [chatStatus, setChatStatus] = useState('Waiting for Helia...')
  const [chatName, setChatName] = useState('')
  const [channelInput, setChannelInput] = useState(DEFAULT_CHAT_ROOM)
  const [showChannelComposer, setShowChannelComposer] = useState(false)
  const [channelAction, setChannelAction] = useState('join')
  const [channels, setChannels] = useState([])
  const [activeRoom, setActiveRoom] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [roomMessages, setRoomMessages] = useState({})
  const [localPeerId, setLocalPeerId] = useState('')
  const [subscribedTopics, setSubscribedTopics] = useState([])
  const [topicSubscribers, setTopicSubscribers] = useState([])
  const [connectedPeerIds, setConnectedPeerIds] = useState([])
  const [connectedPeersDetail, setConnectedPeersDetail] = useState([])
  const [chatDebugLog, setChatDebugLog] = useState([])
  const [dialMultiaddrInput, setDialMultiaddrInput] = useState('')
  const [dialStatus, setDialStatus] = useState('')
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showDebugLog, setShowDebugLog] = useState(false)
  const pubsubRef = useRef(null)
  const activeRoomRef = useRef('')
  const subscribedRoomsRef = useRef(new Set())
  const seenIdsByRoomRef = useRef(new Map())
  const autoDialAttemptedAtRef = useRef(new Map())
  const peerConnectionFirstSeenRef = useRef(new Map())
  const messageHandlerRef = useRef(null)
  const { helia, error, starting } = useHelia()

  const activeMessages = roomMessages[activeRoom] ?? []

  const roomLabel = useCallback((roomName) => {
    const roomSegments = roomName.split('/').filter(Boolean)
    return roomSegments[roomSegments.length - 1] ?? roomName
  }, [])

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
      setConnectedPeersDetail([])
      return
    }

    const connections = helia.libp2p.getConnections()
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

    const room = roomOverride ?? activeRoomRef.current

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

  const markSeen = useCallback((room, id) => {
    if (room === '' || id === '') {
      return false
    }

    const seenForRoom = seenIdsByRoomRef.current.get(room) ?? new Set()

    if (seenForRoom.has(id)) {
      return true
    }

    seenForRoom.add(id)
    seenIdsByRoomRef.current.set(room, seenForRoom)
    return false
  }, [])

  const appendRoomMessage = useCallback((room, message) => {
    setRoomMessages((previous) => {
      const currentRoomMessages = previous[room] ?? []

      return {
        ...previous,
        [room]: currentRoomMessages.concat(message)
      }
    })
  }, [])

  const addSystemMessage = useCallback((room, text) => {
    appendRoomMessage(room, {
      id: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      from: 'system',
      text,
      timestamp: Date.now(),
      system: true
    })
  }, [appendRoomMessage])

  const subscribeToRoom = useCallback((room, options = {}) => {
    const { focus = false, announce = true, actionLabel = 'Joined room' } = options
    const pubsub = pubsubRef.current

    if (pubsub == null || room === '') {
      return false
    }

    if (!subscribedRoomsRef.current.has(room)) {
      pubsub.subscribe(room)
      subscribedRoomsRef.current.add(room)
      pushDebugLog(`subscribed to topic ${room}`)

      if (announce) {
        addSystemMessage(room, `${actionLabel}: ${room}`)
      }
    }

    setChannels((previous) => {
      if (previous.includes(room)) {
        return previous
      }

      return previous.concat(room)
    })

    if (focus) {
      activeRoomRef.current = room
      setActiveRoom(room)
      setChatStatus(`Chat connected in ${room}`)
    }

    refreshPubsubDiagnostics(room)
    return true
  }, [addSystemMessage, pushDebugLog, refreshPubsubDiagnostics])

  const maybeAutoDialPeer = useCallback(async (peerTarget, peerIdText) => {
    if (helia == null || peerIdText === '' || peerIdText === localPeerId) {
      return
    }

    const isConnected = helia.libp2p
      .getConnections()
      .some((connection) => connection.remotePeer?.toString?.() === peerIdText)

    if (isConnected) {
      return
    }

    const lastAttemptAt = autoDialAttemptedAtRef.current.get(peerIdText) ?? 0

    if (Date.now() - lastAttemptAt < 20000) {
      return
    }

    autoDialAttemptedAtRef.current.set(peerIdText, Date.now())
    pushDebugLog(`auto-dial attempt for peer ${peerIdText}`)

    try {
      await helia.libp2p.dial(peerTarget)
      pushDebugLog(`auto-dial succeeded for peer ${peerIdText}`)
      setChatStatus(`Auto-connected to ${peerIdText.slice(0, 12)}...`)
      refreshPubsubDiagnostics()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pushDebugLog(`auto-dial failed for peer ${peerIdText}: ${message}`)
    }
  }, [helia, localPeerId, pushDebugLog, refreshPubsubDiagnostics])

  useEffect(() => {
    if (helia == null) {
      setConnectedPeers(0)
      setConnectedPeerIds([])
      setConnectedPeersDetail([])
      return
    }

    updatePeerDetails()
    const interval = setInterval(updatePeerDetails, 500)

    return () => {
      clearInterval(interval)
    }
  }, [helia, updatePeerDetails])

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
      const detail = event?.detail
      const topic = String(detail?.topic ?? '')

      if (!subscribedRoomsRef.current.has(topic) || detail?.data == null) {
        return
      }

      let payload

      try {
        payload = JSON.parse(decoder.decode(detail.data))
      } catch {
        return
      }

      const payloadId = String(payload?.id ?? '')

      if (payloadId === '' || markSeen(topic, payloadId)) {
        return
      }

      const senderPeerId = detail?.from?.toString?.() ?? ''
      const senderTarget = detail?.from ?? senderPeerId

      pushDebugLog(`message received topic=${topic} from=${String(payload.from ?? 'anon')}`)
      appendRoomMessage(topic, {
        id: payloadId,
        from: String(payload.from ?? 'anon'),
        text: String(payload.text ?? ''),
        timestamp: Number(payload.timestamp ?? Date.now())
      })

      if (senderPeerId !== '') {
        void maybeAutoDialPeer(senderTarget, senderPeerId)
      }

      refreshPubsubDiagnostics(topic)
    }

    messageHandlerRef.current = onMessage
    pubsub.addEventListener('message', onMessage)

    const initialRoom = channelInput.trim() || DEFAULT_CHAT_ROOM
    subscribeToRoom(initialRoom, { focus: true, actionLabel: 'Joined room' })

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

      subscribedRoomsRef.current.forEach((room) => {
        pushDebugLog(`unsubscribing from topic ${room}`)
        pubsub.unsubscribe(room)
      })

      subscribedRoomsRef.current.clear()
      activeRoomRef.current = ''
    }
  }, [appendRoomMessage, channelInput, helia, markSeen, maybeAutoDialPeer, pushDebugLog, refreshPubsubDiagnostics, subscribeToRoom])

  const selectRoom = (room) => {
    if (room === '' || !subscribedRoomsRef.current.has(room)) {
      return
    }

    activeRoomRef.current = room
    setActiveRoom(room)
    setChatStatus(`Switched to ${room}`)
    refreshPubsubDiagnostics(room)
  }

  const addChannel = () => {
    const nextRoom = channelInput.trim()

    if (nextRoom === '') {
      return
    }

    const actionLabel = channelAction === 'create' ? 'Created room' : 'Joined room'
    const didSubscribe = subscribeToRoom(nextRoom, {
      focus: true,
      actionLabel
    })

    if (didSubscribe) {
      setShowChannelComposer(false)
    }
  }

  const sendChatMessage = async () => {
    const pubsub = pubsubRef.current
    const room = activeRoomRef.current
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

    markSeen(room, payload.id)
    appendRoomMessage(room, {
      ...payload,
      self: true
    })
    setChatDraft('')

    try {
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
    const dialInput = dialMultiaddrInput.trim()

    if (helia == null || dialInput === '') {
      return
    }

    let dialAddress

    try {
      dialAddress = multiaddr(dialInput)
    } catch {
      setDialStatus('Dial failed: invalid multiaddr')
      return
    }

    setDialStatus(`Dialing ${dialAddress}...`)
    pushDebugLog(`dial attempt ${dialAddress}`)

    try {
      await helia.libp2p.dial(dialAddress)
      setDialStatus(`Dial succeeded: ${dialAddress}`)
      pushDebugLog(`dial succeeded ${dialAddress}`)
      refreshPubsubDiagnostics()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDialStatus(`Dial failed: ${message}`)
      pushDebugLog(`dial failed ${dialAddress} error=${message}`)
    }
  }

  const membersByTopic = useMemo(() => {
    const memberIds = new Set(topicSubscribers)
    const connectedMap = new Map(connectedPeersDetail.map((peer) => [peer.peerId, peer]))

    return Array.from(memberIds)
      .map((peerId) => ({
        peerId,
        connected: connectedMap.has(peerId),
        detail: connectedMap.get(peerId) ?? null
      }))
      .sort((left, right) => {
        if (left.connected !== right.connected) {
          return left.connected ? -1 : 1
        }

        return left.peerId.localeCompare(right.peerId)
      })
  }, [connectedPeersDetail, topicSubscribers])

  let colour = 'green'

  if (error) {
    colour = 'red'
  } else if (starting) {
    colour = 'yellow'
  }

  return (
    <div className='App discordApp'>
      <div
        id='heliaStatus'
        className='heliaStatusBanner'
        style={{ borderColor: colour }}
      >Helia status: {starting ? 'starting' : error ? 'error' : 'online'} | connected peers: {connectedPeers}
      </div>

      <div className='discordShell'>
        <aside className='channelsSidebar'>
          <div className='sidebarTitle'>Rooms</div>
          <div className='channelsList'>
            {channels.map((room) => {
              const isActive = room === activeRoom

              return (
                <button
                  key={room}
                  type='button'
                  className={`channelButton ${isActive ? 'isActive' : ''}`}
                  onClick={() => selectRoom(room)}
                >
                  <span className='channelPrefix'>#</span>
                  <span className='channelName'>{roomLabel(room)}</span>
                </button>
              )
            })}
          </div>

          <div className='channelComposerWrap'>
            {showChannelComposer && (
              <div className='channelComposer'>
                <div className='channelComposerModes'>
                  <button
                    type='button'
                    className={channelAction === 'join' ? 'modeButton isSelected' : 'modeButton'}
                    onClick={() => setChannelAction('join')}
                  >
                    Join
                  </button>
                  <button
                    type='button'
                    className={channelAction === 'create' ? 'modeButton isSelected' : 'modeButton'}
                    onClick={() => setChannelAction('create')}
                  >
                    Create
                  </button>
                </div>
                <input
                  id='chatRoomInput'
                  value={channelInput}
                  onChange={(event) => setChannelInput(event.target.value)}
                  type='text'
                  placeholder='room/path'
                />
                <button type='button' className='channelApplyButton' onClick={addChannel}>
                  {channelAction === 'create' ? 'Create channel' : 'Join channel'}
                </button>
              </div>
            )}

            <button
              type='button'
              className='channelAddButton'
              onClick={() => setShowChannelComposer((previous) => !previous)}
              aria-expanded={showChannelComposer}
            >
              +
            </button>
          </div>
        </aside>

        <main className='chatMainPanel'>
          <header className='chatMainHeader'>
            <div>
              <h2>#{roomLabel(activeRoom || DEFAULT_CHAT_ROOM)}</h2>
              <p id='chatStatus'>{chatStatus}</p>
            </div>
            <div className='chatHeaderMeta'>
              <div id='chatPeerId'>peer: {localPeerId || '(starting)'}</div>
              <div id='chatDialStatus'>{dialStatus || 'dial status: idle'}</div>
            </div>
          </header>

          <div className='chatUtilityBar'>
            <input
              id='chatNameInput'
              value={chatName}
              onChange={(event) => setChatName(event.target.value)}
              type='text'
              placeholder='nickname'
            />
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
            <button id='chatToggleDiagnosticsButton' onClick={() => setShowDiagnostics((previous) => !previous)}>
              {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
            </button>
            <button id='chatToggleDebugLogButton' onClick={() => setShowDebugLog((previous) => !previous)}>
              {showDebugLog ? 'Hide Debug Log' : 'Show Debug Log'}
            </button>
          </div>

          <div className='chatRoomPanel'>
            <ChatRoom
              messages={activeMessages}
              messageDraft={chatDraft}
              onMessageDraftChange={setChatDraft}
              onSendMessage={() => { void sendChatMessage() }}
              inputPlaceholder={`Message #${roomLabel(activeRoom || DEFAULT_CHAT_ROOM)}`}
            />
          </div>

          {showDiagnostics && (
            <div id='chatDiagnostics'>
              <div>Local subscribed topics: {subscribedTopics.length > 0 ? subscribedTopics.join(', ') : '(none)'}</div>
              <div>Known subscribers in active topic: {topicSubscribers.length > 0 ? topicSubscribers.join(', ') : '(none)'}</div>
              <div>Connected peer ids: {connectedPeerIds.length > 0 ? connectedPeerIds.join(', ') : '(none)'}</div>
              <button id='chatRefreshDiagnosticsButton' onClick={() => refreshPubsubDiagnostics()}>Refresh Chat Diagnostics</button>
            </div>
          )}

          {showDebugLog && (
            <pre id='chatDebugLog'>
              {chatDebugLog.length > 0 ? chatDebugLog.join('\n') : 'No chat logs yet'}
            </pre>
          )}
        </main>

        <aside className='membersSidebar'>
          <div className='sidebarTitle'>Members</div>
          <div className='membersMeta'>{membersByTopic.length} in room</div>

          <div className='membersList'>
            {membersByTopic.map((member) => (
              <div key={member.peerId} className='memberRow'>
                <span className={`memberStatus ${member.connected ? 'isConnected' : 'isDisconnected'}`} />
                <span className='memberName'>{member.peerId}</span>
              </div>
            ))}

            {membersByTopic.length === 0 && (
              <div className='membersEmpty'>No peers discovered in this room yet.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
