import { useCallback, useEffect, useRef, useState } from 'react'

const MOBILE_BREAKPOINT = 768
const MOBILE_SWIPE_THRESHOLD = 72
const MOBILE_EDGE_SWIPE_ZONE = 32

export const useMobilePanels = () => {
  const [mobilePanel, setMobilePanel] = useState(null)
  const touchStartRef = useRef(null)

  const isMobileViewport = useCallback(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  }, [])

  const closeMobilePanel = useCallback(() => {
    setMobilePanel(null)
  }, [])

  const toggleMobilePanel = useCallback((panel) => {
    setMobilePanel((previous) => (previous === panel ? null : panel))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)

    const syncPanelState = () => {
      if (!mediaQuery.matches) {
        setMobilePanel(null)
      }
    }

    syncPanelState()
    mediaQuery.addEventListener('change', syncPanelState)

    return () => {
      mediaQuery.removeEventListener('change', syncPanelState)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined' || !isMobileViewport()) {
      return
    }

    const previousOverflow = document.body.style.overflow

    if (mobilePanel != null) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileViewport, mobilePanel])

  const handleShellTouchStart = useCallback((event) => {
    const touch = event.changedTouches?.[0]

    if (touch == null) {
      return
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY
    }
  }, [])

  const handleShellTouchEnd = useCallback((event) => {
    if (!isMobileViewport() || typeof window === 'undefined') {
      touchStartRef.current = null
      return
    }

    const start = touchStartRef.current
    const touch = event.changedTouches?.[0]
    touchStartRef.current = null

    if (start == null || touch == null) {
      return
    }

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (Math.abs(deltaX) < MOBILE_SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return
    }

    if (mobilePanel === 'rooms' && deltaX < 0) {
      setMobilePanel(null)
      return
    }

    if (mobilePanel === 'members' && deltaX > 0) {
      setMobilePanel(null)
      return
    }

    if (mobilePanel != null) {
      return
    }

    if (deltaX > 0 && start.x <= MOBILE_EDGE_SWIPE_ZONE) {
      setMobilePanel('rooms')
    }

    if (deltaX < 0 && start.x >= window.innerWidth - MOBILE_EDGE_SWIPE_ZONE) {
      setMobilePanel('members')
    }
  }, [isMobileViewport, mobilePanel])

  return {
    mobilePanel,
    isMobileViewport,
    closeMobilePanel,
    toggleMobilePanel,
    handleShellTouchStart,
    handleShellTouchEnd
  }
}