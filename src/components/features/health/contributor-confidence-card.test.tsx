import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ContributorConfidenceCard,
  type ContributorConfidenceCardProps,
} from './contributor-confidence-card';

function showCard(props: ContributorConfidenceCardProps) {
  return render(
    <TooltipProvider>
      <ContributorConfidenceCard {...props} />
    </TooltipProvider>
  );
}

describe('contributor confidence states', () => {
  it('shows a dated warning and last score for a stalled update', () => {
    showCard({
      confidenceScore: 11,
      calculatedAt: '2026-05-20T15:31:26Z',
      syncStatus: {
        isStalled: true,
        isInProgress: false,
        isTriggering: false,
        isComplete: false,
        error: null,
        lastSyncAt: '2026-05-20T15:28:07Z',
        eventsProcessed: 0,
      },
    });
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('Confidence data may be outdated')).toBeInTheDocument();
    expect(screen.getByText('Last known score')).toBeInTheDocument();
    expect(screen.getByText(/Last calculated:/)).toBeInTheDocument();
    expect(screen.queryByText(/Your project/)).not.toBeInTheDocument();
  });

  it('keeps an available score visible after a failed refresh', () => {
    showCard({ confidenceScore: 25, error: 'Please try again later.' });
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Could not update confidence')).toBeInTheDocument();
  });

  it('offers a retry without a billing prompt or a misleading zero', () => {
    const retry = vi.fn();
    showCard({ confidenceScore: null, onRefresh: retry });
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText(/Upgrade/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows the last score during refresh and disables repeated requests', () => {
    showCard({ confidenceScore: 25, loading: true, onRefresh: vi.fn() });
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Updating confidence…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check for updated confidence' })).toBeDisabled();
  });

  it('opens help from the unavailable state', () => {
    showCard({ confidenceScore: null });
    fireEvent.click(screen.getByRole('button', { name: 'Learn More' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
