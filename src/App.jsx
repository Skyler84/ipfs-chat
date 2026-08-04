import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import ChatWorkspace from './components/ChatWorkspace'
import HeliaStatusBanner from './components/HeliaStatusBanner'
import MembersSidebar from './components/MembersSidebar'
import RoomsSidebar from './components/RoomsSidebar'
import { useMobilePanels } from '@/hooks/useMobilePanels'
import { useHelia } from '@/hooks/useHelia'
import { multiaddr } from '@multiformats/multiaddr'
import { ChatRoomAddress } from './ChatRoomAddress'

const DEFAULT_CHAT_ROOM = 'helia-examples/chatroom'
const DISCOVERY_SETTINGS_STORAGE_KEY = 'ipfs-chat-settings'
const PROVIDER_LOOKUP_TIMEOUT_MS = 8000
const PROVIDER_LOOKUP_POLL_PERIOD_MS = 10000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function App () {
  const [connectedPeers, setConnectedPeers] = useState(0)
  const [chatStatus, setChatStatus] = useState('Waiting for Helia...')
  const [chatName, setChatName] = useState('')
  const [channelInput, setChannelInput] = useState(DEFAULT_CHAT_ROOM)
  const [showChannelComposer, setShowChannelComposer] = useState(false)
  const [channelAction, setChannelAction] = useState('join')
  const [channels, setChannels] = useState([DEFAULT_CHAT_ROOM])
  const [activeRoom, setActiveRoom] = useState(DEFAULT_CHAT_ROOM)
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
  const announcedRoomProvidersRef = useRef(new Set())
  const providerLookupInFlightRef = useRef(new Set())
  const messageHandlerRef = useRef(null)
  const { helia, error, starting } = useHelia()
  const {
    mobilePanel,
    isMobileViewport,
    closeMobilePanel,
    toggleMobilePanel,
    handleShellTouchStart,
    handleShellTouchEnd
  } = useMobilePanels()

  const activeMessages = roomMessages[activeRoom] ?? []

  const roomLabel = useCallback((roomName) => {
    const roomSegments = roomName.split('/').filter(Boolean)
    return roomSegments[roomSegments.length - 1] ?? roomName
  }, [])

  const pushDebugLog = useCallback((line) => {
    const timestamp = new Date().toLocaleTimeString()
    setChatDebugLog((previous) => [`[${timestamp}] ${line}`, ...previous].slice(0, 120))
  }, [])

  const getDiscoverySettings = useCallback(() => {
    const defaults = {
      detectPeers: true,
      providePeers: true
    }
    const encodedSettings = localStorage.getItem(DISCOVERY_SETTINGS_STORAGE_KEY)

    if (encodedSettings == null) {
      return defaults
    }

    try {
      const parsedSettings = JSON.parse(encodedSettings)

      return {
        detectPeers: parsedSettings?.detectPeers !== false,
        providePeers: parsedSettings?.providePeers !== false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pushDebugLog(`failed to parse discovery settings: ${message}`)
      return defaults
    }
  }, [pushDebugLog])

  const toRoomManifestIdentifier = useCallback(async (room) => {
    return (await ChatRoomAddress.parse(room)).toString()
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

  const announceRoomManifestProvider = useCallback(async (room) => {
    if (helia == null) {
      return
    }

    const normalizedRoom = room.trim()

    if (normalizedRoom === '' || announcedRoomProvidersRef.current.has(normalizedRoom)) {
      return
    }

    const { providePeers } = getDiscoverySettings()

    if (!providePeers) {
      pushDebugLog(`provider announce skipped (disabled) room=${normalizedRoom}`)
      return
    }

    const contentRouting = helia.libp2p.contentRouting

    if (contentRouting == null || typeof contentRouting.provide !== 'function') {
      pushDebugLog(`provider announce unavailable room=${normalizedRoom}`)
      return
    }

    const roomAddress = await ChatRoomAddress.parse(normalizedRoom)
    const roomManifestCid = roomAddress.cid
    const roomIdentifier = await toRoomManifestIdentifier(normalizedRoom)
    pushDebugLog(`providing room manifest ${roomIdentifier}`)

    try {
      await contentRouting.provide(roomManifestCid, {onProgress: (event) => {
          console.log(event)
          const providedPeerId = event?.provider?.toString?.() ?? ''
          // pushDebugLog(`provide progress room=${normalizedRoom} peer=${providedPeerId}`)
          // console.log(`provide progress room=${normalizedRoom} peer=${providedPeerId}`)
        },
        useCache: false,
        useNetwork: true
      })
      announcedRoomProvidersRef.current.add(normalizedRoom)
      pushDebugLog(`provided room manifest ${roomIdentifier}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pushDebugLog(`provide failed room=${normalizedRoom} error=${message}`)
    }
  }, [getDiscoverySettings, helia, pushDebugLog, toRoomManifestIdentifier])

  const discoverRoomProviders = useCallback(async (room) => {
    if (helia == null) {
      return
    }

    const normalizedRoom = room.trim()

    if (normalizedRoom === '') {
      return
    }

    const { detectPeers } = getDiscoverySettings()

    if (!detectPeers) {
      pushDebugLog(`provider lookup skipped (disabled) room=${normalizedRoom}`)
      return
    }

    if (providerLookupInFlightRef.current.has(normalizedRoom)) {
      return
    }

    const contentRouting = helia.libp2p.contentRouting

    if (contentRouting == null || typeof contentRouting.findProviders !== 'function') {
      pushDebugLog(`provider lookup unavailable room=${normalizedRoom}`)
      return
    }

    providerLookupInFlightRef.current.add(normalizedRoom)
    const roomAddress = await ChatRoomAddress.parse(normalizedRoom)
    const roomManifestCid = roomAddress.cid
    const roomIdentifier = await toRoomManifestIdentifier(normalizedRoom)
    let providerCount = 0
    pushDebugLog(`finding providers for ${roomIdentifier}`)

    try {
      for await (const provider of contentRouting.findProviders(roomManifestCid, { timeout: PROVIDER_LOOKUP_TIMEOUT_MS })) {
        const providerPeerId = ('/p2p/' + provider?.id?.toString?.()) ?? ''

        if (providerPeerId === '' || providerPeerId === localPeerId) {
          continue
        }

        providerCount += 1
        pushDebugLog(`provider found room=${normalizedRoom} peer=${providerPeerId}`)
        void maybeAutoDialPeer(provider.id ?? providerPeerId, providerPeerId)
      }

      if (providerCount === 0) {
        pushDebugLog(`no providers found for ${roomIdentifier}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pushDebugLog(`provider lookup failed room=${normalizedRoom} error=${message}`)
    } finally {
      providerLookupInFlightRef.current.delete(normalizedRoom)
    }
  }, [getDiscoverySettings, helia, localPeerId, maybeAutoDialPeer, pushDebugLog, toRoomManifestIdentifier])

  const subscribeToRoom = useCallback((room, options = {}) => {
    const { focus = false, announce = true, actionLabel = 'Joined room' } = options
    const pubsub = pubsubRef.current
    const normalizedRoom = room.trim()

    if (pubsub == null || normalizedRoom === '') {
      return false
    }

    if (!subscribedRoomsRef.current.has(normalizedRoom)) {
      pubsub.subscribe(normalizedRoom)
      subscribedRoomsRef.current.add(normalizedRoom)
      pushDebugLog(`subscribed to topic ${normalizedRoom}`)

      if (announce) {
        addSystemMessage(normalizedRoom, `${actionLabel}: ${normalizedRoom}`)
      }

      void announceRoomManifestProvider(normalizedRoom)
      void discoverRoomProviders(normalizedRoom)
    }

    setChannels((previous) => {
      if (previous.includes(normalizedRoom)) {
        return previous
      }

      return previous.concat(normalizedRoom)
    })

    if (focus) {
      activeRoomRef.current = normalizedRoom
      setActiveRoom(normalizedRoom)
      setChatStatus(`Chat connected in ${normalizedRoom}`)
    }

    refreshPubsubDiagnostics(normalizedRoom)
    return true
  }, [addSystemMessage, announceRoomManifestProvider, discoverRoomProviders, pushDebugLog, refreshPubsubDiagnostics])

  useEffect(() => {
    if (helia == null) {
      setConnectedPeers(0)
      setConnectedPeerIds([])
      setConnectedPeersDetail([])
      return
    }

    updatePeerDetails()
    const interval = setInterval(updatePeerDetails, 500)
    const discover_interval = setInterval(discoverRoomProviders, PROVIDER_LOOKUP_POLL_PERIOD_MS, activeRoomRef.current)

    return () => {
      clearInterval(interval)
      clearInterval(discover_interval)
    }
  }, [helia, updatePeerDetails, discoverRoomProviders])

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
      refreshPubsubDiagnostics()
    }

    const onPeerDisconnect = (event) => {
      // pushDebugLog(`peer disconnected ${event.detail.toString()}`)
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

    const initialRoom = DEFAULT_CHAT_ROOM
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
      announcedRoomProvidersRef.current.clear()
      providerLookupInFlightRef.current.clear()
      activeRoomRef.current = ''
    }
  }, [
    appendRoomMessage,
    discoverRoomProviders,
    helia,
    markSeen,
    maybeAutoDialPeer,
    pushDebugLog,
    refreshPubsubDiagnostics,
    subscribeToRoom
  ])

  const selectRoom = (room) => {
    const normalizedRoom = room.trim()

    if (normalizedRoom === '') {
      return
    }

    if (!subscribedRoomsRef.current.has(normalizedRoom)) {
      subscribeToRoom(normalizedRoom, { focus: true, announce: false })

      if (isMobileViewport()) {
        closeMobilePanel()
      }

      return
    }

    activeRoomRef.current = normalizedRoom
    setActiveRoom(normalizedRoom)
    setChatStatus(`Switched to ${normalizedRoom}`)
    refreshPubsubDiagnostics(normalizedRoom)
    void discoverRoomProviders(normalizedRoom)

    if (isMobileViewport()) {
      closeMobilePanel()
    }
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

      if (isMobileViewport()) {
        closeMobilePanel()
      }
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
    <div
      className='App discordApp'
      onTouchStart={handleShellTouchStart}
      onTouchEnd={handleShellTouchEnd}
    >
      <HeliaStatusBanner
        colour={colour}
        status={starting ? 'starting' : error ? 'error' : 'online'}
        connectedPeers={connectedPeers}
      />

      <div
        className={`discordShell ${mobilePanel != null ? 'hasMobileDrawerOpen' : ''}`}
      >
        {mobilePanel != null && (
          <button
            type='button'
            className='mobileDrawerBackdrop'
            aria-label='Close side panel'
            onClick={closeMobilePanel}
          />
        )}

        <RoomsSidebar
          channels={channels}
          activeRoom={activeRoom}
          roomLabel={roomLabel}
          showChannelComposer={showChannelComposer}
          channelInput={channelInput}
          channelAction={channelAction}
          isOpen={mobilePanel === 'rooms'}
          onCloseMobilePanel={closeMobilePanel}
          onSelectRoom={selectRoom}
          onToggleComposer={() => setShowChannelComposer((previous) => !previous)}
          onSetChannelAction={setChannelAction}
          onChannelInputChange={setChannelInput}
          onAddChannel={addChannel}
        />

        <ChatWorkspace
          activeRoom={activeRoom}
          defaultChatRoom={DEFAULT_CHAT_ROOM}
          roomLabel={roomLabel}
          chatStatus={chatStatus}
          localPeerId={localPeerId}
          dialStatus={dialStatus}
          mobilePanel={mobilePanel}
          onToggleRoomsPanel={() => toggleMobilePanel('rooms')}
          onToggleMembersPanel={() => toggleMobilePanel('members')}
          chatName={chatName}
          onChatNameChange={setChatName}
          dialMultiaddrInput={dialMultiaddrInput}
          onDialMultiaddrInputChange={setDialMultiaddrInput}
          onDialPeer={dialPeerByMultiaddr}
          showDiagnostics={showDiagnostics}
          onToggleDiagnostics={() => setShowDiagnostics((previous) => !previous)}
          showDebugLog={showDebugLog}
          onToggleDebugLog={() => setShowDebugLog((previous) => !previous)}
          messages={activeMessages}
          chatDraft={chatDraft}
          onMessageDraftChange={setChatDraft}
          onSendMessage={() => { void sendChatMessage() }}
          inputPlaceholder={`Message #${roomLabel(activeRoom || DEFAULT_CHAT_ROOM)}`}
          subscribedTopics={subscribedTopics}
          topicSubscribers={topicSubscribers}
          connectedPeerIds={connectedPeerIds}
          chatDebugLog={chatDebugLog}
          onRefreshDiagnostics={refreshPubsubDiagnostics}
        />

        <MembersSidebar
          members={membersByTopic}
          isOpen={mobilePanel === 'members'}
          onCloseMobilePanel={closeMobilePanel}
        />
      </div>
    </div>
  )
}

export default App
