import React from 'react';
import { RepoStatsContext, type RepoStatsContextType } from '@/lib/repo-stats-context-definition';

// Provider component for RepoStatsContext
export function RepoStatsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: RepoStatsContextType;
}) {
  return <RepoStatsContext.Provider value={value}>{children}</RepoStatsContext.Provider>;
}

// Re-export context for backward compatibility
export { RepoStatsContext } from '@/lib/repo-stats-context-definition';
