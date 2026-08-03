import React, { useState } from 'react';
import styles from './ChatMessage.module.css';

const ChatMessage = ({ sender, content, timestamp }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTimestamp = () => {
    navigator.clipboard.writeText(new Date(timestamp).toLocaleString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (ts) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleString();
    }
  };

  return (
    <div className={styles.message}>
      <div className={styles.header}>
        <span className={styles.sender}>{sender}</span>
        <span className={styles.timestamp} title={new Date(timestamp).toLocaleString()}>
          {formatTime(timestamp)}
        </span>
      </div>
      <div className={styles.content}>
        <p>{content}</p>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.copyButton}
          onClick={handleCopyMessage}
          title="Copy message"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
        <button
          className={styles.copyButton}
          onClick={handleCopyTimestamp}
          title="Copy timestamp"
        >
          📅
        </button>
      </div>
    </div>
  );
};

export default ChatMessage;
