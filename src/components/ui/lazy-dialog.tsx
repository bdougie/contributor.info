import { lazy, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Export individual lazy components with proper typing
// Note: Each component imports from the same module, so webpack will 
// automatically deduplicate and create a single chunk
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

// Error boundary for handling failed chunk loading
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class DialogErrorBoundary extends Component<
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
    console.error('Dialog loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-background/80 backdrop-blur-sm fixed inset-0" onClick={() => this.props.onOpenChange(false)} />
          <div className="fixed z-50 w-full max-w-lg p-6 bg-background border rounded-lg shadow-lg">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-destructive">Failed to load dialog</h3>
              <p className="text-sm text-muted-foreground">
                There was an error loading this dialog. Please try refreshing the page.
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

// Wrapper component for lazy-loaded dialogs with error boundary
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
    <DialogErrorBoundary onOpenChange={onOpenChange}>
      <Suspense fallback={<DialogSkeleton />}>
        <LazyDialog open={open} onOpenChange={onOpenChange}>
          {children}
        </LazyDialog>
      </Suspense>
    </DialogErrorBoundary>
  );
}