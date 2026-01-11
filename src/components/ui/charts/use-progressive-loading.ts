import { useState, useEffect } from 'react';

type LoadingStage = 'skeleton' | 'low-fi' | 'high-fi';

/**
 * Hook for using progressive loading pattern
 */
export function useProgressiveLoading(
  options: {
    priority?: boolean;
    lowFiDelay?: number;
    highFiDelay?: number;
  } = {}
) {
  const [stage, setStage] = useState<LoadingStage>('skeleton');
  const [isVisible, setIsVisible] = useState(options.priority || false);

  useEffect(() => {
    if (!isVisible) return;

    const timeouts: { lowFi?: NodeJS.Timeout; highFi?: NodeJS.Timeout } = {};

    // Progress through stages
    timeouts.lowFi = setTimeout(() => {
      setStage('low-fi');
    }, options.lowFiDelay || 100);

    timeouts.highFi = setTimeout(() => {
      setStage('high-fi');
    }, options.highFiDelay || 500);

    return () => {
      if (timeouts.lowFi) clearTimeout(timeouts.lowFi);
      if (timeouts.highFi) clearTimeout(timeouts.highFi);
    };
  }, [isVisible, options.lowFiDelay, options.highFiDelay]);

  return {
    stage,
    isVisible,
    setIsVisible,
    isSkeleton: stage === 'skeleton',
    isLowFi: stage === 'low-fi',
    isHighFi: stage === 'high-fi',
  };
}
