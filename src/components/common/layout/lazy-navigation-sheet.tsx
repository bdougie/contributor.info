import { lazy, Suspense } from 'react';
import { Menu } from '@/components/ui/icon';
import { SheetSkeleton } from '@/components/ui/lazy-sheet';

// Lazy load Sheet components only when menu is opened
const Sheet = lazy(() => import('@/components/ui/sheet').then((m) => ({ default: m.Sheet })));
const SheetContent = lazy(() =>
  import('@/components/ui/sheet').then((m) => ({ default: m.SheetContent }))
);
const SheetHeader = lazy(() =>
  import('@/components/ui/sheet').then((m) => ({ default: m.SheetHeader }))
);
const SheetTitle = lazy(() =>
  import('@/components/ui/sheet').then((m) => ({ default: m.SheetTitle }))
);
const SheetTrigger = lazy(() =>
  import('@/components/ui/sheet').then((m) => ({ default: m.SheetTrigger }))
);

interface LazyNavigationSheetProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Lazy-loaded navigation sheet that only loads Radix Dialog/Sheet when opened
 * This reduces the initial bundle size by ~15KB
 */
export function LazyNavigationSheet({
  isMenuOpen,
  setIsMenuOpen,
  children,
}: LazyNavigationSheetProps) {
  // Always render the trigger button
  const triggerButton = (
    <button
      onClick={() => setIsMenuOpen(true)}
      className="p-2 hover:bg-muted rounded-md transition-colors"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );

  // If menu has never been opened, just show the trigger
  if (!isMenuOpen) {
    return triggerButton;
  }

  // Once opened, load the Sheet components
  return (
    <Suspense
      fallback={
        <>
          {triggerButton}
          <SheetSkeleton side="left" />
        </>
      }
    >
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        <SheetContent side="left" className="w-[300px] sm:w-[350px]">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    </Suspense>
  );
}
