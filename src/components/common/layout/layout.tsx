import { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router';
import { ModeToggle } from '../theming';
import { AuthButton } from '../../features/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NavigationOverlay, NavSection, NavLink } from './navigation-overlay';
import { WorkspaceSwitcher } from '@/components/navigation/WorkspaceSwitcher';
import { NotificationDropdown } from '@/components/notifications';
import { TourTriggerButton } from '@/components/features/onboarding';
import { getSupabase } from '@/lib/supabase-lazy';
import { useTimeRangeStore } from '@/lib/time-range-store';
import { prefetchCriticalRoutes } from '@/lib/route-prefetch';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { trackEvent } from '@/lib/posthog-lazy';
import { useAnalytics } from '@/hooks/use-analytics';

// Lazy load the command palette
const CommandPalette = lazy(() =>
  import('@/components/navigation/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const CommandPaletteErrorBoundary = lazy(() =>
  import('@/components/navigation/CommandPaletteErrorBoundary').then((m) => ({
    default: m.CommandPaletteErrorBoundary,
  }))
);

export default function Layout() {
  const { timeRange, setTimeRange } = useTimeRangeStore();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPalettePreloaded, setCommandPalettePreloaded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaces, switchWorkspace, isLoading: workspacesLoading } = useWorkspaceContext();
  // Simplified check - just use the working context instead of a separate broken hook
  const needsOnboarding = workspaces.length === 0;
  const onboardingLoading = workspacesLoading;
  const hasTrackedCTA = useRef(false);

  // PLG Tracking: First page view tracking
  const { trackFirstPageView } = useAnalytics();

  // Check if current page needs time range controls
  const needsTimeRange = () => {
    const path = location.pathname;
    // Show on home page and repository pages
    return path === '/' || /^\/[^/]+\/[^/]+/.test(path);
  };

  // Check if current page is a workspace page (where we show switcher inline)
  const isWorkspacePage = () => {
    const path = location.pathname;
    return path.startsWith('/w/') || path.startsWith('/workspace');
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

  // PLG Tracking: Track first page view of the session
  useEffect(() => {
    // Fire once per session - utility handles deduplication
    trackFirstPageView();
  }, [trackFirstPageView]);

  // Track workspace CTA visibility
  useEffect(() => {
    if (needsOnboarding && !onboardingLoading && !hasTrackedCTA.current) {
      hasTrackedCTA.current = true;
      trackEvent('workspace_cta_viewed', {
        page_path: window.location.pathname,
        workspace_count: 0,
      });
    }
  }, [needsOnboarding, onboardingLoading]);

  // Handle workspace CTA click
  const handleCreateWorkspace = useCallback(() => {
    trackEvent('workspace_cta_clicked', {
      source: 'header_cta',
      page_path: window.location.pathname,
    });
    navigate('/workspaces/new');
  }, [navigate]);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    // Initialize Supabase lazily and set up auth listeners
    const initAuth = async () => {
      try {
        const supabase = await getSupabase();

        // Check if component unmounted during async init
        if (!isMounted) return;

        // Check login status
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (isMounted) {
          setIsLoggedIn(!!session);
        }

        // Listen for auth changes
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (isMounted) {
            setIsLoggedIn(!!session);
          }
        });
        subscription = data.subscription;
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        if (isMounted) {
          setIsLoggedIn(false);
        }
      }
    };

    initAuth();

    // Prefetch critical routes after initial load
    prefetchCriticalRoutes();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip to main content link - first focusable element for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          {/* Navigation Menu - Modern overlay with accessibility */}
          <div className="flex items-center space-x-4">
            <NavigationOverlay isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <nav className="flex flex-col" aria-label="Main navigation">
                {/* Primary Navigation */}
                <NavSection title="Navigation" titleId="nav-section-main">
                  <NavLink
                    onClick={() => {
                      navigate('/');
                      setIsMenuOpen(false);
                    }}
                  >
                    Home
                  </NavLink>
                  <NavLink
                    onClick={() => {
                      navigate('/trending');
                      setIsMenuOpen(false);
                    }}
                  >
                    Trending
                  </NavLink>
                  <NavLink
                    onClick={() => {
                      navigate('/i/demo');
                      setIsMenuOpen(false);
                    }}
                  >
                    View Demo
                  </NavLink>
                </NavSection>

                {/* Resources */}
                <NavSection title="Resources" titleId="nav-section-resources">
                  <NavLink
                    onClick={() => {
                      navigate('/changelog');
                      setIsMenuOpen(false);
                    }}
                  >
                    Changelog
                  </NavLink>
                  <NavLink
                    onClick={() => {
                      navigate('/billing');
                      setIsMenuOpen(false);
                    }}
                  >
                    Pricing
                  </NavLink>
                  <NavLink
                    href="https://docs.contributor.info"
                    external
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Docs
                  </NavLink>
                </NavSection>

                {/* Time Range - only on relevant pages */}
                {isLoggedIn && needsTimeRange() && (
                  <div className="mb-6 pt-4 border-t border-border/50">
                    <label
                      htmlFor="time-range-select"
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block"
                    >
                      Time Range
                    </label>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger id="time-range-select" className="w-full">
                        <SelectValue placeholder="Select time range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Settings */}
                <div className="pt-4 border-t border-border/50 space-y-4">
                  <div className="flex items-center justify-between px-3 -mx-3">
                    <span className="text-sm font-medium">Theme</span>
                    <ModeToggle />
                  </div>
                </div>

                {/* Footer Links */}
                <div className="pt-4 mt-4 border-t border-border/50">
                  <nav
                    className="flex space-x-4 text-xs text-muted-foreground"
                    aria-label="Legal links"
                  >
                    <Link
                      to="/privacy"
                      onClick={() => setIsMenuOpen(false)}
                      className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                    >
                      Privacy
                    </Link>
                    <Link
                      to="/terms"
                      onClick={() => setIsMenuOpen(false)}
                      className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                    >
                      Terms
                    </Link>
                  </nav>
                </div>
              </nav>
            </NavigationOverlay>

            <button
              onClick={() => navigate('/')}
              className="text-xl font-bold hover:text-primary transition-colors"
              data-tour="home-button"
            >
              contributor.info
            </button>
          </div>

          {/* Workspace and Auth Buttons */}
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <TourTriggerButton variant="ghost" size="icon" showLabel={false} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Learn how to use contributor.info</p>
              </TooltipContent>
            </Tooltip>
            {isLoggedIn && (
              <div data-tour="notifications">
                <NotificationDropdown />
              </div>
            )}
            {isLoggedIn && (
              <>
                {/* Prevent flickering by handling loading state */}
                {onboardingLoading && (
                  // Show placeholder during loading to prevent layout shift
                  <div className="h-8 w-[150px] bg-muted animate-pulse rounded-md" />
                )}
                {!onboardingLoading && needsOnboarding && (
                  // Show CTA for users with no workspaces
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleCreateWorkspace}
                    className="gap-2"
                    data-tour="create-workspace-cta"
                  >
                    <Plus className="h-4 w-4" />
                    Create Workspace
                  </Button>
                )}
                {!onboardingLoading && !needsOnboarding && !isWorkspacePage() && (
                  // Show workspace switcher for users with workspaces (not on workspace pages)
                  <div onMouseEnter={handlePreloadCommandPalette} data-tour="workspace-switcher">
                    <div className="hidden md:block">
                      <WorkspaceSwitcher
                        className="min-w-[200px]"
                        showFullName={true}
                        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                      />
                    </div>
                    <div className="md:hidden">
                      <WorkspaceSwitcher
                        className="min-w-[40px]"
                        showFullName={false}
                        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
            <AuthButton />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 bg-muted/50 dark:bg-black focus:outline-none"
      >
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
