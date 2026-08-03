import React, { useEffect, useRef, useState } from 'react';

const TOAST_LIFETIME_MS = 3000;
const TOAST_FADE_MS = 400;

const toastStore = {
  toasts: [],
  listeners: new Set(),
  timers: new Map(),
  mountedInstances: new Set(),
  viewportOwnerId: null,
};

const notifyToastStore = () => {
  const state = {
    toasts: toastStore.toasts,
    viewportOwnerId: toastStore.viewportOwnerId,
  };

  toastStore.listeners.forEach((listener) => listener(state));
};

const subscribeToToastStore = (listener) => {
  toastStore.listeners.add(listener);
  listener({
    toasts: toastStore.toasts,
    viewportOwnerId: toastStore.viewportOwnerId,
  });

  return () => {
    toastStore.listeners.delete(listener);
  };
};

const registerToastViewportInstance = (instanceId) => {
  toastStore.mountedInstances.add(instanceId);

  if (!toastStore.viewportOwnerId) {
    toastStore.viewportOwnerId = instanceId;
  }

  notifyToastStore();
};

const unregisterToastViewportInstance = (instanceId) => {
  toastStore.mountedInstances.delete(instanceId);

  if (toastStore.viewportOwnerId === instanceId) {
    const nextOwner = toastStore.mountedInstances.values().next().value;
    toastStore.viewportOwnerId = nextOwner || null;
  }

  notifyToastStore();
};

const addToastToQueue = (textValue) => {
  const toastId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const toast = { id: toastId, text: textValue, exiting: false };

  toastStore.toasts = [...toastStore.toasts, toast];
  notifyToastStore();

  const fadeTimer = setTimeout(() => {
    toastStore.toasts = toastStore.toasts.map((item) =>
      item.id === toastId ? { ...item, exiting: true } : item,
    );
    notifyToastStore();

    const removeTimer = setTimeout(() => {
      toastStore.toasts = toastStore.toasts.filter((item) => item.id !== toastId);
      toastStore.timers.delete(toastId);
      notifyToastStore();
    }, TOAST_FADE_MS);

    toastStore.timers.set(toastId, removeTimer);
  }, TOAST_LIFETIME_MS);

  toastStore.timers.set(toastId, fadeTimer);
};

export const CopyText = ({ text, value }) => {
  const instanceIdRef = useRef(`copytext-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const [toastState, setToastState] = useState({
    toasts: toastStore.toasts,
    viewportOwnerId: toastStore.viewportOwnerId,
  });

  useEffect(() => {
    const instanceId = instanceIdRef.current;
    registerToastViewportInstance(instanceId);
    const unsubscribe = subscribeToToastStore(setToastState);

    return () => {
      unsubscribe();
      unregisterToastViewportInstance(instanceId);
    };
  }, []);

  const handleClick = () => {
    navigator.clipboard.writeText(value);
    addToastToQueue(String(value));
  };

  return (
    <>
      <span onClick={handleClick} style={{ cursor: 'pointer' }}>
        {text}
      </span>

      {toastState.viewportOwnerId === instanceIdRef.current && toastState.toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 9999,
            pointerEvents: 'none',
            width: 'min(90vw, 540px)',
          }}
        >
          {toastState.toasts.map((toast) => (
            <div
              key={toast.id}
              style={{
                alignSelf: 'center',
                maxWidth: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                opacity: toast.exiting ? 0 : 1,
                transform: toast.exiting ? 'translateY(12px)' : 'translateY(0)',
                transition: `opacity ${TOAST_FADE_MS}ms ease, transform ${TOAST_FADE_MS}ms ease`,
              }}
            >
              {`Copied: "${toast.text}"`}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default CopyText;
