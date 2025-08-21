import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the Sheet components
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

// Loading fallback for sheets
export const SheetSkeleton = ({ side = 'left' }: { side?: 'left' | 'right' | 'top' | 'bottom' }) => {
  const positionClasses = {
    left: 'left-0 top-0 h-full w-[300px] border-r',
    right: 'right-0 top-0 h-full w-[300px] border-l',
    top: 'top-0 left-0 w-full h-[300px] border-b',
    bottom: 'bottom-0 left-0 w-full h-[300px] border-t'
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
      <div className={`fixed z-50 bg-background p-6 shadow-lg transition-transform ${positionClasses[side]}`}>
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

// Wrapper component for lazy-loaded sheets
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
    <Suspense fallback={<SheetSkeleton side={side} />}>
      <LazySheet open={open} onOpenChange={onOpenChange}>
        {children}
      </LazySheet>
    </Suspense>
  );
}