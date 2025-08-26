import React, { useState, useEffect, useRef, Suspense } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressiveChartProps {
  /**
   * Skeleton component to show immediately while loading
   */
  skeleton: React.ReactNode;

  /**
   * Low-fidelity chart component (lightweight SVG/Canvas)
   * Optional - if not provided, will skip to high-fidelity
   */
  lowFidelity?: React.ReactNode;

  /**
   * High-fidelity chart component (full interactive chart)
   * Can be a lazy-loaded component
   */
  highFidelity: React.ReactNode;

  /**
   * Delay before showing low-fidelity chart (ms)
   * @default 100
   */
  lowFiDelay?: number;

  /**
   * Delay before showing high-fidelity chart (ms)
   * @default 500
   */
  highFiDelay?: number;

  /**
   * Whether to load immediately or wait for intersection
   * @default false
   */
  priority?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Intersection observer options
   */
  observerOptions?: IntersectionObserverInit;
}

type LoadingStage = 'skeleton' | 'low-fi' | 'high-fi';

/**
 * Progressive chart loading component
 * Implements a three-stage loading pattern:
 * 1. Skeleton (immediate)
 * 2. Low-fidelity chart (100ms)
 * 3. High-fidelity chart (500ms or on intersection)
 */
export function ProgressiveChart({
  skeleton,
  lowFidelity,
  highFidelity,
  lowFiDelay = 100,
  highFiDelay = 500,
  priority = false,
  className,
  observerOptions = {
    rootMargin: '50px',
    threshold: 0.01,
  },
}: ProgressiveChartProps) {
  const [stage, setStage] = useState<LoadingStage>('skeleton');
  const [isVisible, setIsVisible] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<{ lowFi?: NodeJS.Timeout; highFi?: NodeJS.Timeout }>({});

  // Intersection observer for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      });
    }, observerOptions);

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [priority, observerOptions]);

  // Progressive loading stages
  useEffect(() => {
    if (!isVisible) return;

    // Stage 1: Skeleton is already showing

    // Stage 2: Low-fidelity chart (if provided)
    if (lowFidelity) {
      timeoutsRef.current.lowFi = setTimeout(() => {
        setStage('low-fi');
      }, lowFiDelay);
    }

    // Stage 3: High-fidelity chart
    timeoutsRef.current.highFi = setTimeout(
      () => {
        setStage('high-fi');
      },
      lowFidelity ? highFiDelay : lowFiDelay,
    );

    return () => {
      if (timeoutsRef.current.lowFi) {
        clearTimeout(timeoutsRef.current.lowFi);
      }
      if (timeoutsRef.current.highFi) {
        clearTimeout(timeoutsRef.current.highFi);
      }
    };
  }, [isVisible, lowFidelity, lowFiDelay, highFiDelay]);

  const renderContent = () => {
    switch (stage) {
      case 'skeleton':
        return (
          <div className="progressive-chart-skeleton animate-in fade-in duration-200">
            {skeleton}
          </div>
        );

      case 'low-fi':
        return (
          <div className="progressive-chart-lowfi animate-in fade-in duration-300">
            {lowFidelity}
          </div>
        );

      case 'high-fi':
        return (
          <Suspense
            fallback={<div className="progressive-chart-fallback">{lowFidelity || skeleton}</div>}
          >
            <div className="progressive-chart-highfi animate-in fade-in duration-500">
              {highFidelity}
            </div>
          </Suspense>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'progressive-chart-container relative',
        'transition-opacity duration-500',
        className,
      )}
      data-stage={stage}
      aria-busy={stage !== 'high-fi'}
    >
      {renderContent()}
    </div>
  );
}

/**
 * Hook for using progressive loading pattern
 */
export function useProgressiveLoading(
  options: {
    priority?: boolean;
    lowFiDelay?: number;
    highFiDelay?: number;
  } = {},
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
