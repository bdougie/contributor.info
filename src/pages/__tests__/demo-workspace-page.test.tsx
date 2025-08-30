import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DemoWorkspacePage } from '../demo-workspace-page';

// Mock the demo data cache
vi.mock('@/lib/demo/demo-data-cache', () => ({
  getCachedAnalyticsData: vi.fn(() => ({
    activities: Array(10).fill(null).map((_, i) => ({
      id: `activity-${i}`,
      type: 'pr',
      title: `Test Activity ${i}`,
      author: { username: 'testuser', avatar_url: 'https://github.com/testuser.png' },
      repository: 'test/repo',
      created_at: new Date().toISOString(),
      status: 'open',
      url: 'https://github.com/test/repo/pull/1',
    })),
    contributors: Array(5).fill(null).map((_, i) => ({
      id: `contributor-${i}`,
      username: `user${i}`,
      avatar_url: `https://github.com/user${i}.png`,
      contributions: 50,
      pull_requests: 20,
      issues: 10,
      reviews: 15,
      commits: 5,
      trend: 5,
    })),
    repositories: Array(3).fill(null).map((_, i) => ({
      id: `repo-${i}`,
      name: `repo${i}`,
      owner: 'test',
      stars: 100,
      forks: 20,
      pull_requests: 10,
      issues: 5,
      contributors: 10,
      activity_score: 80,
      trend: 2,
    })),
    trends: [
      {
        label: 'Pull Requests',
        data: Array(30).fill(null).map((_, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          value: Math.floor(Math.random() * 50) + 10,
        })),
        color: '#10b981',
      },
    ],
  })),
  getCachedWorkspaceRepositories: vi.fn(() => [
    {
      id: 'wr-1',
      workspace_id: 'demo',
      repository_id: 'repo-1',
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      notes: null,
      tags: [],
      is_pinned: false,
      repository: {
        id: 'repo-1',
        full_name: 'test/repo1',
        owner: 'test',
        name: 'repo1',
        description: 'Test repository',
        language: 'TypeScript',
        stargazers_count: 100,
        forks_count: 20,
        open_issues_count: 5,
        topics: ['test'],
        is_private: false,
        is_archived: false,
      },
      added_by_user: {
        id: 'user-1',
        email: 'test@example.com',
        display_name: 'Test User',
      },
    },
  ]),
  getCachedRepositories: vi.fn(() => [
    {
      id: 'repo-1',
      full_name: 'test/repo1',
      name: 'repo1',
      owner: 'test',
      description: 'Test repository',
      language: 'TypeScript',
      stars: 100,
      forks: 20,
      open_prs: 5,
      open_issues: 3,
      contributors: 10,
      last_activity: new Date().toISOString(),
      html_url: 'https://github.com/test/repo1',
    },
  ]),
  getCachedWorkspaceMetrics: vi.fn(() => ({
    totalStars: 300,
    totalPRs: 150,
    totalContributors: 50,
    totalCommits: 1000,
    starsTrend: 5.2,
    prsTrend: -2.1,
    contributorsTrend: 8.5,
    commitsTrend: 12.3,
  })),
  getCachedWorkspaceTrendData: vi.fn(() => [
    {
      date: '2024-01-01',
      additions: 100,
      deletions: 50,
      commits: 5,
      files_changed: 3,
    },
    {
      date: '2024-01-02',
      additions: 80,
      deletions: 30,
      commits: 3,
      files_changed: 2,
    },
  ]),
}));

// Mock the WorkspaceExportService
vi.mock('@/services/workspace-export.service', () => ({
  WorkspaceExportService: {
    export: vi.fn(),
  },
}));

// Mock the lazy-loaded AnalyticsDashboard
vi.mock('@/components/features/workspace/AnalyticsDashboard', () => ({
  AnalyticsDashboard: ({ data, onExport }: any) => (
    <div data-testid="analytics-dashboard">
      <div>Activities: {data.activities.length}</div>
      <div>Contributors: {data.contributors.length}</div>
      <button onClick={() => onExport('csv')}>Export CSV</button>
    </div>
  ),
}));

// Mock other workspace components
vi.mock('@/components/features/workspace', () => ({
  WorkspaceDashboard: ({ workspaceId, metrics }: any) => (
    <div data-testid="workspace-dashboard">
      <div>Workspace: {workspaceId}</div>
      <div>Total Stars: {metrics.totalStars}</div>
    </div>
  ),
}));

vi.mock('@/components/features/workspace/TimeRangeSelector', () => ({
  TimeRangeSelector: ({ value, onChange }: any) => (
    <select data-testid="time-range-selector" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="7d">7 days</option>
      <option value="30d">30 days</option>
      <option value="90d">90 days</option>
    </select>
  ),
}));

vi.mock('@/components/features/workspace/ActivityChart', () => ({
  ActivityChart: ({ data }: any) => (
    <div data-testid="activity-chart">Chart with {data.length} data points</div>
  ),
}));

vi.mock('@/components/features/workspace/ActivityTable', () => ({
  ActivityTable: ({ activities }: any) => (
    <div data-testid="activity-table">{activities.length} activities</div>
  ),
}));

