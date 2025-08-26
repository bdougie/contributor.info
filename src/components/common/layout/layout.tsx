import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { ModeToggle } from '../theming';
import { AuthButton } from '../../features/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LazyNavigationSheet } from './lazy-navigation-sheet';
import { WorkspaceSwitcher } from '@/components/navigation/WorkspaceSwitcher';
import { supabase } from '@/lib/supabase';
import { useTimeRangeStore } from '@/lib/time-range-store';
import { usePrefetchOnIntent, prefetchCriticalRoutes } from '@/lib/route-prefetch';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

// Lazy load the command palette
const CommandPalette = lazy(() =>
  import('@/components/navigation/CommandPalette').then((m) => ({ default: m.CommandPalette })),
);
const CommandPaletteErrorBoundary = lazy(() =>
  import('@/components/navigation/CommandPaletteErrorBoundary').then((m) => ({
    default: m.CommandPaletteErrorBoundary,
  })),
);

export default function Layout() {
  const { timeRange, setTimeRange } = useTimeRangeStore();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPalettePreloaded, setCommandPalettePreloaded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaces, switchWorkspace } = useWorkspaceContext();

  // Prefetch handlers for navigation links
  const trendingPrefetch = usePrefetchOnIntent('/trending');
  const changelogPrefetch = usePrefetchOnIntent('/changelog');
  const docsPrefetch = usePrefetchOnIntent('/docs');

  // Check if current page needs time range controls
  const needsTimeRange = () => {
    const path = location.pathname;
    // Show on home page and repository pages
    return path === '/' || /^\/[^/]+\/[^/]+/.test(path);
  };

  // Preload command palette on hover
  const handlePreloadCommandPalette = useCallback(() => {
    if (!commandPalettePreloaded && !commandPaletteOpen) {
      setCommandPalettePreloaded(true);
      // Trigger the lazy loading
      import('@/components/navigation/CommandPalette');
      import('@/components/navigation/CommandPaletteErrorBoundary');
    }
  }, [commandPalettePreloaded, commandPaletteOpen]);

  // Set up keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      metaKey: true,
      handler: () => setCommandPaletteOpen(true),
      preventDefault: true,
    },
    // Quick workspace switching (Cmd+1 through Cmd+9)
    ...workspaces.slice(0, 9).map((workspace, index) => ({
      key: String(index + 1),
      metaKey: true,
      handler: () => switchWorkspace(workspace.id),
      preventDefault: true,
    })),
  ]);

  useEffect(() => {
    // Check login status
    supabase.auth.getSession().then(({ _data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    // Prefetch critical routes after initial load
    prefetchCriticalRoutes();

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          {/* Hamburger Menu - Now on all screen sizes */}
          <div className="flex items-center space-x-4">
            <LazyNavigationSheet isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen}>
              <nav className="flex flex-col space-y-4 mt-6" aria-label="Main navigation">
                <button
                  onClick={() => {
                    navigate('/');
                    setIsMenuOpen(false);
                  }}
                  className="text-lg font-semibold hover:text-primary transition-colors text-left"
                >
                  Home
                </button>
                <Link
                  to="/trending"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-base hover:text-primary transition-colors"
                  {...trendingPrefetch}
                >
                  🔥 Trending
                </Link>
                <Link
                  to="/changelog"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-base hover:text-primary transition-colors"
                  {...changelogPrefetch}
                >
                  Changelog
                </Link>
                <Link
                  to="/docs"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-base hover:text-primary transition-colors"
                  {...docsPrefetch}
                >
                  Docs
                </Link>

                {/* Time Range - only on relevant pages */}
                {isLoggedIn && needsTimeRange() && (
                  <section className="pt-4 border-t">
                    <label className="text-sm font-medium mb-2 block">Time Range</label>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select time range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </section>
                )}

                <section className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Theme</span>
                    <ModeToggle />
                  </div>
                </section>

                <section className="pt-4 border-t">
                  <nav
                    className="flex space-x-4 text-xs text-muted-foreground"
                    aria-label="Footer links"
                  >
                    <Link
                      to="/privacy"
                      onClick={() => setIsMenuOpen(false)}
                      className="hover:text-primary transition-colors"
                    >
                      Privacy
                    </Link>
                    <Link
                      to="/terms"
                      onClick={() => setIsMenuOpen(false)}
                      className="hover:text-primary transition-colors"
                    >
                      Terms
                    </Link>
                  </nav>
                </section>
              </nav>
            </LazyNavigationSheet>

            <button
              onClick={() => navigate('/')}
              className="text-xl font-bold hover:text-primary transition-colors"
            >
              contributor.info
            </button>
          </div>

          {/* Workspace and Auth Buttons */}
          <div className="ml-auto flex items-center gap-2">
            {isLoggedIn && (
              <div onMouseEnter={handlePreloadCommandPalette}>
                <WorkspaceSwitcher
                  className="min-w-[150px]"
                  onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                />
              </div>
            )}
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="flex-1 bg-muted/50 dark:bg-black">
        <div className="container px-4 py-6">
          <Outlet />
        </div>
      </main>
      <footer className="border-t py-4">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          Made with ❤️ by{' '}
          <a
            href="https://github.com/bdougie"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            bdougie
          </a>
        </div>
      </footer>

      {/* Command Palette */}
      <Suspense fallback={null}>
        <CommandPaletteErrorBoundary onReset={() => setCommandPaletteOpen(false)}>
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            workspaces={workspaces}
            repositories={[]} // TODO: Populate with user's recent repositories
            recentItems={[]} // TODO: Track recent items
          />
        </CommandPaletteErrorBoundary>
      </Suspense>
    </div>
  );
}
