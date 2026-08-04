import ChatHeader from './ChatHeader'
import ChatUtilityBar from './ChatUtilityBar'
import ChatRoom from './ChatRoom'
import DiagnosticsPanel from './DiagnosticsPanel'

const ChatWorkspace = ({
  activeRoom,
  defaultChatRoom,
  roomLabel,
  chatStatus,
  localPeerId,
  dialStatus,
  mobilePanel,
  onToggleRoomsPanel,
  onToggleMembersPanel,
  chatName,
  onChatNameChange,
  dialMultiaddrInput,
  onDialMultiaddrInputChange,
  onDialPeer,
  showDiagnostics,
  onToggleDiagnostics,
  showDebugLog,
  onToggleDebugLog,
  messages,
  chatDraft,
  onMessageDraftChange,
  onSendMessage,
  inputPlaceholder,
  subscribedTopics,
  topicSubscribers,
  connectedPeerIds,
  chatDebugLog,
  onRefreshDiagnostics
}) => {
  return (
    <main className='chatMainPanel'>
      <ChatHeader
        roomTitle={`#${roomLabel(activeRoom || defaultChatRoom)}`}
        chatStatus={chatStatus}
        localPeerId={localPeerId}
        dialStatus={dialStatus}
        mobilePanel={mobilePanel}
        onToggleRoomsPanel={onToggleRoomsPanel}
        onToggleMembersPanel={onToggleMembersPanel}
      />

      <ChatUtilityBar
        chatName={chatName}
        onChatNameChange={onChatNameChange}
        dialMultiaddrInput={dialMultiaddrInput}
        onDialMultiaddrInputChange={onDialMultiaddrInputChange}
        onDialPeer={onDialPeer}
        showDiagnostics={showDiagnostics}
        onToggleDiagnostics={onToggleDiagnostics}
        showDebugLog={showDebugLog}
        onToggleDebugLog={onToggleDebugLog}
      />

      <div className='chatRoomPanel'>
        <ChatRoom
          messages={messages}
          messageDraft={chatDraft}
          onMessageDraftChange={onMessageDraftChange}
          onSendMessage={onSendMessage}
          inputPlaceholder={inputPlaceholder}
        />
      </div>

      <DiagnosticsPanel
        showDiagnostics={showDiagnostics}
        showDebugLog={showDebugLog}
        subscribedTopics={subscribedTopics}
        topicSubscribers={topicSubscribers}
        connectedPeerIds={connectedPeerIds}
        chatDebugLog={chatDebugLog}
        onRefreshDiagnostics={onRefreshDiagnostics}
      />
    </main>
  )
}

export default ChatWorkspace