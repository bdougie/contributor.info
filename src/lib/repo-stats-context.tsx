import React, { createContext } from 'react';
import type { RepoStats, LotteryFactor, DirectCommitsData } from '@/lib/types';

// Context to share data between tabs
interface RepoStatsContextType {
  stats: RepoStats;
  lotteryFactor: LotteryFactor | null;
  directCommitsData: DirectCommitsData | null;
  includeBots: boolean;
  setIncludeBots: (value: boolean) => void;
}

export const RepoStatsContext = createContext<RepoStatsContextType>({
  stats: { pullRequests: [], loading: true, error: null },
  lotteryFactor: null,
  directCommitsData: null,
  includeBots: false,
  setIncludeBots: () => {},
});

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
