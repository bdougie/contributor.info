import { useCallback, useRef } from 'react';
import { Menu } from '@/components/ui/icon';
import {
  LazySheetWrapper,
  LazySheetContent,
  LazySheetHeader,
  LazySheetTitle,
} from '@/components/ui/lazy-sheet';

// Preload function - imports the sheet module ahead of time
let preloadPromise: Promise<unknown> | null = null;
const preloadSheet = () => {
  if (!preloadPromise) {
    preloadPromise = import('@/components/ui/sheet');
  }
  return preloadPromise;
};

interface LazyNavigationSheetProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Navigation sheet with preload-on-hover for optimal performance
 * - Lazy loads sheet components (saves ~15KB from initial bundle)
 * - Preloads on hover/focus so it's ready before click
 * - No flicker because module loads during hover intent
 */
export function LazyNavigationSheet({
  isMenuOpen,
  setIsMenuOpen,
  children,
}: LazyNavigationSheetProps) {
  const hasPreloaded = useRef(false);

  const handlePreload = useCallback(() => {
    if (!hasPreloaded.current) {
      hasPreloaded.current = true;
      preloadSheet();
    }
  }, []);

  const handleClick = useCallback(() => {
    // Ensure preload started, then open
    handlePreload();
    setIsMenuOpen(true);
  }, [handlePreload, setIsMenuOpen]);

  return (
    <>
      {/* Trigger button - always rendered, not lazy */}
      <button
        className="p-2 hover:bg-muted rounded-md transition-colors"
        aria-label="Open menu"
        aria-expanded={isMenuOpen}
        aria-haspopup="dialog"
        onClick={handleClick}
        onMouseEnter={handlePreload}
        onFocus={handlePreload}
        onTouchStart={handlePreload}
        data-tour="navigation-menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sheet content - lazy loaded, only renders when open */}
      <LazySheetWrapper open={isMenuOpen} onOpenChange={setIsMenuOpen} side="left">
        <LazySheetContent side="left" className="w-[300px] sm:w-[350px]">
          <LazySheetHeader>
            <LazySheetTitle>Menu</LazySheetTitle>
          </LazySheetHeader>
          {children}
        </LazySheetContent>
      </LazySheetWrapper>
    </>
  );
}
