import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MetricCard, MetricCardSkeleton } from '../MetricCard';

afterEach(cleanup);

function renderCard(trend: number, extra: Partial<React.ComponentProps<typeof MetricCard>> = {}) {
  return render(
    <TooltipProvider>
      <MetricCard
        title="Stars"
        value={100}
        trend={{ value: trend, label: 'vs prior' }}
        {...extra}
      />
    </TooltipProvider>
  );
}

describe('MetricCard trends', () => {
  it('formats fractional and whole trends with a fixed locale', () => {
    renderCard(0.25);
    expect(screen.getByText('0.25%')).toBeInTheDocument();
    expect(screen.getByText('Up')).toHaveClass('sr-only');
    cleanup();
    renderCard(-1234.6);
    expect(screen.getByText('1,235%')).toBeInTheDocument();
    expect(screen.getByText('Down')).toHaveClass('sr-only');
  });

  it.each([0, 0.004, -0.004])('reports %s as no change instead of a signed 0%', (value) => {
    renderCard(value);
    expect(screen.getByText('No change')).toBeInTheDocument();
    expect(screen.queryByText('Up')).not.toBeInTheDocument();
    expect(screen.queryByText('Down')).not.toBeInTheDocument();
  });

  it('supports the inline layout with a subtitle under the title', () => {
    renderCard(3, { layout: 'inline', subtitle: 'Workspace average', format: 'percentage' });
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Workspace average')).toBeInTheDocument();
    expect(screen.getByText('3%')).toBeInTheDocument();
  });

  it('exposes loading cards as labeled status regions', () => {
    render(<MetricCard title="Open PRs" value={0} loading />);
    expect(
      screen.getByRole('status', { name: 'Loading Open PRs', busy: true })
    ).toBeInTheDocument();
    cleanup();
    render(<MetricCardSkeleton />);
    expect(screen.getByRole('status', { name: 'Loading metric' })).toBeInTheDocument();
  });
});
