import { Suspense, ReactNode } from 'react';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import { SkeletonChart } from '@/components/skeletons/base/skeleton-chart';

interface LazyChartWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  threshold?: number;
  className?: string;
  skeletonHeight?: "sm" | "md" | "lg" | "xl";
}

/**
 * Wrapper component for lazy loading charts with IntersectionObserver
 * Charts only load when scrolled into view, significantly reducing initial bundle
 */
export function LazyChartWrapper({
  children,
  fallback,
  rootMargin = '100px',
  threshold = 0,
  className = '',
  skeletonHeight = 'lg'
}: LazyChartWrapperProps) {
  const { ref, hasIntersected } = useIntersectionObserver({
    rootMargin,
    threshold,
    triggerOnce: true
  });

  return (
    <div 
      ref={ref}
      className={className}
    >
      {hasIntersected ? (
        <Suspense fallback={fallback || <SkeletonChart height={skeletonHeight} />}>
          {children}
        </Suspense>
      ) : (
        fallback || <SkeletonChart height={skeletonHeight} />
      )}
    </div>
  );
}