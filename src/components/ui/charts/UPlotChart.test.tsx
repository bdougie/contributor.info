import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UPlotChart } from './UPlotChart';
import type { AlignedData } from 'uplot';

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

describe('UPlotChart', () => {
  const mockData: AlignedData = [
    [1, 2, 3, 4, 5], // x-axis
    [10, 20, 15, 25, 30], // y-axis series 1
  ];

  const mockOptions = {
    title: 'Test Chart',
    series: [
      { label: 'X' },
      { label: 'Y', stroke: 'blue' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <UPlotChart data={mockData} options={mockOptions} />
    );
    
    expect(container.querySelector('.uplot-chart')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <UPlotChart 
        data={mockData} 
        options={mockOptions} 
        className="custom-chart"
      />
    );
    
    expect(container.querySelector('.custom-chart')).toBeInTheDocument();
  });

  it('uses provided width and height', () => {
    const { container } = render(
      <UPlotChart 
        data={mockData} 
        options={mockOptions} 
        width={800}
        height={400}
        responsive={false}
      />
    );
    
    const chartDiv = container.querySelector('.uplot-chart');
    expect(chartDiv).toHaveStyle({ width: '800px' });
  });

  it('calls onReady callback when chart is created', async () => {
    const onReady = vi.fn();
    
    render(
      <UPlotChart 
        data={mockData} 
        options={mockOptions} 
        onReady={onReady}
      />
    );
    
    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });
  });

  it('calls onDestroy callback when component unmounts', () => {
    const onDestroy = vi.fn();
    
    const { unmount } = render(
      <UPlotChart 
        data={mockData} 
        options={mockOptions} 
        onDestroy={onDestroy}
      />
    );
    
    unmount();
    
    expect(onDestroy).toHaveBeenCalled();
  });

  it('sets up ResizeObserver when responsive is true', () => {
    mockResizeObserverConstructor.mockClear();
    
    render(
      <UPlotChart 
        data={mockData} 
        options={mockOptions} 
        responsive={true}
      />
    );
    
    expect(mockResizeObserverConstructor).toHaveBeenCalled();
  });

  it('does not set up ResizeObserver when responsive is false', () => {
    mockResizeObserverConstructor.mockClear();
    
    render(
      <UPlotChart 
        data={mockData} 
        options={mockOptions} 
        responsive={false}
      />
    );
    
    expect(mockResizeObserverConstructor).not.toHaveBeenCalled();
  });

  it('uses 100% width when responsive is enabled', () => {
    const { container } = render(
      <UPlotChart 
        data={mockData} 
        options={mockOptions} 
        responsive={true}
      />
    );
    
    const chartDiv = container.querySelector('.uplot-chart');
    expect(chartDiv).toHaveStyle({ width: '100%' });
  });
});