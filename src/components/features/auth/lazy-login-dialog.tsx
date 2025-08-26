import { lazy, Suspense } from 'react';
import { DialogSkeleton } from '@/components/ui/lazy-dialog';

// Lazy load the LoginDialog component
const LoginDialog = lazy(() =>
  import('./login-dialog').then((module) => ({
    default: module.LoginDialog,
  })),
);

interface LazyLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lazy-loaded version of LoginDialog
 * Only loads the dialog code when it's actually opened
 */
export function LazyLoginDialog({ open, onOpenChange }: LazyLoginDialogProps) {
  // Don't render anything if dialog is not open
  if (!open) {
    return null;
  }

  return (
    <Suspense fallback={<DialogSkeleton />}>
      <LoginDialog open={open} onOpenChange={onOpenChange} />
    </Suspense>
  );
}
