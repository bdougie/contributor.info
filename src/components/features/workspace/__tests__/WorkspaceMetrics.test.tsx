import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  WorkspaceDashboard,
  WorkspaceDashboardSkeleton,
  type WorkspaceMetrics,
} from '../WorkspaceDashboard';
import type { TimeRange } from '../TimeRangeSelector';

vi.mock('../MyWorkCard', () => ({ MyWorkCard: () => null }));
vi.mock('../RepositoryList', () => ({ RepositoryList: () => null }));
vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackDocsLinkClicked: vi.fn() }),
}));

afterEach(cleanup);

const baseMetrics: WorkspaceMetrics = {
  totalStars: 581,
  totalPRs: 29,
  totalIssues: 45,
  totalContributors: 10,
  totalCommits: 0,
  starsTrend: 0,
  prsTrend: -61,
  issuesTrend: 4400,
  contributorsTrend: 0,
  commitsTrend: 0,
};

function renderDashboard(timeRange: TimeRange = '30d', metrics: Partial<WorkspaceMetrics> = {}) {
  return render(
    <TooltipProvider>
      <WorkspaceDashboard
        workspaceId="workspace"
        workspaceName="Paper Compute"
        repositories={[]}
        trendData={{ labels: [], datasets: [] }}
        metrics={{ ...baseMetrics, ...metrics }}
        timeRange={timeRange}
      />
    </TooltipProvider>
  );
}

describe('Workspace metrics presentation', () => {
  it.each<[TimeRange, string]>([
    ['7d', 'vs previous 7 days'],
    ['30d', 'vs previous 30 days'],
    ['1y', 'vs previous year'],
    ['all', 'vs previous period'],
  ])('scopes only the trend badges to the %s range', (range, label) => {
    renderDashboard(range);
    expect(screen.getByRole('region', { name: 'Workspace metrics' })).toBeInTheDocument();
    expect(screen.getByText(`Current totals · trends ${label}`)).toBeInTheDocument();
    expect(screen.getAllByText(label)).toHaveLength(4);
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('keeps metric values, trend directions, and help controls accessible', () => {
    renderDashboard();
    for (const value of ['581.0', '29', '45', '10', '61%', '4,400%']) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(screen.getAllByText('No change')).toHaveLength(2);
    expect(screen.getByText('Down')).toHaveClass('sr-only');
    expect(screen.getByText('Up')).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: 'About Open PRs' })).toHaveAttribute(
      'type',
      'button'
    );
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
      'href',
      'https://docs.contributor.info/workspaces/overview'
    );
  });

  it('only shows Contributor Confidence once data exists, as a full-width row', () => {
    renderDashboard();
    expect(screen.queryByText('Contributor Confidence')).not.toBeInTheDocument();
    cleanup();
    renderDashboard('30d', { contributorConfidence: 42, confidenceTrend: 0.25 });
    expect(screen.getByText('Contributor Confidence').closest('.col-span-full')).not.toBeNull();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('0.25%')).toBeInTheDocument();
  });

  it('skeleton announces labeled loading cards for the selected range', () => {
    render(<WorkspaceDashboardSkeleton timeRange="90d" />);
    expect(screen.getAllByRole('status', { busy: true })).toHaveLength(4);
    expect(screen.getByRole('status', { name: 'Loading Open PRs' })).toBeInTheDocument();
    expect(screen.getByText('Current totals · trends vs previous 90 days')).toBeInTheDocument();
    expect(screen.queryByText('581.0')).not.toBeInTheDocument();
  });
});
