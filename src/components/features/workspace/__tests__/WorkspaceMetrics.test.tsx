import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WorkspaceDashboard } from '../WorkspaceDashboard';
import { MetricCard } from '../MetricCard';
import type { TimeRange } from '../TimeRangeSelector';

vi.mock('../MyWorkCard', () => ({ MyWorkCard: () => null }));
vi.mock('../RepositoryList', () => ({ RepositoryList: () => null }));
vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackDocsLinkClicked: vi.fn() }),
}));

afterEach(cleanup);

function renderDashboard(timeRange: TimeRange = '30d', loading = false) {
  return render(
    <TooltipProvider>
      <WorkspaceDashboard
        workspaceId="workspace"
        workspaceName="Paper Compute"
        repositories={[]}
        trendData={{ labels: [], datasets: [] }}
        metrics={{
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
        }}
        timeRange={timeRange}
        loading={loading}
      />
    </TooltipProvider>
  );
}

describe('Workspace metrics presentation', () => {
  it.each<[TimeRange, string]>([
    ['7d', 'Last 7 days'],
    ['30d', 'Last 30 days'],
    ['90d', 'Last 90 days'],
    ['1y', 'Last year'],
    ['all', 'All time'],
  ])('labels the selected %s range', (range, label) => {
    renderDashboard(range);
    expect(screen.getByRole('region', { name: 'Workspace metrics' })).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('keeps metric values, trend directions, and help controls accessible', () => {
    renderDashboard();
    for (const value of ['581.0', '29', '45', '10']) {
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

  it('explains unavailable confidence and gives it a full-width row', () => {
    renderDashboard();
    expect(screen.getByText('No confidence data available yet')).toBeInTheDocument();
    expect(screen.getByText('Contributor Confidence').closest('.col-span-full')).not.toBeNull();
  });

  it('exposes five loading cards without displaying stale values', () => {
    const { container } = renderDashboard('30d', true);
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(5);
    expect(screen.getByLabelText('Loading Contributor Confidence')).toHaveClass('col-span-full');
    expect(screen.queryByText('581.0')).not.toBeInTheDocument();
  });

  it('supports inline confidence values and small fractional trends', () => {
    render(
      <MetricCard
        layout="inline"
        title="Contributor Confidence"
        subtitle="Workspace average"
        value={42}
        format="percentage"
        trend={{ value: 0.25, label: 'vs previous period' }}
      />
    );
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('0.25%')).toBeInTheDocument();
    expect(screen.getByText('Workspace average')).toBeInTheDocument();
  });
});
