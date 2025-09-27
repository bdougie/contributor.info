import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';
import { generateWorkspaceSlug, getWorkspaceUrl } from '@/lib/workspace-utils';
import {
  WORKSPACE_TIMEOUTS,
  WORKSPACE_ERROR_MESSAGES,
  WORKSPACE_STORAGE_KEYS,
  WORKSPACE_LIMITS,
} from '@/lib/workspace-config';

// Extend WorkspacePreviewData to include additional fields that might be needed
interface Workspace extends Omit<WorkspacePreviewData, 'slug'> {
  tier?: string | null;
  updated_at?: string | null;
  slug: string; // Make slug required
}

interface WorkspaceContextValue {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (idOrSlug: string) => Promise<void>;
  findWorkspace: (idOrSlug: string) => Workspace | undefined;
  isLoading: boolean;
  recentWorkspaces: string[];
  addToRecent: (id: string) => void;
  error: string | null;
  retry: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const navigate = useNavigate();
  const params = useParams<{ workspaceId?: string }>();
  const {
    workspaces: rawWorkspaces,
    loading: workspacesLoading,
    error: workspacesError,
    refetch,
  } = useUserWorkspaces();

  // Add slugs to workspaces
  const workspaces = rawWorkspaces.map((ws) => ({
    ...ws,
    slug: ws.slug || generateWorkspaceSlug(ws.name),
  }));

