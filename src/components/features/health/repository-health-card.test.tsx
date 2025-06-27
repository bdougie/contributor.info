import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositoryHealthCard } from './repository-health-card';
import { RepoStatsContext } from '@/context/repo-stats-context';
import { calculateRepositoryConfidence } from '@/lib/insights/health-metrics';

// Mock dependencies
vi.mock('@/lib/insights/health-metrics', () => ({
  calculateRepositoryConfidence: vi.fn()
}));

vi.mock('@/components/ui/circular-progress', () => ({
  CircularProgress: ({ value }: { value: number }) => (
    <div data-testid="circular-progress">{value}%</div>
  )
}));

vi.mock('./contributor-confidence-card', () => ({
  ContributorConfidenceCard: ({ confidence, loading, error }: any) => (
    <div data-testid="contributor-confidence-card">
      {loading && <span>Loading confidence...</span>}
      {error && <span>Error loading confidence</span>}
      {!loading && !error && <span>Confidence: {confidence}%</span>}
    </div>
  )
}));

vi.mock('./overall-health-score', () => ({
  OverallHealthScore: () => <div data-testid="overall-health-score">Overall Health</div>
}));

vi.mock('./lottery-factor-card', () => ({
  LotteryFactorCard: () => <div data-testid="lottery-factor-card">Lottery Factor</div>
}));

vi.mock('./health-factors-card', () => ({
  HealthFactorsCard: () => <div data-testid="health-factors-card">Health Factors</div>
}));

vi.mock('./self-selection-rate-card', () => ({
  SelfSelectionRateCard: () => <div data-testid="self-selection-rate-card">Self Selection</div>
}));

vi.mock('@/lib/stores/time-range-store', () => ({
  useTimeRangeStore: () => ({
    timeRange: '30'
  })
}));

const mockRepoData = {
  repository: {
    full_name: 'test-owner/test-repo'
  }
};

const mockContextValue = {
  repoData: mockRepoData,
  loading: false,
  error: null,
  refresh: vi.fn()
} as any;

describe('RepositoryHealthCard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all health components in correct layout', () => {
    render(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    // Check all components are rendered
    expect(screen.getByTestId('overall-health-score')).toBeInTheDocument();
    expect(screen.getByTestId('lottery-factor-card')).toBeInTheDocument();
    expect(screen.getByTestId('contributor-confidence-card')).toBeInTheDocument();
    expect(screen.getByTestId('health-factors-card')).toBeInTheDocument();
    expect(screen.getByTestId('self-selection-rate-card')).toBeInTheDocument();
  });

  it('uses two-column layout on large screens', () => {
    render(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    // Find the grid container
    const gridContainer = screen.getByTestId('lottery-factor-card').parentElement?.parentElement;
    expect(gridContainer).toHaveClass('lg:grid-cols-2');
  });

  it('places confidence card in right column with other components', () => {
    render(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    // Get the right column container
    const confidenceCard = screen.getByTestId('contributor-confidence-card');
    const rightColumn = confidenceCard.parentElement;

    // Check right column contains confidence, health factors, and self-selection
    expect(rightColumn).toContainElement(screen.getByTestId('contributor-confidence-card'));
    expect(rightColumn).toContainElement(screen.getByTestId('health-factors-card'));
    expect(rightColumn).toContainElement(screen.getByTestId('self-selection-rate-card'));

    // Check proper spacing
    expect(rightColumn).toHaveClass('space-y-6');
  });

  it('calculates and displays repository confidence', async () => {
    (calculateRepositoryConfidence as any).mockResolvedValue(65);

    render(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Confidence: 65%')).toBeInTheDocument();
    });

    expect(calculateRepositoryConfidence).toHaveBeenCalledWith('test-owner', 'test-repo', '30');
  });

  it('shows loading state while calculating confidence', () => {
    (calculateRepositoryConfidence as any).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(50), 100))
    );

    render(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    expect(screen.getByText('Loading confidence...')).toBeInTheDocument();
  });

  it('handles confidence calculation errors', async () => {
    (calculateRepositoryConfidence as any).mockRejectedValue(new Error('Calculation failed'));

    render(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Error loading confidence')).toBeInTheDocument();
    });
  });

  it('recalculates confidence when time range changes', async () => {
    (calculateRepositoryConfidence as any).mockResolvedValue(50);

    const { rerender } = render(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    await waitFor(() => {
      expect(calculateRepositoryConfidence).toHaveBeenCalledWith('test-owner', 'test-repo', '30');
    });

    // Mock time range change
    vi.mocked(require('@/lib/stores/time-range-store').useTimeRangeStore).mockReturnValue({
      timeRange: '90'
    });

    rerender(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    await waitFor(() => {
      expect(calculateRepositoryConfidence).toHaveBeenLastCalledWith('test-owner', 'test-repo', '90');
    });
  });

  it('handles missing repository data gracefully', () => {
    const emptyContext = {
      ...mockContextValue,
      repoData: null
    };

    render(
      <RepoStatsContext.Provider value={emptyContext}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    // Should still render components but confidence won't calculate
    expect(screen.getByTestId('contributor-confidence-card')).toBeInTheDocument();
    expect(calculateRepositoryConfidence).not.toHaveBeenCalled();
  });

  it('maintains responsive layout', () => {
    render(
      <RepoStatsContext.Provider value={mockContextValue}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    const mainContainer = screen.getByTestId('overall-health-score').parentElement;
    expect(mainContainer).toHaveClass('space-y-6');

    const gridContainer = screen.getByTestId('lottery-factor-card').parentElement?.parentElement;
    expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'lg:grid-cols-2', 'gap-6');
  });

  it('integrates with existing repo stats context', () => {
    const contextWithStats = {
      ...mockContextValue,
      repoData: {
        repository: {
          full_name: 'octocat/hello-world',
          stargazers_count: 1000,
          forks_count: 500
        }
      }
    };

    render(
      <RepoStatsContext.Provider value={contextWithStats}>
        <RepositoryHealthCard />
      </RepoStatsContext.Provider>
    );

    expect(calculateRepositoryConfidence).toHaveBeenCalledWith('octocat', 'hello-world', '30');
  });
});