vi.mock('@/components/features/workspace/ContributorLeaderboard', () => ({
  ContributorLeaderboard: ({ contributors }: any) => (
    <div data-testid="contributor-leaderboard">{contributors.length} contributors</div>
  ),
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ workspaceId: 'demo', tab: undefined }),
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('DemoWorkspacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render demo workspace banner', () => {
    renderWithRouter(<DemoWorkspacePage />);
    
    expect(screen.getByText('Demo Workspace')).toBeInTheDocument();
    expect(screen.getByText(/This workspace uses sample data/)).toBeInTheDocument();
  });

  it('should render all tab options', () => {
    renderWithRouter(<DemoWorkspacePage />);
    
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contributors' })).toBeInTheDocument();
  });

  it('should show overview tab content by default', () => {
    renderWithRouter(<DemoWorkspacePage />);
    
    expect(screen.getByTestId('workspace-dashboard')).toBeInTheDocument();
    expect(screen.getByText('About This Demo')).toBeInTheDocument();
  });

  it('should render time range selector', () => {
    renderWithRouter(<DemoWorkspacePage />);
    
    expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
  });

  it('should handle time range changes', async () => {
    renderWithRouter(<DemoWorkspacePage />);
    
    const timeRangeSelector = screen.getByTestId('time-range-selector');
    fireEvent.change(timeRangeSelector, { target: { value: '7d' } });
    
    // The component should re-render with new time range
    // Since we're using mocked data, we can't easily verify the actual change
    // but the component should handle it without errors
    expect(timeRangeSelector).toHaveValue('7d');
  });

  it('should show analytics dashboard in analytics tab', async () => {
    // Mock useParams to return analytics tab
    vi.mocked(vi.importActual('react-router-dom')).useParams = vi.fn(() => ({
      workspaceId: 'demo',
      tab: 'analytics',
    }));
    
    renderWithRouter(<DemoWorkspacePage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
      expect(screen.getByText('Activities: 10')).toBeInTheDocument();
      expect(screen.getByText('Contributors: 5')).toBeInTheDocument();
    });
  });

  it('should show activity components in activity tab', () => {
    // Mock useParams to return activity tab
    vi.mocked(vi.importActual('react-router-dom')).useParams = vi.fn(() => ({
      workspaceId: 'demo',
      tab: 'activity',
    }));
    
    renderWithRouter(<DemoWorkspacePage />);
    
    expect(screen.getByTestId('activity-chart')).toBeInTheDocument();
    expect(screen.getByTestId('activity-table')).toBeInTheDocument();
  });

  it('should show contributor leaderboard in contributors tab', () => {
    // Mock useParams to return contributors tab
    vi.mocked(vi.importActual('react-router-dom')).useParams = vi.fn(() => ({
      workspaceId: 'demo',
      tab: 'contributors',
    }));
    
    renderWithRouter(<DemoWorkspacePage />);
    
    expect(screen.getByTestId('contributor-leaderboard')).toBeInTheDocument();
    expect(screen.getByText('5 contributors')).toBeInTheDocument();
  });

  it('should navigate when tab changes', () => {
    renderWithRouter(<DemoWorkspacePage />);
    
    const analyticsTab = screen.getByRole('tab', { name: 'Analytics' });
    fireEvent.click(analyticsTab);
    
    expect(mockNavigate).toHaveBeenCalledWith('/i/demo/analytics');
  });

  it('should navigate to base route for overview tab', () => {
    renderWithRouter(<DemoWorkspacePage />);
    
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    fireEvent.click(overviewTab);
    
    expect(mockNavigate).toHaveBeenCalledWith('/i/demo');
  });

  it('should handle export functionality', async () => {
    const { WorkspaceExportService } = await import('@/services/workspace-export.service');
    
    // Mock useParams to return analytics tab
    vi.mocked(vi.importActual('react-router-dom')).useParams = vi.fn(() => ({
      workspaceId: 'demo',
      tab: 'analytics',
    }));
    
    renderWithRouter(<DemoWorkspacePage />);
    
    await waitFor(() => {
      const exportButton = screen.getByText('Export CSV');
      fireEvent.click(exportButton);
    });
    
    expect(WorkspaceExportService.export).toHaveBeenCalledWith(
      expect.any(Object),
      'csv',
      expect.objectContaining({
        workspaceName: 'Demo Workspace',
        dateRange: expect.any(Object),
      })
    );
  });

  it('should display demo statistics in about section', () => {
    renderWithRouter(<DemoWorkspacePage />);
    
    expect(screen.getByText('1 repositories with varied languages and activities')).toBeInTheDocument();
    expect(screen.getByText('10 activities across the last 30 days')).toBeInTheDocument();
    expect(screen.getByText('5 active contributors')).toBeInTheDocument();
  });

  it('should use custom workspace ID from params', () => {
    // Mock useParams to return custom workspace ID
    vi.mocked(vi.importActual('react-router-dom')).useParams = vi.fn(() => ({
      workspaceId: 'custom-demo',
      tab: undefined,
    }));
    
    renderWithRouter(<DemoWorkspacePage />);
    
    // The workspace dashboard should receive the custom workspace ID
    expect(screen.getByText('Workspace: custom-demo')).toBeInTheDocument();
  });
});