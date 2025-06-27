import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContributorConfidenceCard } from './contributor-confidence-card';

// Mock hooks
vi.mock('@/hooks/use-github-auth', () => ({
  useGitHubAuth: () => ({
    isLoggedIn: true,
    login: vi.fn()
  })
}));

vi.mock('@/hooks/use-on-demand-sync', () => ({
  useOnDemandSync: () => ({
    hasData: true,
    syncStatus: {
      isTriggering: false,
      isInProgress: false,
      error: null
    },
    triggerSync: vi.fn()
  })
}));

// Helper function to render with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
};

describe('ContributorConfidenceCard', () => {
  it('renders loading state', () => {
    renderWithRouter(<ContributorConfidenceCard confidenceScore={null} loading />);
    
    expect(screen.getByText('Contributor Confidence')).toBeInTheDocument();
    expect(screen.getByText('Calculating...')).toBeInTheDocument();
    expect(screen.getByText('Analyzing contributor patterns...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    renderWithRouter(<ContributorConfidenceCard confidenceScore={null} error="Failed to calculate confidence" />);
    
    expect(screen.getByText('Data not available')).toBeInTheDocument();
    expect(screen.getByText('Failed to calculate confidence')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  describe('confidence levels', () => {
    it('renders intimidating level (0-30%)', () => {
      renderWithRouter(<ContributorConfidenceCard confidenceScore={15} />);
      
      expect(screen.getByText('Contributor Confidence')).toBeInTheDocument();
      expect(screen.getByText('Your project can be Intimidating')).toBeInTheDocument();
      expect(screen.getByText(/Almost no stargazers and forkers/)).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('renders challenging level (31-50%)', () => {
      renderWithRouter(<ContributorConfidenceCard confidenceScore={40} />);
      
      expect(screen.getByText('Your project is challenging')).toBeInTheDocument();
      expect(screen.getByText(/Few stargazers and forkers/)).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('renders approachable level (51-70%)', () => {
      renderWithRouter(<ContributorConfidenceCard confidenceScore={60} />);
      
      expect(screen.getByText('Your project is approachable!')).toBeInTheDocument();
      expect(screen.getByText(/Some stargazers and forkers/)).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('renders welcoming level (71-100%)', () => {
      renderWithRouter(<ContributorConfidenceCard confidenceScore={85} />);
      
      expect(screen.getByText('Your project is welcoming!')).toBeInTheDocument();
      expect(screen.getByText(/Many stargazers and forkers/)).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });

  it('displays confidence percentage correctly', () => {
    renderWithRouter(<ContributorConfidenceCard confidenceScore={75} />);
    
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('renders header with icon and title', () => {
    const onLearnMoreClick = vi.fn();
    renderWithRouter(
      <ContributorConfidenceCard 
        confidenceScore={50} 
        onLearnMoreClick={onLearnMoreClick}
      />
    );
    
    expect(screen.getByText('Contributor Confidence')).toBeInTheDocument();
    expect(screen.getByText('Learn More')).toBeInTheDocument();
    
    const learnMoreButton = screen.getByText('Learn More');
    expect(learnMoreButton).toHaveClass('text-opensauced-orange');
  });

  it('applies custom className', () => {
    renderWithRouter(<ContributorConfidenceCard confidenceScore={50} className="custom-class" />);
    
    const card = screen.getByText('Contributor Confidence').closest('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it('handles edge case confidence values', () => {
    const { rerender } = renderWithRouter(<ContributorConfidenceCard confidenceScore={0} />);
    expect(screen.getByText('Your project can be Intimidating')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ContributorConfidenceCard confidenceScore={30} />
      </MemoryRouter>
    );
    expect(screen.getByText('Your project can be Intimidating')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ContributorConfidenceCard confidenceScore={31} />
      </MemoryRouter>
    );
    expect(screen.getByText('Your project is challenging')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ContributorConfidenceCard confidenceScore={50} />
      </MemoryRouter>
    );
    expect(screen.getByText('Your project is challenging')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ContributorConfidenceCard confidenceScore={51} />
      </MemoryRouter>
    );
    expect(screen.getByText('Your project is approachable!')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ContributorConfidenceCard confidenceScore={70} />
      </MemoryRouter>
    );
    expect(screen.getByText('Your project is approachable!')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ContributorConfidenceCard confidenceScore={71} />
      </MemoryRouter>
    );
    expect(screen.getByText('Your project is welcoming!')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ContributorConfidenceCard confidenceScore={100} />
      </MemoryRouter>
    );
    expect(screen.getByText('Your project is welcoming!')).toBeInTheDocument();
  });

  it('handles null confidence', () => {
    renderWithRouter(<ContributorConfidenceCard confidenceScore={null} />);
    
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText('Data not available')).toBeInTheDocument();
  });

  it('renders correct description for each confidence level', () => {
    const testCases = [
      {
        confidenceScore: 10,
        expectedText: 'Almost no stargazers and forkers come back later on to make a meaningful contribution'
      },
      {
        confidenceScore: 40,
        expectedText: 'Few stargazers and forkers come back later on to make a meaningful contribution'
      },
      {
        confidenceScore: 60,
        expectedText: 'Some stargazers and forkers come back later on to make a meaningful contribution'
      },
      {
        confidenceScore: 80,
        expectedText: 'Many stargazers and forkers come back later on to make a meaningful contribution'
      }
    ];

    testCases.forEach(({ confidenceScore, expectedText }) => {
      const { unmount } = renderWithRouter(<ContributorConfidenceCard confidenceScore={confidenceScore} />);
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      unmount();
    });
  });

  it('maintains consistent card structure', () => {
    renderWithRouter(<ContributorConfidenceCard confidenceScore={50} />);
    
    // Check card structure
    const card = screen.getByText('Contributor Confidence').closest('.w-full');
    expect(card).toBeInTheDocument();
    
    // Check that percentage is displayed
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('shows refresh button when onRefresh is provided', () => {
    const onRefresh = vi.fn();
    renderWithRouter(
      <ContributorConfidenceCard 
        confidenceScore={50} 
        owner="test-owner"
        repo="test-repo"
        onRefresh={onRefresh}
      />
    );
    
    const refreshButton = screen.getByTitle('Refresh data');
    expect(refreshButton).toBeInTheDocument();
  });
});