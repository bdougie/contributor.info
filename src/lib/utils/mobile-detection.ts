import { useState, useEffect } from 'react';

// Mobile breakpoint (matches Tailwind's 'md' breakpoint)
const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect if the user is on a mobile device based on screen width
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Check on initial load
    checkIsMobile();

    // Listen for resize events
    window.addEventListener('resize', checkIsMobile);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, [breakpoint]);

  return isMobile;
}

/**
 * Server-side safe mobile detection
 */
export function getIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  if (typeof window === 'undefined') {
    return false; // Default to desktop for SSR
  }
  
  return window.innerWidth < breakpoint;
}

/**
 * User agent based mobile detection (for more accurate detection)
 */
export function getIsMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  return mobileRegex.test(userAgent);
}

/**
 * Combined mobile detection using both viewport and user agent
 */
export function useIsMobileDetailed() {
  const [mobileInfo, setMobileInfo] = useState({
    isMobile: false,
    isSmallScreen: false,
    isTouch: false,
    userAgent: ''
  });

  useEffect(() => {
    const updateMobileInfo = () => {
      const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;
      const isMobileUA = getIsMobileUserAgent();
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      setMobileInfo({
        isMobile: isSmallScreen || isMobileUA,
        isSmallScreen,
        isTouch,
        userAgent: navigator.userAgent
      });
    };

    updateMobileInfo();
    window.addEventListener('resize', updateMobileInfo);

    return () => {
      window.removeEventListener('resize', updateMobileInfo);
    };
  }, []);

  return mobileInfo;
}

/**
 * Performance-aware viewport detection
 */
export function useViewportSize() {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    isMobile: false,
    isTablet: false,
    isDesktop: false
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const updateViewport = () => {
      // Debounce resize events for performance
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        setViewport({
          width,
          height,
          isMobile: width < 768,
          isTablet: width >= 768 && width < 1024,
          isDesktop: width >= 1024
        });
      }, 100);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      clearTimeout(timeoutId);
    };
  }, []);

  return viewport;
}

/**
 * Network-aware mobile detection for adaptive loading
 */
export function useNetworkAwareDetection() {
  const [networkInfo, setNetworkInfo] = useState({
    isSlowConnection: false,
    effectiveType: '4g',
    downlink: 10
  });

  const isMobile = useIsMobile();

  useEffect(() => {
    const updateNetworkInfo = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;

      if (connection) {
        const isSlowConnection = connection.effectiveType === 'slow-2g' || 
                                connection.effectiveType === '2g' ||
                                connection.downlink < 1.5;

        setNetworkInfo({
          isSlowConnection,
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10
        });
      }
    };

    updateNetworkInfo();

    // Listen for network changes
    window.addEventListener('online', updateNetworkInfo);
    window.addEventListener('offline', updateNetworkInfo);

    return () => {
      window.removeEventListener('online', updateNetworkInfo);
      window.removeEventListener('offline', updateNetworkInfo);
    };
  }, []);

  return {
    isMobile,
    ...networkInfo,
    shouldUseSimplifiedUI: isMobile || networkInfo.isSlowConnection
  };
}