const MemberPeer = ({
  peerId,
  statusLabel,
  statusTone,
  statusDetail,
  className = ''
}) => {
  return (
    <div className={`memberRow memberPeer ${className}`.trim()}>
      <span
        className={`memberStatus memberStatus--${statusTone}`}
        aria-hidden='true'
      />
      <div className='memberPeerCopy'>
        <div className='memberName'>{peerId}</div>
        <div className='memberPeerStatus'>{statusLabel}{statusDetail !== '' ? ` · ${statusDetail}` : ''}</div>
      </div>
    </div>
  )
}

export default MemberPeer
