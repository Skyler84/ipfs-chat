import React, { useMemo, useState } from 'react';
import './Peer.css';
import { CopyText } from './components/CopyText';
import Avatar from './components/Avatar';

const Peer = ({ 
  peerId, 
  addresses = [], 
  connectedAddress = null,
  connectionHistory = {},
  protocols = [],
  latency = null,
  lastSeen = null
}) => {
  // Categorize addresses
  const categorizedAddresses = useMemo(() => {
    return addresses.map(addr => {
      const history = connectionHistory[addr];
      let status = 'unknown';
      let color = '#999';
      let opacity = 1;

      if (addr === connectedAddress) {
        status = 'connected';
        color = '#4caf50';
      } else if (history) {
        if (history.success && history.success.length > 0) {
          status = 'previously-connected';
          color = '#2196f3';
          // Fade older successes
          const lastSuccess = new Date(history.success[history.success.length - 1]);
          const age = Date.now() - lastSuccess.getTime();
          opacity = Math.max(0.3, 1 - (age / (30 * 24 * 60 * 60 * 1000))); // 30 days fade
        }
        if (history.failed && history.failed.length > 0) {
          status = 'failed';
          color = '#f44336';
          const lastFailure = new Date(history.failed[history.failed.length - 1]);
          const age = Date.now() - lastFailure.getTime();
          opacity = Math.max(0.3, 1 - (age / (7 * 24 * 60 * 60 * 1000))); // 7 days fade
        }
      }

      return {
        address: addr,
        status,
        color,
        opacity,
        history
      };
    });
  }, [addresses, connectedAddress, connectionHistory]);

  // Filter compatible addresses (websocket, tcp, etc)
  const compatibleAddresses = useMemo(() => {
    return categorizedAddresses.filter(a => {
      const isCompatible = /\/(tcp|udp|ws|wss)\//.test(a.address);
      return isCompatible;
    });
  }, [categorizedAddresses]);

  const [showAddresses, setShowAddresses] = useState(false);

  const formatTime = (dateString) => {
    if (!dateString) return 'unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="peer-container">
      <div className="peer-header">
        <Avatar peerId={peerId} />
        <div className="peer-id-section">
          <div className="peer-id" title={peerId}>
            <CopyText text={peerId} value={peerId} />
          </div>
          {latency !== null && <div className="peer-latency">{latency}ms</div>}
        </div>
      </div>

      {compatibleAddresses.length > 0 && (
        <div className="peer-section">
          <div className="peer-section-header">
            <h4>Addresses ({compatibleAddresses.length})</h4>
            <button
              type="button"
              className="peer-section-toggle"
              onClick={() => setShowAddresses((previous) => !previous)}
              aria-expanded={showAddresses}
              aria-controls={`peer-addresses-${peerId}`}
            >
              {showAddresses ? 'Minimize' : 'Expand'}
            </button>
          </div>

          {showAddresses && (
            <div className="addresses-list" id={`peer-addresses-${peerId}`}>
              {compatibleAddresses.map((addr, idx) => (
                <div 
                  key={idx} 
                  className={`address-item address-${addr.status}`}
                  style={{ 
                    borderLeftColor: addr.color,
                    opacity: addr.opacity
                  }}
                  title={addr.address}
                >
                  <span className="address-status" style={{ backgroundColor: addr.color }}>
                    {addr.status}
                  </span>                    
                    <CopyText text={addr.address} value={addr.address} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {protocols.length > 0 && (
        <div className="peer-section">
          <h4>Protocols</h4>
          <div className="protocols-list">
            {protocols.map((proto, idx) => (
              <span key={idx} className="protocol-badge">{proto}</span>
            ))}
          </div>
        </div>
      )}

      {lastSeen && (
        <div className="peer-footer">
          <span className="peer-last-seen">Last seen: {formatTime(lastSeen)}</span>
        </div>
      )}
    </div>
  );
};

export default Peer;
