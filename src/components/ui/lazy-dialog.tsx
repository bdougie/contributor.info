import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the Dialog components from Radix
export const LazyDialog = lazy(() => 
  import('@/components/ui/dialog').then(module => ({
    default: module.Dialog
  }))
);

export const LazyDialogContent = lazy(() => 
  import('@/components/ui/dialog').then(module => ({
    default: module.DialogContent
  }))
);

export const LazyDialogHeader = lazy(() => 
  import('@/components/ui/dialog').then(module => ({
    default: module.DialogHeader
  }))
);

export const LazyDialogTitle = lazy(() => 
  import('@/components/ui/dialog').then(module => ({
    default: module.DialogTitle
  }))
);

export const LazyDialogDescription = lazy(() => 
  import('@/components/ui/dialog').then(module => ({
    default: module.DialogDescription
  }))
);

export const LazyDialogFooter = lazy(() => 
  import('@/components/ui/dialog').then(module => ({
    default: module.DialogFooter
  }))
);

export const LazyDialogTrigger = lazy(() => 
  import('@/components/ui/dialog').then(module => ({
    default: module.DialogTrigger
  }))
);

// Loading fallback for dialogs
export const DialogSkeleton = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="bg-background/80 backdrop-blur-sm fixed inset-0" />
    <div className="fixed z-50 w-full max-w-lg p-6 bg-background border rounded-lg shadow-lg">
      <div className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex justify-end space-x-2 pt-4">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  </div>
);

// Wrapper component for lazy-loaded dialogs
interface LazyDialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function LazyDialogWrapper({ open, onOpenChange, children }: LazyDialogWrapperProps) {
  if (!open) {
    // Don't load the dialog components until it's opened
    return null;
  }

  return (
    <Suspense fallback={<DialogSkeleton />}>
      <LazyDialog open={open} onOpenChange={onOpenChange}>
        {children}
      </LazyDialog>
    </Suspense>
  );
}