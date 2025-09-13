import { Navigate } from 'react-router-dom';
import { useFeatureFlags } from '@/lib/feature-flags';
import { FEATURE_FLAGS } from '@/lib/feature-flags/types';
import { ReactNode } from 'react';

interface WorkspaceRoutesWrapperProps {
  children: ReactNode;
}

export function WorkspaceRoutesWrapper({ children }: WorkspaceRoutesWrapperProps) {
  const { checkFlag } = useFeatureFlags();
  const isWorkspacesEnabled = checkFlag(FEATURE_FLAGS.ENABLE_WORKSPACES);

  if (!isWorkspacesEnabled) {
    // Redirect to home if workspaces are disabled
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
