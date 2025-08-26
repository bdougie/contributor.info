import { useState, useEffect } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | undefined;
  effectiveType: string | undefined;
  downlink: number | undefined;
  rtt: number | undefined;
  saveData: boolean;
}

interface NavigatorConnection {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  type?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

declare global {
  interface Navigator {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  }
}

// Shared state to prevent duplicate event listeners
let sharedStatus: OnlineStatus | null = null;
const listeners: Set<(status: OnlineStatus) => void> = new Set();
let intervalId: number | null = null;

// Initialize shared status safely for SSR
function getInitialStatus(): OnlineStatus {
  if (typeof navigator === 'undefined') {
    return {
      isOnline: true,
      isSlowConnection: false,
      connectionType: undefined,
      effectiveType: undefined,
      downlink: undefined,
      rtt: undefined,
      saveData: false
    };
  }
  
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  return {
    isOnline: navigator.onLine,
    isSlowConnection: connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g' || false,
    connectionType: connection?.type,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
    saveData: connection?.saveData || false
  };
}

// Update all subscribers
function notifyListeners(status: OnlineStatus) {
  sharedStatus = status;
  listeners.forEach(listener => listener(_status));
}

// Setup shared event listeners once
function setupSharedListeners() {
  if (typeof window === 'undefined') return;
  
  const updateStatus = () => {
    const newStatus = getInitialStatus();
    notifyListeners(newStatus);
  };

  const handleOnline = () => {
    console.log('[Online Status] Connection restored');
    updateStatus();
  };

  const handleOffline = () => {
    console.log('[Online Status] Connection lost');
    updateStatus();
  };

  const handleConnectionChange = () => {
    console.log('[Online Status] Connection quality changed');
    updateStatus();
  };

  // Listen to online/offline events
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Listen to connection changes if available
  if (typeof navigator !== 'undefined') {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && 'addEventListener' in connection) {
      (connection as EventTarget).addEventListener('change', handleConnectionChange);
    }
  }

  // Periodic check (every 30 seconds)
  intervalId = window.setInterval(updateStatus, 30000);

  // Initial status update
  updateStatus();

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    
    if (typeof navigator !== 'undefined') {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection && 'removeEventListener' in connection) {
        (connection as EventTarget).removeEventListener('change', handleConnectionChange);
      }
    }
    
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

let cleanup: (() => void) | null = null;

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>(() => {
    // Safe initialization for SSR
    return sharedStatus || getInitialStatus();
  });

  useEffect(() => {
    // Setup shared listeners if not already done
    if (listeners.size === 0 && cleanup === null) {
      cleanup = setupSharedListeners() || null;
    }

    // Add this component's listener
    listeners.add(setStatus);

    // Set initial status if available
    if (sharedStatus) {
      setStatus(sharedStatus);
    }

    return () => {
      // Remove this component's listener
      listeners.delete(setStatus);
      
      // If no more listeners, cleanup shared resources
      if (listeners.size === 0 && cleanup) {
        cleanup();
        cleanup = null;
        sharedStatus = null;
      }
    };
  }, []);

  return status;
}

// Helper hook for simple online/offline state
export function useIsOnline(): boolean {
  const { isOnline } = useOnlineStatus();
  return isOnline;
}

// Helper hook to detect if user is on a metered/slow connection
export function useIsSlowConnection(): boolean {
  const { isSlowConnection, saveData } = useOnlineStatus();
  return isSlowConnection || saveData;
}