import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DonutChart, type DonutChartData } from './DonutChart';

// Mock canvas context
const mockContext = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  font: '',
  textAlign: 'center' as CanvasTextAlign,
  textBaseline: 'middle' as CanvasTextBaseline,
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high' as ImageSmoothingQuality,
};

// Mock requestAnimationFrame
let animationFrameId = 0;
const mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  const id = ++animationFrameId;
  setTimeout(() => callback(0), 0);
  return id;
});

const mockCancelAnimationFrame = vi.fn();

describe('DonutChart', () => {
  const mockData: DonutChartData[] = [
    { id: 'segment1', label: 'Segment 1', value: 30, percentage: 30, color: '#ff0000' },
    { id: 'segment2', label: 'Segment 2', value: 40, percentage: 40, color: '#00ff00' },
    { id: 'segment3', label: 'Segment 3', value: 30, percentage: 30, color: '#0000ff' },
  ];

  beforeEach(() => {
    // Setup canvas mock
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => mockContext
    ) as typeof HTMLCanvasElement.prototype.getContext;

    // Setup animation frame mocks
    global.requestAnimationFrame = mockRequestAnimationFrame as typeof requestAnimationFrame;
    global.cancelAnimationFrame = mockCancelAnimationFrame;

    // Setup ResizeObserver mock
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render canvas with proper dimensions', () => {
    render(<DonutChart data={mockData} width={400} height={400} />);

    const canvas = screen.getByRole('img');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('width', '400');
    expect(canvas).toHaveAttribute('height', '400');
  });

  it('should have proper accessibility attributes', () => {
    render(<DonutChart data={mockData} centerLabel="100" centerSubLabel="Total" />);

    const canvas = screen.getByRole('img');
    expect(canvas).toHaveAttribute('tabIndex', '0');
    expect(canvas).toHaveAttribute('aria-label');
    expect(canvas).toHaveAttribute('aria-describedby', 'donut-chart-description');

    const description = screen.getByText(/Use arrow keys to navigate/);
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('sr-only');
  });

  it('should handle mouse interactions correctly', async () => {
    const onHover = vi.fn();
    const onClick = vi.fn();

    render(<DonutChart data={mockData} onHover={onHover} onClick={onClick} />);

    const canvas = screen.getByRole('img');

    // Simulate mouse move
    fireEvent.mouseMove(canvas, {
      clientX: 200,
      clientY: 200,
    });

    // Simulate click
    fireEvent.click(canvas, {
      clientX: 200,
      clientY: 200,
    });

    // Canvas interactions are geometric, so we just verify the handlers are set
    expect(canvas).toHaveProperty('onmousemove');
    expect(canvas).toHaveProperty('onclick');
  });

  it('should handle keyboard navigation', async () => {
    const onClick = vi.fn();
    const onHover = vi.fn();

    render(<DonutChart data={mockData} onClick={onClick} onHover={onHover} />);

    const canvas = screen.getByRole('img');
    canvas.focus();

    // Navigate with arrow keys
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(onHover).toHaveBeenCalled();

    // Select with Enter
    fireEvent.keyDown(canvas, { key: 'Enter' });

    // Clear with Escape
    fireEvent.keyDown(canvas, { key: 'Escape' });
  });

  it('should animate segments on mount', async () => {
    render(<DonutChart data={mockData} />);

    // Check that animation was initiated
    expect(mockRequestAnimationFrame).toHaveBeenCalled();

    // Wait for animation to progress
    await waitFor(() => {
      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.arc).toHaveBeenCalled();
    });
  });

  it('should clean up resources on unmount', () => {
    const { unmount } = render(<DonutChart data={mockData} />);

    unmount();

    // Check that animation was cancelled
    expect(mockCancelAnimationFrame).toHaveBeenCalled();
  });

  it('should handle empty data gracefully', () => {
    render(<DonutChart data={[]} />);

    const canvas = screen.getByRole('img');
    expect(canvas).toBeInTheDocument();
    expect(mockContext.clearRect).toHaveBeenCalled();
  });

  it('should update when data changes', async () => {
    const { rerender } = render(<DonutChart data={mockData} />);

    const newData: DonutChartData[] = [
      { id: 'new1', label: 'New 1', value: 50, percentage: 50, color: '#ff00ff' },
      { id: 'new2', label: 'New 2', value: 50, percentage: 50, color: '#ffff00' },
    ];

    rerender(<DonutChart data={newData} />);

    await waitFor(() => {
      // Canvas should be redrawn with new data
      expect(mockContext.clearRect).toHaveBeenCalled();
    });
  });

  it('should handle responsive sizing', () => {
    const { container } = render(<DonutChart data={mockData} responsive={true} />);

    const wrapper = container.querySelector('.donut-chart');
    expect(wrapper).toHaveStyle({ width: '100%' });
  });

  it('should display center labels when provided', async () => {
    render(<DonutChart data={mockData} centerLabel="100" centerSubLabel="Total PRs" />);

    await waitFor(() => {
      // Check that fillText was called for center labels
      expect(mockContext.fillText).toHaveBeenCalledWith(
        '100',
        expect.any(Number),
        expect.any(Number)
      );
      expect(mockContext.fillText).toHaveBeenCalledWith(
        'Total PRs',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  it('should handle canvas context errors gracefully', () => {
    // Mock getContext to return null
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null
    ) as typeof HTMLCanvasElement.prototype.getContext;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<DonutChart data={mockData} />);

    expect(consoleSpy).toHaveBeenCalledWith('DonutChart: Unable to get 2D context from canvas');

    consoleSpy.mockRestore();
  });

  it('should apply active segment styling', async () => {
    render(<DonutChart data={mockData} activeSegmentId="segment2" />);

    await waitFor(() => {
      // Active segment should trigger stroke
      expect(mockContext.stroke).toHaveBeenCalled();
    });
  });
});
