const ChatHeader = ({
  roomTitle,
  chatStatus,
  localPeerId,
  dialStatus,
  mobilePanel,
  onToggleRoomsPanel,
  onToggleMembersPanel
}) => {
  return (
    <header className='chatMainHeader'>
      <button
        type='button'
        className='mobilePanelToggle mobilePanelToggleLeft'
        aria-label='Open rooms panel'
        aria-expanded={mobilePanel === 'rooms'}
        onClick={onToggleRoomsPanel}
      >
        ☰
      </button>

      <div className='chatHeaderBody'>
        <div>
          <h2>{roomTitle}</h2>
          <p id='chatStatus'>{chatStatus}</p>
        </div>
        <div className='chatHeaderMeta'>
          <div id='chatPeerId'>peer: {localPeerId || '(starting)'}</div>
          <div id='chatDialStatus'>{dialStatus || 'dial status: idle'}</div>
        </div>
      </div>

      <button
        type='button'
        className='mobilePanelToggle mobilePanelToggleRight'
        aria-label='Open members panel'
        aria-expanded={mobilePanel === 'members'}
        onClick={onToggleMembersPanel}
      >
        👥
      </button>
    </header>
  )
}

export default ChatHeader