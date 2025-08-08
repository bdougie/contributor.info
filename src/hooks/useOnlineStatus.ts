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

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>(() => {
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
  });

  useEffect(() => {
    const updateOnlineStatus = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      setStatus({
        isOnline: navigator.onLine,
        isSlowConnection: connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g' || false,
        connectionType: connection?.type,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
        saveData: connection?.saveData || false
      });
    };

    const handleOnline = () => {
      console.log('[Online Status] Connection restored');
      updateOnlineStatus();
    };

    const handleOffline = () => {
      console.log('[Online Status] Connection lost');
      updateOnlineStatus();
    };

    const handleConnectionChange = () => {
      console.log('[Online Status] Connection quality changed');
      updateOnlineStatus();
    };

    // Listen to online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to connection changes if available
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && 'addEventListener' in connection) {
      (connection as EventTarget).addEventListener('change', handleConnectionChange);
    }

    // Check status on mount
    updateOnlineStatus();

    // Periodic check (every 30 seconds)
    const intervalId = setInterval(updateOnlineStatus, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection && 'removeEventListener' in connection) {
        (connection as EventTarget).removeEventListener('change', handleConnectionChange);
      }
      
      clearInterval(intervalId);
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