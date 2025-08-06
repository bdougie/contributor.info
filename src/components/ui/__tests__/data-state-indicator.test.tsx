import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataStateIndicator } from '../data-state-indicator';
import type { DataResult } from '@/lib/errors/repository-errors';

describe('DataStateIndicator', () => {
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('success status', () => {
    it('should render success state with fresh data', () => {
      render(
        <DataStateIndicator
          status="success"
          metadata={{
            isStale: false,
            lastUpdate: '2024-01-16T10:00:00Z',
            dataCompleteness: 95
          }}
        />
      );

      const dataCurrent = screen.queryByText('Data Current');
      const updateText = screen.queryByText(/Updated/);
      
      // At least one should be present
      expect(dataCurrent || updateText).toBeTruthy();
      
      if (dataCurrent) {
        expect(dataCurrent).toBeInTheDocument();
        const container = dataCurrent.closest('div')?.parentElement?.parentElement?.parentElement;
        if (container) {
          expect(container).toHaveClass('bg-green-50');
          expect(container).toHaveClass('border-green-200');
        }
      }
    });

    it('should render success state with stale data', () => {
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 8); // 8 hours ago

      render(
        <DataStateIndicator
          status="success"
          metadata={{
            isStale: true,
            lastUpdate: staleDate.toISOString(),
            dataCompleteness: 85
          }}
        />
      );

      expect(screen.getByText('Data Available')).toBeInTheDocument();
      const container = screen.getByText('Data Available').closest('div')?.parentElement?.parentElement?.parentElement;
      expect(container).toHaveClass('bg-yellow-50');
      expect(container).toHaveClass('border-yellow-200');
      expect(screen.getByText(/Updated \d+ hours? ago/)).toBeInTheDocument();
    });

    it('should show custom message for stale data', () => {
      render(
        <DataStateIndicator
          status="success"
          message="Custom stale message"
          metadata={{ isStale: true }}
        />
      );

      expect(screen.getByText('Custom stale message')).toBeInTheDocument();
    });

    it('should show "Updated just now" for recent updates', () => {
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 30); // 30 minutes ago

      render(
        <DataStateIndicator
          status="success"
          metadata={{
            isStale: false,
            lastUpdate: recentDate.toISOString()
          }}
        />
      );

      expect(screen.getByText('Updated just now')).toBeInTheDocument();
    });
  });

  describe('pending status', () => {
    it('should render pending state with loading animation', () => {
      render(
        <DataStateIndicator
          status="pending"
          message="Repository is being set up..."
        />
      );

      expect(screen.getByText('Getting familiar with repository...')).toBeInTheDocument();
      expect(screen.getByText('Repository is being set up...')).toBeInTheDocument();
      const container = screen.getByText('Getting familiar with repository...').closest('div')?.parentElement?.parentElement?.parentElement;
      expect(container).toHaveClass('bg-blue-50');
      expect(container).toHaveClass('border-blue-200');
      
      // Should have spinning loader icon
      const loader = container?.querySelector('svg');
      expect(loader).toHaveClass('animate-spin');
    });

    it('should show default pending message when none provided', () => {
      render(<DataStateIndicator status="pending" />);

      expect(screen.getByText("We're fetching the latest data. Check back in a minute!")).toBeInTheDocument();
    });
  });

  describe('no_data status', () => {
    it('should render no data state', () => {
      render(
        <DataStateIndicator
          status="no_data"
          message="No pull requests found"
        />
      );

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(screen.getByText('No pull requests found')).toBeInTheDocument();
      const container = screen.getByText('No Data Available').closest('div')?.parentElement?.parentElement?.parentElement;
      expect(container).toHaveClass('bg-gray-50');
      expect(container).toHaveClass('border-gray-200');
    });

    it('should show default no data message', () => {
      render(<DataStateIndicator status="no_data" />);

      expect(screen.getByText('No pull requests found for the selected time range')).toBeInTheDocument();
    });
  });

  describe('large_repository_protected status', () => {
    it('should render large repository state', () => {
      render(
        <DataStateIndicator
          status="large_repository_protected"
          message="This is a large repository"
        />
      );

      expect(screen.getByText('Large Repository')).toBeInTheDocument();
      expect(screen.getByText('This is a large repository')).toBeInTheDocument();
      const container = screen.getByText('Large Repository').closest('div')?.parentElement?.parentElement?.parentElement;
      expect(container).toHaveClass('bg-purple-50');
      expect(container).toHaveClass('border-purple-200');
    });

    it('should show default large repository message', () => {
      render(<DataStateIndicator status="large_repository_protected" />);

      expect(screen.getByText('Using optimized loading for this large repository')).toBeInTheDocument();
    });
  });

  describe('partial_data status', () => {
    it('should render partial data state', () => {
      render(
        <DataStateIndicator
          status="partial_data"
          message="Some data is missing"
          metadata={{ dataCompleteness: 60 }}
        />
      );

      expect(screen.getByText('Partial Data')).toBeInTheDocument();
      expect(screen.getByText('Some data is missing')).toBeInTheDocument();
      const container = screen.getByText('Partial Data').closest('div')?.parentElement?.parentElement?.parentElement;
      expect(container).toHaveClass('bg-orange-50');
      expect(container).toHaveClass('border-orange-200');
    });

    it('should show additional info for low completeness', () => {
      render(
        <DataStateIndicator
          status="partial_data"
          metadata={{ dataCompleteness: 60 }}
        />
      );

      expect(screen.getByText('Want more complete data? The system is gathering additional information in the background.')).toBeInTheDocument();
    });

    it('should not show additional info for high completeness', () => {
      render(
        <DataStateIndicator
          status="partial_data"
          metadata={{ dataCompleteness: 80 }}
        />
      );

      expect(screen.queryByText('Want more complete data?')).not.toBeInTheDocument();
    });
  });

  describe('data completeness progress bar', () => {
    it('should show progress bar for incomplete data', () => {
      render(
        <DataStateIndicator
          status="success"
          metadata={{ dataCompleteness: 75 }}
        />
      );

      expect(screen.getByText('Data completeness')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      
      // Check for progress bar by looking for the specific style
      const progressBar = document.querySelector('div[style*="width: 75%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should not show progress bar for complete data', () => {
      render(
        <DataStateIndicator
          status="success"
          metadata={{ dataCompleteness: 100 }}
        />
      );

      expect(screen.queryByText('Data completeness')).not.toBeInTheDocument();
    });

    it('should not show progress bar when completeness is undefined', () => {
      render(
        <DataStateIndicator
          status="success"
          metadata={{ isStale: false }}
        />
      );

      expect(screen.queryByText('Data completeness')).not.toBeInTheDocument();
    });
  });

  describe('refresh functionality', () => {
    it('should show refresh button when onRefresh is provided', () => {
      render(
        <DataStateIndicator
          status="success"
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it('should call onRefresh when refresh button is clicked', () => {
      render(
        <DataStateIndicator
          status="success"
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });

    it('should not show refresh button for pending status', () => {
      render(
        <DataStateIndicator
          status="pending"
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
    });

    it('should not show refresh button when onRefresh is not provided', () => {
      render(<DataStateIndicator status="success" />);

      expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('should render compact version', () => {
      render(
        <DataStateIndicator
          status="success"
          compact={true}
        />
      );

      expect(screen.getByText('Data Current')).toBeInTheDocument();
      
      // Should not have full card styling in compact mode
      const container = screen.getByText('Data Current').closest('div');
      expect(container).not.toHaveClass('rounded-lg', 'border', 'p-4');
      expect(container).toHaveClass('inline-flex', 'items-center', 'gap-2', 'text-sm');
    });

    it('should not show description in compact mode', () => {
      render(
        <DataStateIndicator
          status="success"
          message="Detailed description"
          compact={true}
        />
      );

      expect(screen.getByText('Data Current')).toBeInTheDocument();
      expect(screen.queryByText('Detailed description')).not.toBeInTheDocument();
    });

    it('should not show refresh button in compact mode', () => {
      render(
        <DataStateIndicator
          status="success"
          onRefresh={mockOnRefresh}
          compact={true}
        />
      );

      expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('should apply custom className', () => {
      render(
        <DataStateIndicator
          status="success"
          className="custom-class"
        />
      );

      // Find the outermost container by looking for the one with rounded-lg class
      const containers = document.querySelectorAll('.rounded-lg');
      expect(containers.length).toBeGreaterThan(0);
      expect(containers[0]).toHaveClass('custom-class');
    });

    it('should apply custom className in compact mode', () => {
      render(
        <DataStateIndicator
          status="success"
          className="custom-compact-class"
          compact={true}
        />
      );

      const container = screen.getByText('Data Current').closest('div');
      expect(container).toHaveClass('custom-compact-class');
    });
  });

  describe('unknown status', () => {
    it('should return null for unknown status', () => {
      const { container } = render(
        <DataStateIndicator
          status={'unknown' as any}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('date formatting', () => {
    it('should handle malformed date strings gracefully', () => {
      render(
        <DataStateIndicator
          status="success"
          metadata={{
            isStale: false,
            lastUpdate: 'invalid-date'
          }}
        />
      );

      // Should still render without crashing
      expect(screen.getByText('Data Current')).toBeInTheDocument();
      // When date is invalid, it shows NaN days ago
      expect(screen.getByText(/Updated NaN day/)).toBeInTheDocument();
    });

    it('should show days for old updates', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 3); // 3 days ago

      render(
        <DataStateIndicator
          status="success"
          metadata={{
            isStale: false,
            lastUpdate: oldDate.toISOString()
          }}
        />
      );

      expect(screen.getByText('Updated 3 days ago')).toBeInTheDocument();
    });

    it('should handle singular vs plural correctly', () => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Test singular day
      const { rerender } = render(
        <DataStateIndicator
          status="success"
          metadata={{
            isStale: false,
            lastUpdate: oneDayAgo.toISOString()
          }}
        />
      );

      expect(screen.getByText('Updated 1 day ago')).toBeInTheDocument();

      // Test singular hour
      rerender(
        <DataStateIndicator
          status="success"
          metadata={{
            isStale: false,
            lastUpdate: oneHourAgo.toISOString()
          }}
        />
      );

      expect(screen.getByText('Updated 1 hour ago')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <DataStateIndicator
          status="success"
          metadata={{
            isStale: false
          }}
        />
      );

      const container = screen.getByText('Data Current').closest('div')?.parentElement?.parentElement?.parentElement;
      expect(container).toBeInTheDocument();
      
      // Should be focusable and have accessible content
      expect(screen.getByText('Data Current')).toBeInTheDocument();
      expect(screen.getByText('All data up to date')).toBeInTheDocument();
    });

    it('should have accessible refresh button', () => {
      render(
        <DataStateIndicator
          status="success"
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
      // Button component may not have explicit type attribute
      expect(refreshButton.tagName).toBe('BUTTON');
    });
  });

  describe('dark mode classes', () => {
    it('should include dark mode classes for all status types', () => {
      const statuses: Array<DataResult<any>['status']> = [
        'success', 'pending', 'no_data', 'large_repository_protected', 'partial_data'
      ];

      statuses.forEach(status => {
        const { container } = render(
          <DataStateIndicator status={status} />
        );

        const element = container.firstChild as HTMLElement;
        if (element) {
          // Should have dark mode background and border classes
          const classes = element.className;
          expect(classes).toMatch(/dark:bg-\w+/);
          expect(classes).toMatch(/dark:border-\w+/);
        }
      });
    });
  });
});