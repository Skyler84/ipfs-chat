const MembersSidebar = ({ members, isOpen, onCloseMobilePanel }) => {
  return (
    <aside className={`membersSidebar mobileDrawer ${isOpen ? 'isOpen' : ''}`}>
      <div className='sidebarHeader'>
        <div className='sidebarTitle'>Members</div>
        <button
          type='button'
          className='mobileDrawerClose'
          aria-label='Close members panel'
          onClick={onCloseMobilePanel}
        >
          ×
        </button>
      </div>

      <div className='membersMeta'>{members.length} in room</div>

      <div className='membersList'>
        {members.map((member) => (
          <div key={member.peerId} className='memberRow'>
            <span className={`memberStatus ${member.connected ? 'isConnected' : 'isDisconnected'}`} />
            <span className='memberName'>{member.peerId}</span>
          </div>
        ))}

        {members.length === 0 && (
          <div className='membersEmpty'>No peers discovered in this room yet.</div>
        )}
      </div>
    </aside>
  )
}

export default MembersSidebar