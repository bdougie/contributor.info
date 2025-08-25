import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';
import { generateWorkspaceSlug, getWorkspaceUrl } from '@/lib/workspace-utils';

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
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const RECENT_WORKSPACES_KEY = 'contributor_info_recent_workspaces';
const ACTIVE_WORKSPACE_KEY = 'contributor_info_active_workspace';
const MAX_RECENT_WORKSPACES = 5;

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const navigate = useNavigate();
  const { workspaces: rawWorkspaces, loading: workspacesLoading, error: workspacesError } = useUserWorkspaces();
  
  // Add slugs to workspaces
  const workspaces = rawWorkspaces.map(ws => ({
    ...ws,
    slug: ws.slug || generateWorkspaceSlug(ws.name),
  }));
  
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    }
    return null;
  });
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>(() => {
    // Initialize recent workspaces from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(RECENT_WORKSPACES_KEY);
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

  // Find active workspace from the list (support both ID and slug)
  const activeWorkspace = workspaces.find((w: Workspace) => 
    w.id === activeWorkspaceId || w.slug === activeWorkspaceId
  ) || null;

  // Persist active workspace to localStorage
  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, activeWorkspaceId);
    } else {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  }, [activeWorkspaceId]);

  // Persist recent workspaces to localStorage
  useEffect(() => {
    localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(recentWorkspaces));
  }, [recentWorkspaces]);

  // Broadcast workspace changes across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ACTIVE_WORKSPACE_KEY && e.newValue) {
        setActiveWorkspaceId(e.newValue);
      } else if (e.key === RECENT_WORKSPACES_KEY && e.newValue) {
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
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, workspaces, workspacesLoading]);

  const addToRecent = useCallback((id: string): void => {
    setRecentWorkspaces(prev => {
      // Remove if already exists, then add to front
      const filtered = prev.filter(wId => wId !== id);
      const newRecent = [id, ...filtered].slice(0, MAX_RECENT_WORKSPACES);
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
      console.error(`Workspace not found: ${idOrSlug}`);
      setError(`Workspace not found: ${idOrSlug}`);
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
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
      
      // Preload workspace data if needed (the hooks will handle this)
      // In the future, we could add preloading logic here
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch workspace';
      console.error('Failed to switch workspace:', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, navigate, addToRecent, findWorkspace]);

  const value: WorkspaceContextValue = {
    activeWorkspace,
    workspaces: workspaces as Workspace[],
    switchWorkspace,
    findWorkspace,
    isLoading: isLoading || workspacesLoading,
    recentWorkspaces,
    addToRecent,
    error,
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