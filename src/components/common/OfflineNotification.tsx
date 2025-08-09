import { useEffect, useState } from 'react'
import { WifiOff, Wifi, AlertTriangle } from '@/components/ui/icon';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineNotification() {
  const { isOnline, isSlowConnection, effectiveType, saveData } = useOnlineStatus();
  const [showNotification, setShowNotification] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowNotification(true);
      setWasOffline(true);
      setShowBackOnline(false);
    } else if (wasOffline && isOnline) {
      // Show "back online" message briefly
      setShowNotification(false);
      setShowBackOnline(true);
      setWasOffline(false);
      
      // Hide the "back online" message after 3 seconds
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Show slow connection warning
  const showSlowWarning = isOnline && (isSlowConnection || saveData);

  if (!showNotification && !showBackOnline && !showSlowWarning) {
    return null;
  }

  return (
    <>
      {/* Offline notification */}
      {showNotification && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-100 text-sm">
                  You're offline
                </h3>
                <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                  Some features may be limited. Data will sync when you're back online.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back online notification */}
      {showBackOnline && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <Wifi className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-100 text-sm">
                  Back online
                </h3>
                <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                  Your connection has been restored.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slow connection warning */}
      {showSlowWarning && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 text-sm">
                  Slow connection detected
                </h3>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                  {saveData 
                    ? 'Data saver mode is on. Some features may be limited.'
                    : `You're on a ${effectiveType || 'slow'} connection. Loading may take longer.`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// CSS for animation (add to your global CSS or Tailwind config)
const animationStyles = `
@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
`;

// Export animation styles to be added to global CSS
export const offlineNotificationStyles = animationStyles;