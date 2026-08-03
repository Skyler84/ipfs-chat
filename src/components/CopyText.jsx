import React, { useEffect, useRef, useState } from 'react';

export const CopyText = ({ text, value }) => {
  const [copiedText, setCopiedText] = useState('');
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    navigator.clipboard.writeText(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setCopiedText(String(value));
    timeoutRef.current = setTimeout(() => {
      setCopiedText('');
      timeoutRef.current = null;
    }, 3000);
  };

  return (
    <>
      <span onClick={handleClick} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {text}
      </span>

      {copiedText && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '0.875rem',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
            maxWidth: '90vw',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {`Copied: "${copiedText}"`}
        </div>
      )}
    </>
  );
};

export default CopyText;
