import { Menu } from '@/components/ui/icon';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface LazyNavigationSheetProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Navigation sheet component - direct import for reliable UX
 */
export function LazyNavigationSheet({
  isMenuOpen,
  setIsMenuOpen,
  children,
}: LazyNavigationSheetProps) {
  return (
    <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <SheetTrigger asChild>
        <button className="p-2 hover:bg-muted rounded-md transition-colors" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
