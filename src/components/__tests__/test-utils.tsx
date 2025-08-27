import { ReactNode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { RepoStats } from '@/lib/types';
import { MetaTagsProvider } from '../common/layout';

export const mockRepoStats: RepoStats = {
  pullRequests: [
    {
      id: 1,
      number: 1,
      title: 'Test PR',
      state: 'open' as const,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      merged_at: null,
      additions: 100,
      deletions: 50,
      repository_owner: 'test',
      repository_name: 'repo',
      user: {
        id: 1,
        login: 'test-user',
        avatar_url: 'https://example.com/avatar.jpg',
      },
    },
  ],
  loading: false,
  error: null,
};

export function TestRepoStatsProvider({ children }: { children: ReactNode }) {
  return (
    <Router>
      <MetaTagsProvider>
        <RepoStatsContext.Provider
          value={{
            stats: mockRepoStats,
            lotteryFactor: null,
            directCommitsData: null,
            includeBots: false,
            setIncludeBots: () => {},
          }}
        >
          {children}
        </RepoStatsContext.Provider>
      </MetaTagsProvider>
    </Router>
  );
}
