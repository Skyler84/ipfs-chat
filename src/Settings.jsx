import React, { useState, useEffect } from 'react';
import './Settings.css';

export default function Settings() {
  const [settings, setSettings] = useState({
    detectPeers: true,
    providePeers: true,
    gatewayURL: 'https://gateway.ipfs.io'
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('ipfs-chat-settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to parse settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ipfs-chat-settings', JSON.stringify(settings));
  }, [settings]);

  const handleCheckboxChange = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleGatewayURLChange = (e) => {
    setSettings(prev => ({
      ...prev,
      gatewayURL: e.target.value
    }));
  };

  return (
    <div className="settings-container">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Discovery</h2>
        
        <div className="settings-item">
          <label>
            <input
              type="checkbox"
              checked={settings.detectPeers}
              onChange={() => handleCheckboxChange('detectPeers')}
            />
            Detect channel peers using provider discovery
          </label>
          <p className="settings-description">
            Enable peer discovery to find other users in chat channels
          </p>
        </div>

        <div className="settings-item">
          <label>
            <input
              type="checkbox"
              checked={settings.providePeers}
              onChange={() => handleCheckboxChange('providePeers')}
            />
            Provide to allow channel peer discovery
          </label>
          <p className="settings-description">
            Allow other peers to discover you in chat channels
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2>Gateway</h2>
        
        <div className="settings-item">
          <label htmlFor="gateway-url">Gateway URL</label>
          <p className="settings-description">
            URL used for providing links to users without local IPFS installation
          </p>
          <input
            id="gateway-url"
            type="text"
            value={settings.gatewayURL}
            onChange={handleGatewayURLChange}
            placeholder="https://gateway.ipfs.io"
            className="gateway-input"
          />
        </div>
      </section>
    </div>
  );
}
