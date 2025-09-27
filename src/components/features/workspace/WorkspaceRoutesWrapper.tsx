import { ReactNode } from 'react';

interface WorkspaceRoutesWrapperProps {
  children: ReactNode;
}

export function WorkspaceRoutesWrapper({ children }: WorkspaceRoutesWrapperProps) {
  return <>{children}</>;
}
