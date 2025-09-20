import { lazy, Suspense } from 'react';
import { CommandPaletteSkeleton } from './CommandPaletteSkeleton';
import type { Workspace } from '@/contexts/WorkspaceContext';

// Lazy load the heavy command palette with all its dependencies
const CommandPaletteInner = lazy(() =>
  import('./CommandPalette').then((module) => ({
    default: module.CommandPalette,
  }))
);

interface Repository {
  owner: string;
  name: string;
  full_name: string;
  stars?: number;
  language?: string;
  description?: string;
}

interface RecentItem {
  type: 'workspace' | 'repository' | 'action';
  id: string;
  name: string;
  icon?: string;
}

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  workspaces?: Workspace[];
  repositories?: Repository[];
  recentItems?: RecentItem[];
  defaultSearchQuery?: string;
}

export function LazyCommandPalette(props: CommandPaletteProps) {
  return (
    <Suspense fallback={<CommandPaletteSkeleton open={props.open} />}>
      <CommandPaletteInner {...props} />
    </Suspense>
  );
}
