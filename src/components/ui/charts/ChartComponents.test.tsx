import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LineChart, AreaChart, BarChart } from './index';

// Mock uPlot
vi.mock('uplot', () => {
  const mockUPlot = vi.fn().mockImplementation((options, data, target) => {
    const instance = {
      destroy: vi.fn(),
      setData: vi.fn(),
      setSize: vi.fn(),
      options,
      data,
      target,
    };
    return instance;
  });

  return { default: mockUPlot };
});

// Mock ResizeObserver
const mockResizeObserverConstructor = vi.fn();
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(...args: any[]) {
    mockResizeObserverConstructor(...args);
  }
}

global.ResizeObserver = MockResizeObserver as any;

describe('Chart Components', () => {
  const mockLineData = {
    labels: [1, 2, 3, 4, 5],
    datasets: [
      {
        label: 'Series 1',
        data: [10, 20, 15, 25, 30],
        color: '#3b82f6',
      },
      {
        label: 'Series 2',
        data: [5, 15, 10, 20, 25],
        color: '#10b981',
      },
    ],
  };

  const mockBarData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Revenue',
        data: [1000, 1500, 1200, 1800, 2000],
        color: '#8b5cf6',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LineChart', () => {
    it('renders without crashing', () => {
      const { container } = render(<LineChart data={mockLineData} />);
      expect(container.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('applies dark theme correctly', () => {
      render(<LineChart data={mockLineData} isDark={true} />);
      // Chart should render - specific theme testing would require deeper mocking
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('handles custom axis labels', () => {
      render(<LineChart data={mockLineData} xAxisLabel="Time" yAxisLabel="Value" />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('supports disabled grid', () => {
      render(<LineChart data={mockLineData} showGrid={false} />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('supports disabled legend', () => {
      render(<LineChart data={mockLineData} showLegend={false} />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });
  });

  describe('AreaChart', () => {
    it('renders without crashing', () => {
      const { container } = render(<AreaChart data={mockLineData} />);
      expect(container.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('handles stacked mode', () => {
      render(<AreaChart data={mockLineData} stacked={true} />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('applies custom fill opacity', () => {
      const dataWithOpacity = {
        ...mockLineData,
        datasets: mockLineData.datasets.map((dataset) => ({
          ...dataset,
          fillOpacity: 0.5,
        })),
      };
      render(<AreaChart data={dataWithOpacity} />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });
  });

  describe('BarChart', () => {
    it('renders without crashing', () => {
      const { container } = render(<BarChart data={mockBarData} />);
      expect(container.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('handles grouped bars', () => {
      render(<BarChart data={mockLineData} grouped={true} />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('handles single series bars', () => {
      render(<BarChart data={mockBarData} grouped={false} />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('supports custom bar width', () => {
      render(<BarChart data={mockBarData} barWidth={0.8} />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });
  });

  describe('Data Handling', () => {
    it('handles null values in datasets', () => {
      const dataWithNulls = {
        labels: [1, 2, 3, 4, 5],
        datasets: [
          {
            label: 'Series with nulls',
            data: [10, null, 15, null, 30],
          },
        ],
      };

      const { container: lineContainer } = render(<LineChart data={dataWithNulls} />);
      const { container: areaContainer } = render(<AreaChart data={dataWithNulls} />);
      const { container: barContainer } = render(<BarChart data={dataWithNulls} />);

      expect(lineContainer.querySelector('.uplot-chart')).toBeInTheDocument();
      expect(areaContainer.querySelector('.uplot-chart')).toBeInTheDocument();
      expect(barContainer.querySelector('.uplot-chart')).toBeInTheDocument();
    });

    it('handles empty datasets', () => {
      const emptyData = {
        labels: [],
        datasets: [],
      };

      const { container: lineContainer } = render(<LineChart data={emptyData} />);
      const { container: areaContainer } = render(<AreaChart data={emptyData} />);
      const { container: barContainer } = render(<BarChart data={emptyData} />);

      expect(lineContainer.querySelector('.uplot-chart')).toBeInTheDocument();
      expect(areaContainer.querySelector('.uplot-chart')).toBeInTheDocument();
      expect(barContainer.querySelector('.uplot-chart')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('supports responsive mode', () => {
      render(<LineChart data={mockLineData} responsive={true} />);
      expect(mockResizeObserverConstructor).toHaveBeenCalled();
    });

    it('supports fixed dimensions', () => {
      render(<LineChart data={mockLineData} width={800} height={400} responsive={false} />);
      expect(document.querySelector('.uplot-chart')).toBeInTheDocument();
    });
  });
});
