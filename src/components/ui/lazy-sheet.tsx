import { lazy, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Export individual lazy components with proper typing
// Note: Each component imports from the same module, so webpack will 
// automatically deduplicate and create a single chunk
export const LazySheet = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.Sheet
  }))
);

export const LazySheetContent = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetContent
  }))
);

export const LazySheetHeader = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetHeader
  }))
);

export const LazySheetTitle = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetTitle
  }))
);

export const LazySheetDescription = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetDescription
  }))
);

export const LazySheetTrigger = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetTrigger
  }))
);

export const LazySheetFooter = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetFooter
  }))
);

export const LazySheetClose = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetClose
  }))
);

export const LazySheetPortal = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetPortal
  }))
);

export const LazySheetOverlay = lazy(() => 
  import('@/components/ui/sheet').then(module => ({
    default: module.SheetOverlay
  }))
);

// Loading fallback for sheets with flexible positioning
interface SheetSkeletonProps {
  side?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
  width?: string;
  height?: string;
}

export const SheetSkeleton = ({ 
  side = 'left', 
  className,
  width = '300px',
  height = '300px'
}: SheetSkeletonProps) => {
  const getPositionClasses = () => {
    switch (side) {
      case 'left':
        return cn('left-0 top-0 h-full border-r', `w-[${width}]`);
      case 'right':
        return cn('right-0 top-0 h-full border-l', `w-[${width}]`);
      case 'top':
        return cn('top-0 left-0 w-full border-b', `h-[${height}]`);
      case 'bottom':
        return cn('bottom-0 left-0 w-full border-t', `h-[${height}]`);
      default:
        return cn('left-0 top-0 h-full border-r', `w-[${width}]`);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
      <div className={cn(
        'fixed z-50 bg-background p-6 shadow-lg transition-transform',
        getPositionClasses(),
        className
      )}>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </>
  );
};

// Error boundary for handling failed chunk loading
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SheetErrorBoundary extends Component<
  { children: ReactNode; onOpenChange: (open: boolean) => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onOpenChange: (open: boolean) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Sheet loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-background/80 backdrop-blur-sm fixed inset-0" onClick={() => this.props.onOpenChange(false)} />
          <div className="fixed z-50 w-full max-w-lg p-6 bg-background border rounded-lg shadow-lg">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-destructive">Failed to load menu</h3>
              <p className="text-sm text-muted-foreground">
                There was an error loading the navigation menu. Please try refreshing the page.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => this.props.onOpenChange(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-secondary hover:bg-secondary/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for lazy-loaded sheets with error boundary
interface LazySheetWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'top' | 'bottom';
}

export function LazySheetWrapper({ open, onOpenChange, children, side = 'left' }: LazySheetWrapperProps) {
  if (!open) {
    // Don't load the sheet components until it's opened
    return null;
  }

  return (
    <SheetErrorBoundary onOpenChange={onOpenChange}>
      <Suspense fallback={<SheetSkeleton side={side} />}>
        <LazySheet open={open} onOpenChange={onOpenChange}>
          {children}
        </LazySheet>
      </Suspense>
    </SheetErrorBoundary>
  );
}