const DiagnosticsPanel = ({
  showDiagnostics,
  showDebugLog,
  subscribedTopics,
  topicSubscribers,
  connectedPeerIds,
  chatDebugLog,
  onRefreshDiagnostics
}) => {
  return (
    <>
      {showDiagnostics && (
        <div id='chatDiagnostics'>
          <div>Local subscribed topics: {subscribedTopics.length > 0 ? subscribedTopics.join(', ') : '(none)'}</div>
          <div>Known subscribers in active topic: {topicSubscribers.length > 0 ? topicSubscribers.join(', ') : '(none)'}</div>
          <div>Connected peer ids: {connectedPeerIds.length > 0 ? connectedPeerIds.join(', ') : '(none)'}</div>
          <button id='chatRefreshDiagnosticsButton' onClick={() => onRefreshDiagnostics()}>Refresh Chat Diagnostics</button>
        </div>
      )}

      {showDebugLog && (
        <pre id='chatDebugLog'>
          {chatDebugLog.length > 0 ? chatDebugLog.join('\n') : 'No chat logs yet'}
        </pre>
      )}
    </>
  )
}

export default DiagnosticsPanel