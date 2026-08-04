const RoomsSidebar = ({
  channels,
  activeRoom,
  roomLabel,
  showChannelComposer,
  channelInput,
  channelAction,
  isOpen,
  onCloseMobilePanel,
  onSelectRoom,
  onToggleComposer,
  onSetChannelAction,
  onChannelInputChange,
  onAddChannel
}) => {
  return (
    <aside className={`channelsSidebar mobileDrawer ${isOpen ? 'isOpen' : ''}`}>
      <div className='sidebarHeader'>
        <div className='sidebarTitle'>Rooms</div>
        <button
          type='button'
          className='mobileDrawerClose'
          aria-label='Close rooms panel'
          onClick={onCloseMobilePanel}
        >
          ×
        </button>
      </div>

      <div className='channelsList'>
        {channels.map((room) => {
          const isActive = room === activeRoom

          return (
            <button
              key={room}
              type='button'
              className={`channelButton ${isActive ? 'isActive' : ''}`}
              onClick={() => onSelectRoom(room)}
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
                onClick={() => onSetChannelAction('join')}
              >
                Join
              </button>
              <button
                type='button'
                className={channelAction === 'create' ? 'modeButton isSelected' : 'modeButton'}
                onClick={() => onSetChannelAction('create')}
              >
                Create
              </button>
            </div>
            <input
              id='chatRoomInput'
              value={channelInput}
              onChange={(event) => onChannelInputChange(event.target.value)}
              type='text'
              placeholder='room/path'
            />
            <button type='button' className='channelApplyButton' onClick={onAddChannel}>
              {channelAction === 'create' ? 'Create channel' : 'Join channel'}
            </button>
          </div>
        )}

        <button
          type='button'
          className='channelAddButton'
          onClick={onToggleComposer}
          aria-expanded={showChannelComposer}
        >
          +
        </button>
      </div>
    </aside>
  )
}

export default RoomsSidebar