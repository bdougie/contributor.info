import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';
import { generateWorkspaceSlug, getWorkspaceUrl } from '@/lib/workspace-utils';
import { WORKSPACE_TIMEOUTS, WORKSPACE_ERROR_MESSAGES, WORKSPACE_STORAGE_KEYS, WORKSPACE_LIMITS } from '@/lib/workspace-config';

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
  const { workspaces: rawWorkspaces, loading: workspacesLoading, error: _error: workspacesError, refetch } = useUserWorkspaces();
  
  // Add slugs to workspaces
  const workspaces = rawWorkspaces.map(ws => ({
    ...ws,
    slug: ws.slug || generateWorkspaceSlug(ws.name),
  }));
  
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    // Initialize from localStorage
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
  const activeWorkspace = workspaces.find((w: Workspace) => 
    w.id === activeWorkspaceId || w.slug === activeWorkspaceId
  ) || null;

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

  // Auto-select first workspace if none selected but workspaces exist
  useEffect(() => {
    if (!activeWorkspaceId && workspaces.length > 0 && !workspacesLoading) {
      console.log('[WorkspaceContext] Auto-selecting first workspace');
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, workspaces, workspacesLoading]);

  // Set up loading timeout to prevent infinite loading states with proper cleanup
  useEffect(() => {
    if (workspacesLoading) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        // Double-check if still loading to avoid race condition
        if (workspacesLoading) {
          console.error('[WorkspaceContext] Workspace loading timed out');
          setHasTimedOut(true);
        }
      }, WORKSPACE_TIMEOUTS.CONTEXT);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    } else {
      setHasTimedOut(false);
      // Reset retry count on successful load
      retryCountRef.current = 0;
    }
  }, [workspacesLoading]);

  // Log workspace errors
  useEffect(() => {
    if (workspacesError) {
      console.error('[WorkspaceContext] Workspace loading _error:', workspacesError);
      setError(workspacesError.message);
    }
  }, [workspacesError]);

  const addToRecent = useCallback((id: string): void => {
    setRecentWorkspaces(prev => {
      // Remove if already exists, then add to front
      const filtered = prev.filter(wId => wId !== id);
      const newRecent = [id, ...filtered].slice(0, WORKSPACE_LIMITS.MAX_RECENT);
      return newRecent;
    });
  }, []);

  const findWorkspace = useCallback((idOrSlug: string): Workspace | undefined => {
    return workspaces.find(w => w.id === idOrSlug || w.slug === idOrSlug);
  }, [workspaces]);

  const switchWorkspace = useCallback(async (idOrSlug: string): Promise<void> => {
    // Find the workspace by ID or slug
    const workspace = findWorkspace(idOrSlug);
    if (!workspace) {
      const errorMsg = WORKSPACE_ERROR_MESSAGES.NOT_FOUND(idOrSlug);
      console.error(_errorMsg);
      setError(_errorMsg);
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
      
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : WORKSPACE_ERROR_MESSAGES.SWITCH_FAILED;
      console.error('Failed to switch workspace:', _errorMessage);
      setError(_errorMessage);
      throw new Error(_errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, navigate, addToRecent, findWorkspace]);

  // Add retry functionality
  const retry = useCallback(() => {
    if (retryCountRef.current >= WORKSPACE_TIMEOUTS.MAX_RETRIES) {
      setError(WORKSPACE_ERROR_MESSAGES.GENERIC);
      return;
    }
    
    retryCountRef.current += 1;
    setError(null);
    setHasTimedOut(false);
    
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

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
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