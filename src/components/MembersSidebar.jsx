import MemberPeer from './MemberPeer'

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

      <div className='membersMeta'>{members.length} tracked in room</div>

      <div className='membersList'>
        {members.map((member) => (
          <MemberPeer
            key={member.peerId}
            peerId={member.peerId}
            statusLabel={member.statusLabel}
            statusTone={member.statusTone}
            statusDetail={member.statusDetail}
            detail={member.detail}
          />
        ))}

        {members.length === 0 && (
          <div className='membersEmpty'>No peers have been seen in this room yet.</div>
        )}
      </div>
    </aside>
  )
}

export default MembersSidebar