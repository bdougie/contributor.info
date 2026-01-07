import { render, screen, fireEvent } from '@testing-library/react';
import { TrendChart } from '../TrendChart';
import { vi, describe, it, expect } from 'vitest';

// Mock UPlotChart to avoid canvas issues
vi.mock('@/components/ui/charts/UPlotChart', () => ({
  UPlotChart: () => <div data-testid="uplot-chart">Chart</div>,
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('TrendChart', () => {
  const mockData = {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [
      { label: 'Dataset 1', data: [10, 20, 30], color: '#ff0000' },
      { label: 'Dataset 2', data: [15, 25, 35], color: '#00ff00' },
    ],
  };

  it('renders legend buttons with accessibility attributes', () => {
    render(<TrendChart title="Test Chart" data={mockData} />);

    const buttons = screen.getAllByRole('button');
    // Filter to get legend buttons
    const legendButtons = buttons.filter((b) => b.textContent?.includes('Dataset'));
    expect(legendButtons).toHaveLength(2);

    // Check attributes
    const btn1 = legendButtons[0];
    const btn2 = legendButtons[1];

    // Verify type="button"
    expect(btn1).toHaveAttribute('type', 'button');
    expect(btn2).toHaveAttribute('type', 'button');

    // Verify aria-pressed (initially all selected)
    expect(btn1).toHaveAttribute('aria-pressed', 'true');
    expect(btn2).toHaveAttribute('aria-pressed', 'true');

    // Verify aria-label
    expect(btn1).toHaveAttribute('aria-label', 'Toggle Dataset 1');
    expect(btn2).toHaveAttribute('aria-label', 'Toggle Dataset 2');

    // Verify interaction updates aria-pressed
    fireEvent.click(btn1);
    expect(btn1).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn1);
    expect(btn1).toHaveAttribute('aria-pressed', 'true');
  });
});
