const ChatUtilityBar = ({
  chatName,
  onChatNameChange,
  dialMultiaddrInput,
  onDialMultiaddrInputChange,
  onDialPeer,
  showDiagnostics,
  onToggleDiagnostics,
  showDebugLog,
  onToggleDebugLog
}) => {
  return (
    <div className='chatUtilityBar'>
      <input
        id='chatNameInput'
        value={chatName}
        onChange={(event) => onChatNameChange(event.target.value)}
        type='text'
        placeholder='nickname'
      />
      <input
        id='chatDialMultiaddrInput'
        value={dialMultiaddrInput}
        onChange={(event) => onDialMultiaddrInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            void onDialPeer()
          }
        }}
        type='text'
        placeholder='/ip4/127.0.0.1/tcp/4001/ws/p2p/12D3KooW...'
      />
      <button id='chatDialPeerButton' onClick={() => { void onDialPeer() }}>Dial Peer</button>
      <button id='chatToggleDiagnosticsButton' onClick={onToggleDiagnostics}>
        {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
      </button>
      <button id='chatToggleDebugLogButton' onClick={onToggleDebugLog}>
        {showDebugLog ? 'Hide Debug Log' : 'Show Debug Log'}
      </button>
    </div>
  )
}

export default ChatUtilityBar