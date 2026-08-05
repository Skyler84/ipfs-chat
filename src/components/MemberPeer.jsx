import { useMemo, useState } from 'react'
import Avatar from './Avatar'
import CopyText from './CopyText'

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const formatRelativeTime = (timestamp) => {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return 'never'
  }

  const elapsedSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  const timeUnits = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1]
  ]

  for (const [unit, unitSeconds] of timeUnits) {
    if (elapsedSeconds >= unitSeconds || unit === 'second') {
      return relativeTimeFormatter.format(-Math.floor(elapsedSeconds / unitSeconds), unit)
    }
  }

  return 'never'
}

const normalizeTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isNaN(timestamp) ? null : timestamp
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const timestamp = Date.parse(value)
    return Number.isNaN(timestamp) ? null : timestamp
  }

  return null
}

const MemberPeer = ({
  peerId,
  statusLabel,
  statusTone,
  statusDetail,
  detail = null,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAddresses, setShowAddresses] = useState(false)
  const addressDetails = useMemo(() => {
    if (Array.isArray(detail?.addressDetails) && detail.addressDetails.length > 0) {
      return detail.addressDetails
        .map((addressEntry) => ({
          address: String(addressEntry?.address ?? '').trim(),
          isCertified: addressEntry?.isCertified === true,
          isConnected: addressEntry?.isConnected === true || addressEntry?.address === detail?.connectedAddress,
          lastConnected: normalizeTimestamp(addressEntry?.lastConnected)
        }))
        .filter((addressEntry) => addressEntry.address !== '')
    }

    if (Array.isArray(detail?.addresses) && detail.addresses.length > 0) {
      return detail.addresses
        .map((address) => ({
          address: String(address ?? '').trim(),
          isCertified: false,
          isConnected: address === detail?.connectedAddress,
          lastConnected: normalizeTimestamp(detail?.connectionStartedAt)
        }))
        .filter((addressEntry) => addressEntry.address !== '')
    }

    return []
  }, [detail])

  return (
    <div className={`memberPeerCard ${className}`.trim()}>
      <button
        type='button'
        className={`memberRow memberPeer memberPeerToggle ${isExpanded ? 'isExpanded' : ''}`.trim()}
        onClick={() => setIsExpanded((previous) => !previous)}
        aria-expanded={isExpanded}
      >
        <span
          className={`memberStatus memberStatus--${statusTone}`}
          aria-hidden='true'
        />
        <div className='memberPeerCopy'>
          <div className='memberName'>{peerId}</div>
          <div className='memberPeerStatus'>{statusLabel}{statusDetail !== '' ? ` · ${statusDetail}` : ''}</div>
        </div>
        <span className='memberPeerChevron' aria-hidden='true'>{isExpanded ? '▾' : '▸'}</span>
      </button>

      {isExpanded && (
        <div className='memberPeerDetails'>
          <div className='memberPeerIdentity'>
            <Avatar peerId={peerId} className='memberPeerAvatar' />
            <div className='memberPeerIdentityCopy'>
              <div className='memberPeerDetailLabel'>Peer ID</div>
              <div className='memberPeerDetailValue memberPeerDetailValue--wrap'>
                <CopyText text={peerId} value={peerId} />
              </div>
            </div>
          </div>

          <div className='memberPeerSection'>
            <button
              type='button'
              className='memberPeerSectionToggle'
              onClick={() => setShowAddresses((previous) => !previous)}
              aria-expanded={showAddresses}
            >
              <span>Addresses ({addressDetails.length})</span>
              <span aria-hidden='true'>{showAddresses ? '▾' : '▸'}</span>
            </button>

            {showAddresses && (
              <div className='memberPeerAddressList'>
                {addressDetails.length === 0 && (
                  <div className='memberPeerEmptyState'>No advertised addresses available.</div>
                )}

                {addressDetails.map((addressEntry) => (
                  <div key={addressEntry.address} className='memberPeerAddressItem'>
                    <div className='memberPeerAddressValue'>
                      <CopyText text={addressEntry.address} value={addressEntry.address} />
                    </div>
                    <div className='memberPeerAddressMeta'>
                      <span className={`memberPeerBadge ${addressEntry.isCertified ? 'isTrusted' : 'isUntrusted'}`}>
                        {addressEntry.isCertified ? 'Trustworthy' : 'Unverified'}
                      </span>
                      <span className={`memberPeerBadge ${addressEntry.isConnected ? 'isConnected' : ''}`}>
                        {addressEntry.isConnected ? 'Connected now' : 'Not connected now'}
                      </span>
                      <span className='memberPeerBadge'>
                        {addressEntry.lastConnected == null ? 'Never connected' : `Last connected ${formatRelativeTime(addressEntry.lastConnected)}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MemberPeer
