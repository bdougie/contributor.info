import { lazy, Suspense } from 'react';
import { CommandPaletteSkeleton } from './CommandPaletteSkeleton';

// Lazy load the heavy command palette with all its dependencies
const CommandPaletteInner = lazy(() => 
  import('./CommandPalette').then(module => ({
    default: module.CommandPalette
  }))
);

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  workspaces?: any[];
  repositories?: any[];
  recentItems?: any[];
  defaultSearchQuery?: string;
}

export function LazyCommandPalette(props: CommandPaletteProps) {
  return (
    <Suspense fallback={<CommandPaletteSkeleton open={props.open} />}>
      <CommandPaletteInner {...props} />
    </Suspense>
  );
}