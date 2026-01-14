import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { TourProvider } from '@/lib/onboarding-tour';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

interface TourProviderWithNavigationProps {
  children: React.ReactNode;
}

/**
 * TourProvider wrapper that handles navigation on tour completion
 *
 * - If not logged in → navigate to /login
 * - If logged in but no workspaces → navigate to /workspaces/demo
 * - If logged in with workspaces → navigate to first workspace
 */
export function TourProviderWithNavigation({ children }: TourProviderWithNavigationProps) {
  const navigate = useNavigate();
  const { isLoggedIn } = useGitHubAuth();
  const { workspaces } = useWorkspaceContext();

  const handleTourComplete = useCallback(() => {
    if (!isLoggedIn) {
      // Not logged in - go to login page
      navigate('/login');
    } else if (!workspaces || workspaces.length === 0) {
      // Logged in but no workspaces - go to demo workspace
      navigate('/workspaces/demo');
    } else {
      // Logged in with workspaces - go to first workspace
      const firstWorkspace = workspaces[0];
      navigate(`/workspaces/${firstWorkspace.slug}`);
    }
  }, [isLoggedIn, workspaces, navigate]);

  return (
    <TourProvider autoStart={false} onComplete={handleTourComplete}>
      {children}
    </TourProvider>
  );
}
