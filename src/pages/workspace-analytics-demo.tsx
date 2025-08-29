/**
 * Workspace Analytics Demo Page
 * Demonstrates the advanced analytics dashboard functionality
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { WorkspaceExportService } from '@/services/workspace-export.service';

// Lazy load the heavy analytics dashboard
const AnalyticsDashboard = lazy(() =>
  import('@/components/features/workspace/AnalyticsDashboard').then((m) => ({
    default: m.AnalyticsDashboard,
  }))
);
import type {
  AnalyticsData,
  ActivityItem,
  ContributorStat,
  RepositoryMetric,
  TrendDataset,
} from '@/components/features/workspace/AnalyticsDashboard';
import type { WorkspaceRepositoryWithDetails } from '@/types/workspace';

/**
 * Generate demo data for testing
 */
function generateDemoData(): AnalyticsData {
  const now = new Date();
  const activities: ActivityItem[] = [];
  const contributors: ContributorStat[] = [];
  const repositories: RepositoryMetric[] = [];

  // Generate activities
  const activityTypes = ['pr', 'issue', 'commit', 'review'] as const;
  const statuses = ['open', 'merged', 'closed', 'approved'] as const;

  for (let i = 0; i < 200; i++) {
    const createdAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    activities.push({
      id: `activity-${i}`,
      type: activityTypes[Math.floor(Math.random() * activityTypes.length)],
      title: `Activity ${i}: ${['Fix bug', 'Add feature', 'Update docs', 'Refactor code'][Math.floor(Math.random() * 4)]}`,
      author: {
        username: `user${Math.floor(Math.random() * 20)}`,
        avatar_url: `https://github.com/user${Math.floor(Math.random() * 20)}.png`,
      },
      repository: ['owner/repo1', 'owner/repo2', 'owner/repo3'][Math.floor(Math.random() * 3)],
      created_at: createdAt.toISOString(),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      url: `https://github.com/owner/repo/pull/${i}`,
    });
  }

  // Generate contributors
  for (let i = 0; i < 50; i++) {
    const contributions = Math.floor(Math.random() * 100) + 1;
    contributors.push({
      id: `contributor-${i}`,
      username: `user${i}`,
      avatar_url: `https://github.com/user${i}.png`,
      contributions,
      pull_requests: Math.floor(contributions * 0.4),
      issues: Math.floor(contributions * 0.2),
      reviews: Math.floor(contributions * 0.3),
      commits: Math.floor(contributions * 0.1),
      trend: Math.floor(Math.random() * 40) - 20,
    });
  }

  // Generate repositories
  const repoNames = ['frontend', 'backend', 'docs', 'mobile', 'api'];
  for (let i = 0; i < 5; i++) {
    repositories.push({
      id: `repo-${i}`,
      name: repoNames[i],
      owner: 'organization',
      stars: Math.floor(Math.random() * 5000),
      forks: Math.floor(Math.random() * 1000),
      pull_requests: Math.floor(Math.random() * 200),
      issues: Math.floor(Math.random() * 100),
      contributors: Math.floor(Math.random() * 50) + 10,
      activity_score: Math.floor(Math.random() * 100),
      trend: Math.floor(Math.random() * 30) - 15,
    });
  }

  // Generate trend data
  const trends: TrendDataset[] = [];
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(date.toISOString().split('T')[0]);
  }

  trends.push({
    label: 'Pull Requests',
    data: dates.map((date) => ({
      date,
      value: Math.floor(Math.random() * 50) + 10,
    })),
    color: '#10b981',
  });

  trends.push({
    label: 'Active Contributors',
    data: dates.map((date) => ({
      date,
      value: Math.floor(Math.random() * 30) + 5,
    })),
    color: '#3b82f6',
  });

  return {
    activities,
    contributors,
    repositories,
    trends,
  };
}

export function WorkspaceAnalyticsDemoPage() {
  const { workspaceId = 'demo-workspace' } = useParams<{ workspaceId: string }>();
  const [tier] = useState<'free' | 'pro' | 'enterprise'>('pro');

  // Generate demo data
  const demoData = useMemo(() => generateDemoData(), []);

  // Mock repositories data
  const mockRepositories: WorkspaceRepositoryWithDetails[] = [
    {
      id: 'wr-1',
      workspace_id: workspaceId,
      repository_id: 'repo-1',
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      notes: null,
      tags: [],
      is_pinned: false,
      repository: {
        id: 'repo-1',
        full_name: 'organization/frontend',
        owner: 'organization',
        name: 'frontend',
        description: 'Frontend application',
        language: 'TypeScript',
        stargazers_count: 1234,
        forks_count: 234,
        open_issues_count: 45,
        topics: ['react', 'typescript'],
        is_private: false,
        is_archived: false,
      },
      added_by_user: {
        id: 'user-1',
        email: 'user@example.com',
        display_name: 'Demo User',
      },
    },
    {
      id: 'wr-2',
      workspace_id: workspaceId,
      repository_id: 'repo-2',
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      notes: null,
      tags: [],
      is_pinned: false,
      repository: {
        id: 'repo-2',
        full_name: 'organization/backend',
        owner: 'organization',
        name: 'backend',
        description: 'Backend API',
        language: 'Go',
        stargazers_count: 2345,
        forks_count: 345,
        open_issues_count: 67,
        topics: ['golang', 'api'],
        is_private: false,
        is_archived: false,
      },
      added_by_user: {
        id: 'user-1',
        email: 'user@example.com',
        display_name: 'Demo User',
      },
    },
    {
      id: 'wr-3',
      workspace_id: workspaceId,
      repository_id: 'repo-3',
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      notes: null,
      tags: [],
      is_pinned: false,
      repository: {
        id: 'repo-3',
        full_name: 'organization/docs',
        owner: 'organization',
        name: 'docs',
        description: 'Documentation',
        language: 'Markdown',
        stargazers_count: 456,
        forks_count: 56,
        open_issues_count: 12,
        topics: ['documentation'],
        is_private: false,
        is_archived: false,
      },
      added_by_user: {
        id: 'user-1',
        email: 'user@example.com',
        display_name: 'Demo User',
      },
    },
  ];

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      await WorkspaceExportService.export(demoData, format, {
        workspaceName: 'Demo Workspace',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Workspace Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Advanced analytics and insights for your workspace
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }
        >
          <AnalyticsDashboard
            data={demoData}
            repositories={mockRepositories}
            loading={false}
            tier={tier}
            onExport={handleExport}
          />
        </Suspense>
      </div>
    </div>
  );
}