  // Get workspace ID from URL if on a workspace page
  const urlWorkspaceId = params.workspaceId;

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    // Prioritize URL param, then localStorage
    if (urlWorkspaceId) {
      return urlWorkspaceId;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem(WORKSPACE_STORAGE_KEYS.ACTIVE);
    }
    return null;
  });
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>(() => {
    // Initialize recent workspaces from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(WORKSPACE_STORAGE_KEYS.RECENT);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // Find active workspace from the list (support both ID and slug)
  const activeWorkspace =
    workspaces.find((w: Workspace) => w.id === activeWorkspaceId || w.slug === activeWorkspaceId) ||
    null;

  // Persist active workspace to localStorage
  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem(WORKSPACE_STORAGE_KEYS.ACTIVE, activeWorkspaceId);
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEYS.ACTIVE);
    }
  }, [activeWorkspaceId]);

  // Persist recent workspaces to localStorage
  useEffect(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEYS.RECENT, JSON.stringify(recentWorkspaces));
  }, [recentWorkspaces]);

  // Define addToRecent early so it can be used in effects
  const addToRecent = useCallback((id: string): void => {
    setRecentWorkspaces((prev) => {
      // Remove if already exists, then add to front
      const filtered = prev.filter((wId) => wId !== id);
      const newRecent = [id, ...filtered].slice(0, WORKSPACE_LIMITS.MAX_RECENT);
      return newRecent;
    });
  }, []);

  // Broadcast workspace changes across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === WORKSPACE_STORAGE_KEYS.ACTIVE && e.newValue) {
        setActiveWorkspaceId(e.newValue);
      } else if (e.key === WORKSPACE_STORAGE_KEYS.RECENT && e.newValue) {
        try {
          setRecentWorkspaces(JSON.parse(e.newValue));
        } catch {
          // Invalid JSON, ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sync active workspace with URL parameter when URL changes
  useEffect(() => {
    if (urlWorkspaceId && urlWorkspaceId !== activeWorkspaceId) {
      const workspace = workspaces.find(w => w.id === urlWorkspaceId || w.slug === urlWorkspaceId);
      if (workspace) {
        console.log('[WorkspaceContext] Syncing workspace from URL:', urlWorkspaceId);
        setActiveWorkspaceId(workspace.id);
        addToRecent(workspace.id);
      }
    }
  }, [urlWorkspaceId, workspaces, activeWorkspaceId, addToRecent]);

  // Auto-select first workspace if none selected but workspaces exist
  useEffect(() => {
    if (!activeWorkspaceId && !urlWorkspaceId && workspaces.length > 0 && !workspacesLoading) {
      console.log('[WorkspaceContext] Auto-selecting first workspace');
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, urlWorkspaceId, workspaces, workspacesLoading]);

  // Set up loading timeout to prevent infinite loading states with proper cleanup
  useEffect(() => {
    // Clear any existing timeout on mount/unmount or when loading state changes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (workspacesLoading && !hasTimedOut) {
      // Set timeout only if loading and not already timed out
      timeoutRef.current = setTimeout(() => {
        // Double-check if still loading to avoid race condition
        if (workspacesLoading) {
          console.error(
            '[WorkspaceContext] Workspace loading timed out after',
            WORKSPACE_TIMEOUTS.CONTEXT,
            'ms'
          );
          setHasTimedOut(true);
        }
      }, WORKSPACE_TIMEOUTS.CONTEXT);
    } else if (!workspacesLoading) {
      // Data loaded successfully - clear timeout state
      setHasTimedOut(false);
      // Reset retry count on successful load
      retryCountRef.current = 0;
    }

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [workspacesLoading, hasTimedOut]);

  // Log workspace errors
  useEffect(() => {
    if (workspacesError) {
      console.error('[WorkspaceContext] Workspace loading error:', workspacesError);
      setError(workspacesError.message);
    }
  }, [workspacesError]);

  const findWorkspace = useCallback(
    (idOrSlug: string): Workspace | undefined => {
      return workspaces.find((w) => w.id === idOrSlug || w.slug === idOrSlug);
    },
    [workspaces]
  );

  const switchWorkspace = useCallback(
    async (idOrSlug: string): Promise<void> => {
      // Find the workspace by ID or slug
      const workspace = findWorkspace(idOrSlug);
      if (!workspace) {
        const errorMsg = WORKSPACE_ERROR_MESSAGES.NOT_FOUND(idOrSlug);
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }

      if (workspace.id === activeWorkspaceId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Add to recent workspaces (use ID for storage)
        addToRecent(workspace.id);

        // Update active workspace (store ID)
        setActiveWorkspaceId(workspace.id);

        // Navigate to the workspace page using slug if available
        const url = getWorkspaceUrl(workspace);
        navigate(url);

        // Broadcast change to other tabs via storage event
        localStorage.setItem(WORKSPACE_STORAGE_KEYS.ACTIVE, workspace.id);

        // Preload workspace data if needed (the hooks will handle this)
        // In the future, we could add preloading logic here
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : WORKSPACE_ERROR_MESSAGES.SWITCH_FAILED;
        console.error('Failed to switch workspace:', errorMessage);
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [activeWorkspaceId, navigate, addToRecent, findWorkspace]
  );

  // Add retry functionality
  const retry = useCallback(() => {
    if (retryCountRef.current >= WORKSPACE_TIMEOUTS.MAX_RETRIES) {
      setError(WORKSPACE_ERROR_MESSAGES.GENERIC);
      return;
    }

    retryCountRef.current += 1;
    console.log(
      `[WorkspaceContext] Retrying workspace fetch (attempt ${retryCountRef.current}/${WORKSPACE_TIMEOUTS.MAX_RETRIES})`
    );

    // Clear error and timeout states
    setError(null);
    setHasTimedOut(false);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Trigger refetch if available
    if (refetch) {
      refetch();
    }
  }, [refetch]);

  const value: WorkspaceContextValue = {
    activeWorkspace,
    workspaces: workspaces as Workspace[],
    switchWorkspace,
    findWorkspace,
    isLoading: isLoading || (workspacesLoading && !hasTimedOut),
    recentWorkspaces,
    addToRecent,
    error: error || (hasTimedOut ? WORKSPACE_ERROR_MESSAGES.TIMEOUT : null),
    retry,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
}

// Export types for external use
export type { Workspace, WorkspaceContextValue };
