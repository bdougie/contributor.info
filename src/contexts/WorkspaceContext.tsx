import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserWorkspaces } from '@/hooks/use-user-workspaces';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';

// Extend WorkspacePreviewData to include additional fields that might be needed
type Workspace = WorkspacePreviewData & {
  tier?: string | null;
  updated_at?: string | null;
};

interface WorkspaceContextValue {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (id: string) => Promise<void>;
  isLoading: boolean;
  recentWorkspaces: string[];
  addToRecent: (id: string) => void;
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
  const { workspaces, loading: workspacesLoading } = useUserWorkspaces();
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

  // Find active workspace from the list (cast to Workspace type)
  const activeWorkspace = workspaces.find((w: Workspace) => w.id === activeWorkspaceId) || null;

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

  const addToRecent = useCallback((id: string) => {
    setRecentWorkspaces(prev => {
      // Remove if already exists, then add to front
      const filtered = prev.filter(wId => wId !== id);
      const newRecent = [id, ...filtered].slice(0, MAX_RECENT_WORKSPACES);
      return newRecent;
    });
  }, []);

  const switchWorkspace = useCallback(async (id: string) => {
    if (id === activeWorkspaceId) return;
    
    setIsLoading(true);
    try {
      // Add to recent workspaces
      addToRecent(id);
      
      // Update active workspace
      setActiveWorkspaceId(id);
      
      // Navigate to the workspace page
      navigate(`/i/${id}`);
      
      // Broadcast change to other tabs via storage event
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
      
      // Preload workspace data if needed (the hooks will handle this)
      // In the future, we could add preloading logic here
      
    } catch (error) {
      console.error('Failed to switch workspace:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, navigate, addToRecent]);

  const value: WorkspaceContextValue = {
    activeWorkspace,
    workspaces: workspaces as Workspace[],
    switchWorkspace,
    isLoading: isLoading || workspacesLoading,
    recentWorkspaces,
    addToRecent,
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

// Export type for external use
export type { Workspace, WorkspaceContextValue };