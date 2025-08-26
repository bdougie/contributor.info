import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from '@/components/ui/icon';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useIsMobileDetailed } from '@/lib/utils/mobile-detection';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallPromptProps {
  className?: string;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export function PWAInstallPrompt({ className, onInstall, onDismiss }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { isMobile } = useIsMobileDetailed();

  useEffect(() => {
    // Check if already installed (running in standalone mode)
    const checkIfStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    setIsStandalone(checkIfStandalone());

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      const beforeInstallPromptEvent = e as BeforeInstallPromptEvent;
      e.preventDefault();
      setDeferredPrompt(beforeInstallPromptEvent);

      // Only show prompt if not already dismissed, not standalone, and on mobile
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed && !checkIfStandalone() && isMobile) {
        setShowPrompt(true);
      }
    };

    // Listen for successful app install
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      onInstall?.();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onInstall, isMobile]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for user response
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        onInstall?.();
      } else {
        console.log('User dismissed the install prompt');
      }

      // Clean up
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch () {
      console.error('Error during install:', _error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember user dismissed the prompt
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    onDismiss?.();
  };

  // Don't show if already installed, no prompt available, or not on mobile
  if (isStandalone || !showPrompt || !deferredPrompt || !isMobile) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm',
        'bg-card border rounded-lg shadow-lg p-4',
        'transform transition-all duration-300 ease-in-out',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-card-foreground">Install Contributor Info</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            Get quick access to contributor insights right from your home screen.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="text-xs h-8 px-3"
            >
              {isInstalling
? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Installing...
                </>
              )
: (
                <>
                  <Download className="w-3 h-3 mr-1" />
                  Install
                </>
              )}
            </Button>

            <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs h-8 px-3">
              Not now
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="flex-shrink-0 h-8 w-8 p-0"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}

// Hook for programmatic PWA install
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      const beforeInstallPromptEvent = e as BeforeInstallPromptEvent;
      e.preventDefault();
      setDeferredPrompt(beforeInstallPromptEvent);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      setDeferredPrompt(null);
      setCanInstall(false);

      return choiceResult.outcome === 'accepted';
    } catch () {
      console.error('Error during install:', _error);
      return false;
    } finally {
      setIsInstalling(false);
    }
  };

  return { canInstall, isInstalling, install };
}
